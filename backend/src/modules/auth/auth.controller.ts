import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode, Param, Inject, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

// ── httpOnly cookie strategy (PORTAL_GAPS.md C1) ──────────────────────
//
// The frontend USED to persist accessToken + refreshToken in
// localStorage — trivially exfiltrated by any XSS in the app. Now the
// backend sets both as httpOnly cookies so JS can never touch them.
//
// - `access_token` — 15-minute lifetime (or whatever JWT_EXPIRES_IN
//   says). Sent with every same-origin request via credentials.
// - `refresh_token` — matched to JWT_REFRESH_EXPIRES_IN (default 7d).
//   Scoped to `/api/auth` so it never leaks to unrelated endpoints.
//
// Both are Strict SameSite because the frontend + API sit on the same
// eTLD+1 in production (assessexpert.com). Secure flag in prod only
// so dev on localhost still works.
//
// We ALSO still return the tokens in the JSON response body during
// the migration window — the frontend's old localStorage code paths
// haven't been fully removed yet in every consumer. Drop the JSON
// tokens once the client is verified cookies-only on staging + prod.

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

function accessCookieOpts(): CookieOptions {
  const secure = process.env.NODE_ENV === 'production';
  // Access-token cookie applies to every /api/* route so authenticated
  // requests can present it. 15 min default lifetime (mirror JWT_EXPIRES_IN).
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api',
    maxAge: parseDurationMs(process.env.JWT_EXPIRES_IN, 15 * 60 * 1000),
  };
}

function refreshCookieOpts(): CookieOptions {
  const secure = process.env.NODE_ENV === 'production';
  // Refresh cookie scoped to /api/auth only — no other endpoint should
  // ever see it. Cuts leakage surface if a downstream route logs headers.
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000),
  };
}

/**
 * Parse a "15m" / "7d" / "3600s" duration string into milliseconds.
 * Returns `fallbackMs` if the input is missing or malformed. Enough to
 * cover the JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN formats we actually
 * use; not a full ms() replacement.
 */
function parseDurationMs(input: string | undefined, fallbackMs: number): number {
  if (!input) return fallbackMs;
  const m = /^(\d+)([smhd])$/.exec(input.trim());
  if (!m) return fallbackMs;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

/**
 * Attach both cookies to the response. Called after every flow that
 * produces a fresh token pair (login, MFA verify, magic-link verify,
 * OTP verify, invitation accept).
 */
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOpts());
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts());
}

/** Wipe both cookies (logout). */
function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...accessCookieOpts(), maxAge: undefined });
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOpts(), maxAge: undefined });
}

