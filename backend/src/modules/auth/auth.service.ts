import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
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
    private redis: RedisService,
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

    // Block if session is fully done
    const doneStatuses = ['SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'DISQUALIFIED', 'CANCELLED', 'NO_SHOW'];
    if (doneStatuses.includes(session.status)) {
      throw new UnauthorizedException('This assessment session has ended');
    }

    // Mark first use
    if (!session.tokenUsedAt) {
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: { tokenUsedAt: new Date(), tokenUsedFromIp: ip, status: 'WAITING_ROOM' },
      });
    }

    // Return fresh session state, including SessionCandidates so the frontend
    // can decide whether to pre-fill the email (single candidate) or leave it
    // blank for the candidate to type their own (multi-candidate slot).
    const updated = await this.prisma.examSession.findUnique({
      where: { id: session.id },
      include: {
        candidate: true,
        assessmentType: true,
        sessionCandidates: { include: { candidate: true } },
      },
    });
    return updated;
  }

  // OTP store keys. The RedisService transparently falls back to an
  // in-memory map when REDIS_URL is unset, so this code is the same
  // shape in both modes — only the storage layer differs.
  private otpKey(email: string) { return `otp:code:${this.normalizeEmail(email)}`; }
  private otpAttemptsKey(email: string) { return `otp:attempts:${this.normalizeEmail(email)}`; }

  // Email-matching helper. The DB sometimes carries mixed-case emails
  // from CSV imports and users type their address with whatever
  // capitalisation muscle memory gives them — so every comparison
  // goes through lowercase + trim. RFC 5321 says the local-part is
  // technically case-sensitive but no real provider treats it that
  // way; matching case-insensitively is the right call here.
  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  async sendCandidateOtp(email: string, sessionToken: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: sessionToken },
      include: {
        candidate: true,
        sessionCandidates: { include: { candidate: true } },
      },
    });
    if (!session) {
      throw new BadRequestException('Email does not match session');
    }
    // In multi-candidate sessions the email may belong to any candidate
    // in the slot, not just the primary candidate. Accept all of them.
    // Compare case-insensitively — see normalizeEmail() above.
    const normalized = this.normalizeEmail(email);
    const allEmails = new Set<string>([
      this.normalizeEmail(session.candidate.email),
      ...session.sessionCandidates.map(sc => this.normalizeEmail(sc.candidate.email)),
    ]);
    if (!allEmails.has(normalized)) {
      throw new BadRequestException('Email does not match session');
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // 10-minute TTL — Redis (or the in-memory fallback) expires the key
    // automatically so we don't have to track an explicit expires field.
    // Reset the attempts counter on every fresh OTP issuance.
    await this.redis.setex(this.otpKey(email), 10 * 60, otp);
    await this.redis.del(this.otpAttemptsKey(email));

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

  async verifyCandidateOtp(email: string, otp: string, sessionToken?: string) {
    const stored = await this.redis.get(this.otpKey(email));
    // Missing key means either the OTP was never issued or it has
    // already expired — Redis TTL handles expiry for us.
    if (!stored) throw new BadRequestException('No OTP found or it has expired. Please request a new code.');

    const attempts = await this.redis.incr(this.otpAttemptsKey(email));
    if (attempts > 3) {
      // Burn the OTP after 3 failed tries so a brute-force attacker
      // can't sit on the same code indefinitely.
      await this.redis.del(this.otpKey(email));
      await this.redis.del(this.otpAttemptsKey(email));
      throw new BadRequestException('Too many attempts. Please contact your assessment coordinator.');
    }
    if (stored !== otp) {
      throw new BadRequestException(`Incorrect code. ${Math.max(0, 3 - attempts)} attempts remaining.`);
    }
    // Success — clean up both keys.
    await this.redis.del(this.otpKey(email));
    await this.redis.del(this.otpAttemptsKey(email));

    // If we have a session token, resolve which specific candidate just
    // logged in. The caller will use this to drive the per-candidate WebRTC
    // identity, checklist tracking, and identity validation.
    if (sessionToken) {
      const session = await this.prisma.examSession.findUnique({
        where: { magicToken: sessionToken },
        include: {
          candidate: true,
          sessionCandidates: { include: { candidate: true } },
        },
      });
      if (session) {
        // Primary candidate first. Compare case-insensitively so an
        // email entered as "JuraiJ@gmail.com" still matches "juraij@gmail.com"
        // in the DB (and vice versa).
        const normalized = this.normalizeEmail(email);
        if (this.normalizeEmail(session.candidate.email) === normalized) {
          return {
            verified: true,
            candidateId: session.candidate.id,
            candidateFirstName: session.candidate.firstName,
            candidateLastName: session.candidate.lastName,
            candidateEmail: session.candidate.email,
            sessionId: session.id,
            isMultiCandidate: session.isMultiCandidate,
          };
        }
        // Then any SessionCandidate
        const match = session.sessionCandidates.find(sc => this.normalizeEmail(sc.candidate.email) === normalized);
        if (match) {
          return {
            verified: true,
            candidateId: match.candidate.id,
            candidateFirstName: match.candidate.firstName,
            candidateLastName: match.candidate.lastName,
            candidateEmail: match.candidate.email,
            sessionId: session.id,
            isMultiCandidate: session.isMultiCandidate,
          };
        }
      }
    }
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
