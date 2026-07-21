import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, Param, Inject, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

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
  async login(@Body() body: { email: string; password: string }, @Req() req: any) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user, req.ip);
  }

  @Post('mfa/verify')
  @HttpCode(200)
  async verifyMfa(@Body() body: { userId: string; token: string }) {
    return this.authService.verifyMfa(body.userId, body.token);
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
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('magic-link/verify')
  @HttpCode(200)
  async verifyMagicLink(@Body() body: { token: string }, @Req() req: any) {
    return this.authService.verifyMagicToken(body.token, req.ip);
  }

  @Post('otp/send')
  @HttpCode(200)
  async sendOtp(@Body() body: { email: string; sessionToken: string }) {
    return this.authService.sendCandidateOtp(body.email, body.sessionToken);
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() body: { email: string; otp: string; sessionToken?: string }) {
    return this.authService.verifyCandidateOtp(body.email, body.otp, body.sessionToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async changePassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Post('logout')
  @HttpCode(200)
  async logout() {
    // Token invalidation is handled client-side (clear localStorage)
    // No guard needed — logout must work even with expired tokens
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

  @Get('invitation/:token')
  @HttpCode(200)
  async getInvitation(@Param('token') token: string) {
    return this.usersService.getInvitation(token);
  }

  @Post('invitation/accept')
  @HttpCode(200)
  async acceptInvitation(@Body() body: { token: string; password: string; firstName: string; lastName: string; phone?: string }) {
    return this.usersService.acceptInvitation(body.token, body);
  }
}
