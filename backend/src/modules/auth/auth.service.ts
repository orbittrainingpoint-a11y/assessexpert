import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(user: any, ip: string) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        mfaEnabled: user.mfaEnabled,
      },
      requiresMfa: user.mfaEnabled,
    };
  }

  async verifyMfa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('MFA not configured');
    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!valid) throw new UnauthorizedException('Invalid MFA code');
    return { verified: true };
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const secret = speakeasy.generateSecret({
      name: `assessexpert (${user.email})`,
      issuer: 'assessexpert',
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrCode: qrCodeUrl };
  }

  async enableMfa(userId: string, token: string) {
    await this.verifyMfa(userId, token);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    return { enabled: true };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      };
      return { accessToken: this.jwtService.sign(newPayload) };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // Magic link for candidates
  async generateMagicLink(sessionId: string, candidateEmail: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { magicToken: token, tokenExpiresAt: expiresAt },
    });
    return { token, url: `${process.env.FRONTEND_URL}/exam?token=${token}` };
  }

  async verifyMagicToken(token: string, ip: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      include: { candidate: true, assessmentType: true },
    });
    if (!session) throw new UnauthorizedException('Invalid or expired link');
    if (session.tokenExpiresAt < new Date()) throw new UnauthorizedException('Link has expired');
    // Allow joining if session is within 24 hours of scheduled time (not just 30 min)
    if (session.tokenUsedAt && session.status !== 'WAITING_ROOM' && session.status !== 'CHECKLIST'
        && !['MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS', 'MCQ_COMPLETE'].includes(session.status)) {
      throw new UnauthorizedException('This link has already been used');
    }
    if (!session.tokenUsedAt) {
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { tokenUsedAt: new Date(), tokenUsedFromIp: ip, status: 'WAITING_ROOM' },
      });
    }
    return { ...session, status: session.tokenUsedAt ? session.status : 'WAITING_ROOM' };
  }

  // OTP store — in-memory for dev, should use Redis in production
  private otpStore = new Map<string, { otp: string; expires: Date; attempts: number }>();

  async sendCandidateOtp(email: string, sessionToken: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: sessionToken },
      include: { candidate: true },
    });
    if (!session || session.candidate.email !== email) {
      throw new BadRequestException('Email does not match session');
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    this.otpStore.set(email, { otp, expires, attempts: 0 });

    // Send OTP via email
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'theassessexpert@gmail.com',
        to: email,
        subject: 'Your AssessExpert Verification Code',
        html: `
          <div style="font-family: Inter, sans-serif; background: #060B18; color: #F1F5F9; padding: 40px; max-width: 500px; margin: 0 auto; border-radius: 12px;">
            <h1 style="color: #00D4FF; font-size: 22px; margin: 0 0 24px;">AssessExpert</h1>
            <h2 style="color: #F1F5F9; font-size: 18px;">Your Verification Code</h2>
            <p style="color: #94A3B8;">Use the code below to access your assessment. It expires in 10 minutes.</p>
            <div style="background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.3); border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #00D4FF;">${otp}</span>
            </div>
            <p style="color: #475569; font-size: 12px;">Do not share this code. If you did not request this, please ignore this email.</p>
          </div>`,
      });
    } catch (e) {
      console.error('OTP email failed:', e.message);
    }

    return { sent: true };
  }

  async verifyCandidateOtp(email: string, otp: string) {
    // DEMO bypass — always accept '000000' in dev mode
    if (process.env.NODE_ENV !== 'production' && otp === '000000') {
      return { verified: true };
    }
    const stored = this.otpStore.get(email);
    if (!stored) throw new BadRequestException('No OTP found. Please request a new code.');
    if (stored.expires < new Date()) {
      this.otpStore.delete(email);
      throw new BadRequestException('Code has expired. Please request a new code.');
    }
    stored.attempts++;
    if (stored.attempts > 3) {
      this.otpStore.delete(email);
      throw new BadRequestException('Too many attempts. Please contact your assessment coordinator.');
    }
    if (stored.otp !== otp) {
      throw new BadRequestException(`Incorrect code. ${3 - stored.attempts} attempts remaining.`);
    }
    this.otpStore.delete(email);
    return { verified: true };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, organizationId: true, mfaEnabled: true,
        phone: true, profilePhoto: true, timezone: true,
        preferredLanguage: true, status: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new BadRequestException('Cannot change password');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return { changed: true };
  }
}