@ApiTags('auth')
@Controller('auth')
// Per-IP throttle on every public auth endpoint. The named "auth" profile
// is 10/min from app.module.ts — slows brute-force OTP / login attempts
// without locking out a legitimate user who just fat-fingered their
// password a few times.
@Throttle({ auth: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(body.email, body.password);
    const result = await this.authService.login(user, req.ip);
    if (result?.accessToken && result?.refreshToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }

  @Post('mfa/verify')
  @HttpCode(200)
  async verifyMfa(
    @Body() body: { userId: string; token: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result: any = await this.authService.verifyMfa(body.userId, body.token);
    if (result?.accessToken && result?.refreshToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async setupMfa(@Req() req: any) {
    return this.authService.setupMfa(req.user.id);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async enableMfa(@Req() req: any, @Body() body: { token: string }) {
    return this.authService.enableMfa(req.user.id, body.token);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: any,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prefer the httpOnly refresh cookie; fall back to a body-supplied
    // token so callers that still send it during the migration window
    // continue to work. Once every deployed client is cookie-only, the
    // body fallback can go.
    const rt = req.cookies?.[REFRESH_COOKIE] || body?.refreshToken;
    if (!rt) throw new BadRequestException('refresh token required');
    const result = await this.authService.refreshToken(rt);
    if (result?.accessToken) {
      res.cookie(ACCESS_COOKIE, result.accessToken, accessCookieOpts());
    }
    return result;
  }

  @Post('magic-link/verify')
  @HttpCode(200)
  async verifyMagicLink(
    @Body() body: { token: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result: any = await this.authService.verifyMagicToken(body.token, req.ip);
    if (result?.accessToken && result?.refreshToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }

  @Post('otp/send')
  @HttpCode(200)
  async sendOtp(@Body() body: { email: string; sessionToken: string }) {
    return this.authService.sendCandidateOtp(body.email, body.sessionToken);
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body() body: { email: string; otp: string; sessionToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result: any = await this.authService.verifyCandidateOtp(body.email, body.otp, body.sessionToken);
    if (result?.accessToken && result?.refreshToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }

  // GDPR §7 — self-service data export. Returns a JSON blob the
  // caller can download; frontend triggers file save via
  // Content-Disposition. Big enough that we don't cache — issue on
  // request only.
  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async exportMyData(@Req() req: any, @Res() res: Response) {
    const data = await this.authService.exportUserData(req.user.id);
    const filename = `assessexpert-data-export-${req.user.id}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }

  // GDPR §7 — self-service account delete. Soft delete + PII scrub.
  // Refuses if this is the last active SUPER_ADMIN.
  @Post('me/delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  async selfDelete(@Req() req: any) {
    return this.authService.selfDeleteAccount(req.user.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async changePassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear the httpOnly cookies. Any legacy client that still
    // wipes localStorage will continue to work — this is additive.
    clearAuthCookies(res);
    return { success: true };
  }

  // Public forgot-password. Deliberately returns 200 always (even for
  // unknown emails) so an attacker cannot enumerate registered emails
  // via the response shape. Actual dispatch outcome is logged
  // server-side only.
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: { email: string }) {
    if (!body?.email) throw new BadRequestException('email required');
    return this.usersService.requestPasswordReset(body.email);
  }

  // Public reset-password. Verifies token + expiry + sets new hash.
  // Constant-shape error message for invalid/expired to prevent
  // token enumeration.
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body?.token || !body?.password) throw new BadRequestException('token and password required');
    return this.usersService.completePasswordReset(body.token, body.password);
  }

  // Public email verification. Consumed by the user clicking the
  // emailed link. Sets emailVerifiedAt + clears the token.
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: { token: string }) {
    if (!body?.token) throw new BadRequestException('token required');
    return this.authService.completeEmailVerification(body.token);
  }

  // MFA backup code verify — alternative to TOTP when the user has
  // lost their authenticator device. Same 200 shape as verifyMfa.
  // Consumes the code on success (single-use).
  @Post('mfa/verify-backup')
  @HttpCode(200)
  async verifyMfaBackup(@Body() body: { userId: string; code: string }) {
    if (!body?.userId || !body?.code) throw new BadRequestException('userId and code required');
    const ok = await this.authService.verifyMfaBackupCode(body.userId, body.code);
    if (!ok) throw new BadRequestException('Invalid or already-used backup code');
    return { verified: true };
  }

  // Authenticated — regenerate the 10 backup codes. Returns them
  // plaintext ONCE. The old codes are invalidated.
  @Post('mfa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async regenerateBackupCodes(@Req() req: any) {
    const codes = await this.authService.generateMfaBackupCodes(req.user.id);
    return {
      codes,
      warning: 'Save these somewhere safe — they will not be shown again.',
    };
  }

  @Get('invitation/:token')
  @HttpCode(200)
  async getInvitation(@Param('token') token: string) {
    return this.usersService.getInvitation(token);
  }

  @Post('invitation/accept')
  @HttpCode(200)
  async acceptInvitation(
    @Body() body: { token: string; password: string; firstName: string; lastName: string; phone?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result: any = await this.usersService.acceptInvitation(body.token, body);
    if (result?.accessToken && result?.refreshToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result;
  }
}
