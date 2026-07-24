import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as nodemailer from 'nodemailer';
import { randomBytes, randomInt } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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

  // Login rate limit — Redis-backed sliding 15-min window per email.
  // After 5 failed password attempts, the User row's lockedUntil is set
  // to now + 15min and further attempts (right OR wrong password) are
  // refused with a lockout error. Success resets the counter.
  private loginFailKey(email: string) {
    return `login:fail:${email.toLowerCase()}`;
  }

  async validateUser(email: string, password: string) {
    const LOGIN_MAX_FAILS = 5;
    const LOGIN_WINDOW_SECONDS = 15 * 60;
    const key = this.loginFailKey(email);

    const user = await this.prisma.user.findUnique({ where: { email } });

    // If the user is currently locked, refuse regardless of password
    // correctness. Same generic message so we don't confirm "correct
    // password but you're locked" (that'd let an attacker verify
    // creds mid-lockout).
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Too many failed attempts. Try again in 15 minutes.',
      );
    }

    // Deliberately generic for missing user / missing password hash /
    // wrong password so an attacker cannot enumerate emails via error
    // messages. Inactive / suspended / deleted users get the same
    // "not active" line — again, no leaking of state.
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      // Increment the fail counter atomically; set TTL on first fail
      // so the window slides from the first bad attempt, not the last.
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, LOGIN_WINDOW_SECONDS);

      // On the Nth fail, stamp lockedUntil on the User row so the
      // check at the top of this function refuses the next request
      // instantly (without waiting for a Redis roundtrip). Also gives
      // a persistent audit trail visible to admins.
      if (count >= LOGIN_MAX_FAILS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lockedUntil: new Date(Date.now() + LOGIN_WINDOW_SECONDS * 1000) },
        });
        await this.redis.del(key); // reset — lockedUntil is the source of truth now
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    // Success — clear the counter + any residual lockout stamp.
    await this.redis.del(key);
    if (user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: null },
      });
    }
    return user;
  }

  // SAST §1.3 gap — MFA backup codes.
  //
  // Generate 10 single-use recovery codes when the user first enables
  // MFA (or asks to regenerate). Each code is 8 hex chars; the plaintext
  // is returned ONCE — we store only bcrypt hashes so a DB leak doesn't
  // yield usable codes. If a user loses their TOTP device they can
  // consume one of these codes via /auth/mfa/verify-backup instead of
  // being locked out permanently.
  async generateMfaBackupCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const raw = randomBytes(4).toString('hex'); // 8 hex chars
      codes.push(raw);
      hashes.push(await bcrypt.hash(raw, 10));
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashes as any },
    });
    return codes;
  }

  // Verify a backup code AND consume it (single-use). Returns true on
  // successful match, false otherwise. On success the matched hash is
  // removed from the array so the code can't be replayed.
  async verifyMfaBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true } as any,
    });
    const hashes: string[] = ((user as any)?.mfaBackupCodes || []);
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(code, hashes[i])) {
        // Consume the matched code
        const remaining = hashes.filter((_, idx) => idx !== i);
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: remaining as any },
        });
        return true;
      }
    }
    return false;
  }

  // Email verification — issue token + email link.
  //
  // Called at user creation (invitation accept, admin create) OR
  // whenever an admin toggles a "resend verification" on the user page.
  // Verification is NOT blocking today (users can log in unverified)
  // but downstream features (e.g. GDPR export) may gate on it.
  async sendEmailVerification(userId: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerifiedAt) return { sent: false }; // already verified

    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerificationToken: token } as any,
    });

    const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'theassessexpert@gmail.com',
        to: user.email,
        subject: 'Verify your AssessExpert email',
        html: `
          <p>Hi ${user.firstName || ''},</p>
          <p>Confirm your email so we know we can reach you when it matters.</p>
          <p><a href="${link}">Click here to verify</a> — this link doesn't expire.</p>
          <p>If you didn't sign up for AssessExpert, ignore this message.</p>
          <p>— AssessExpert</p>
        `,
      });
    } catch (e: any) {
      this.logger.warn(`Email verification send failed for userId=${userId}: ${e?.message || e}`);
      return { sent: false };
    }
    return { sent: true };
  }

  async completeEmailVerification(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token } as any,
    });
    if (!user) throw new BadRequestException('Verification link is invalid');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      } as any,
    });
    return { verified: true, email: user.email };
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
      // Same cast as auth.module.ts — NestJS 11 jwt typing tightened.
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
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

  // SAST P1 #7 — per-userId MFA rate limit + lockout.
  //
  // Before: only the global 10/min throttle protected this endpoint.
  // TOTP is 6 digits × window=1 ⇒ ~500k tries to brute-force a given
  // user. An attacker with distributed IPs could grind through it.
  //
  // After: each userId gets a sliding 15-minute window in Redis.
  // After 5 failed attempts in that window, further attempts are
  // refused with 429 regardless of the code's correctness. A
  // successful verify resets the counter. Failed attempts are logged
  // (without the code itself — that'd defeat the point) so the audit
  // trail captures unusual activity.
  private mfaAttemptsKey(userId: string) {
    return `mfa:fail:${userId}`;
  }

  async verifyMfa(userId: string, token: string) {
    const MFA_MAX_FAILS = 5;
    const MFA_WINDOW_SECONDS = 15 * 60;
    const attemptsKey = this.mfaAttemptsKey(userId);

    // Check current fail count BEFORE doing any work. A locked-out
    // user gets the same response shape regardless of whether the
    // submitted code is correct — that prevents an attacker from
    // confirming "right code arrived after lockout" via timing.
    const currentFails = Number((await this.redis.get(attemptsKey)) ?? 0);
    if (currentFails >= MFA_MAX_FAILS) {
      throw new UnauthorizedException(
        'Too many failed MFA attempts. Try again in 15 minutes.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('MFA not configured');
    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) {
      // Atomic increment + TTL set. The expire only takes effect the
      // first time so the window starts at the first failure, not
      // the latest one (sliding window over fixed window).
      const count = await this.redis.incr(attemptsKey);
      if (count === 1) await this.redis.expire(attemptsKey, MFA_WINDOW_SECONDS);
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Success — drop the failure counter so a legit user who fat-
    // fingered a few digits before getting it right starts fresh.
    await this.redis.del(attemptsKey);
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

    // ATOMIC first-use mark. Previous version read tokenUsedAt then
    // updated separately — two concurrent tabs racing the same link
    // could both pass the !tokenUsedAt check and both succeed. With
    // updateMany filtering on tokenUsedAt: null, only the first
    // request through claims the row; the second sees count=0 and
    // proceeds with the already-used row (which is fine — it's the
    // same legitimate candidate; we just don't double-write the IP).
    if (!session.tokenUsedAt) {
      await this.prisma.examSession.updateMany({
        where: { id: session.id, tokenUsedAt: null },
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
  private otpRateKey(email: string) { return `otp:rate:${this.normalizeEmail(email)}`; }

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
    // Per-email throttle on OTP issuance. The controller already enforces
    // 10/min per-IP, but a determined attacker can rotate IPs to spam a
    // specific candidate's inbox. Cap to 3 OTP emails per email address
    // per 5 minutes. We INCR with a TTL that's only set on first write
    // — equivalent to a 5-min sliding window per recipient.
    const rateCount = await this.redis.incr(this.otpRateKey(email));
    if (rateCount === 1) {
      await this.redis.expire(this.otpRateKey(email), 300);
    }
    if (rateCount > 3) {
      throw new BadRequestException('Too many OTP requests for this email. Please wait a few minutes and try again.');
    }
    // Cryptographically secure OTP. Math.random() is a pseudo-RNG seeded by
    // V8 and biased on hot reload — an attacker who can request several OTPs
    // in sequence could narrow the next value's range. crypto.randomInt
    // pulls from the OS CSPRNG (same source as JWT signing).
    const otp = String(randomInt(100000, 1000000));
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
