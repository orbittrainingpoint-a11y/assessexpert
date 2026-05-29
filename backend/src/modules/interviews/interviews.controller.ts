import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

// HR-driven interview surface. Only roles that can hire (HR_MANAGER /
// HIRING_MANAGER) plus the org-level admins can schedule and conduct;
// SUPER_ADMIN is included so a platform owner can always reach it.
const HIRE_ROLES = ['HR_MANAGER', 'HIRING_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'] as const;

@ApiTags('interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...HIRE_ROLES)
@Controller('interviews')
export class InterviewsController {
  constructor(private interviewsService: InterviewsService) {}

  @Post('schedule')
  async schedule(@Body() body: any, @Req() req: any) {
    return this.interviewsService.schedule({
      ...body,
      organizationId: req.user.organizationId,
      scheduledBy: req.user.id,
      scheduledAt: new Date(body.scheduledAt),
    });
  }

  @Get()
  async getAll(@Query() filters: any, @Req() req: any) {
    return this.interviewsService.getAll({
      ...filters,
      organizationId: req.user.organizationId,
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.interviewsService.getOne(id);
  }

  @Post(':id/start')
  async start(@Param('id') id: string) {
    return this.interviewsService.start(id);
  }

  @Post(':id/end')
  async end(@Param('id') id: string, @Body() body: any) {
    return this.interviewsService.end(id, body);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.interviewsService.cancel(id);
  }

  /**
   * HR captures the candidate's current camera frame on their browser
   * (canvas → base64 JPEG ~640px) and POSTs it. We run the real FR
   * comparison against the candidate's stored reference photo and
   * persist the latest verdict on the interview row. The body is large
   * (~50-80KB) but well under the server's 10MB cap.
   */
  @Post(':id/verify-frame')
  async verifyFrame(@Param('id') id: string, @Body() body: any) {
    return this.interviewsService.verifyFrame(id, body?.capturedImage);
  }

  /** HR marks the candidate as visually verified (or not), with a note. */
  @Post(':id/manual-verify')
  async manualVerify(@Param('id') id: string, @Body() body: any) {
    return this.interviewsService.manualVerify(id, !!body?.verified, body?.note);
  }
}

/**
 * Unauthenticated, token-gated surface for the candidate's join page.
 * Separate controller so the JWT guards above don't accidentally apply.
 * The unguessable magicToken IS the auth — same pattern as /api/exam.
 */
@ApiTags('interviews-public')
@Controller('interviews/public')
export class InterviewsPublicController {
  constructor(private interviewsService: InterviewsService) {}

  @Get('by-token/:token')
  async getByToken(@Param('token') token: string) {
    return this.interviewsService.getByToken(token);
  }
}
