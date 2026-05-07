import { Controller, Post, Get, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.verifyCandidateOtp(body.email, body.otp);
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
}
