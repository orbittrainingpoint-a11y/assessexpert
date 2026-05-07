import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async getAllSessions(@Query() filters: any) {
    return this.sessionsService.getAllSessions(filters);
  }

  @Get('live')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR')
  async getLiveSessions() {
    return this.sessionsService.getLiveSessions();
  }

  @Get('today')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async getTodaySessions(@Req() req: any) {
    const today = new Date().toISOString().split('T')[0];
    return this.sessionsService.getSessionsForProctor(req.user.id, today);
  }

  @Get('by-token/:token')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getSessionByToken(@Param('token') token: string) {
    return this.sessionsService.getSessionByToken(token);
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    const orgId = ['SUPER_ADMIN', 'MASTER_PROCTOR'].includes(req.user.role)
      ? undefined
      : req.user.organizationId;
    return this.sessionsService.getDashboardStats(orgId);
  }

  @Get(':id')
  async getSession(@Param('id') id: string, @Req() req: any) {
    const orgId = ['SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR'].includes(req.user.role)
      ? undefined
      : req.user.organizationId;
    return this.sessionsService.getSession(id, orgId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'HR_MANAGER', 'ORG_ADMIN')
  async createSession(@Body() body: any, @Req() req: any) {
    return this.sessionsService.createSession({
      ...body,
      organizationId: req.user.organizationId || body.organizationId,
    });
  }

  @Post(':id/begin')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async beginAssessment(@Param('id') id: string, @Req() req: any) {
    return this.sessionsService.startMcq(id, req.user.id);
  }

  @Post(':id/assign-practical')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async assignPractical(@Param('id') id: string, @Body() body: { practicalTaskId: string }, @Req() req: any) {
    return this.sessionsService.assignPracticalTask(id, body.practicalTaskId, req.user.id);
  }

  @Post(':id/terminate')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async terminate(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: any) {
    return this.sessionsService.terminateSession(id, body.reason, req.user.id);
  }

  @Post(':id/pause')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async pause(@Param('id') id: string) {
    return this.sessionsService.pauseSession(id);
  }

  @Post(':id/resume')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async resume(@Param('id') id: string) {
    return this.sessionsService.resumeSession(id);
  }

  @Post(':id/proctor-message')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async proctorMessage(
    @Param('id') id: string,
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    return { sessionId: id, message: body.message, sentBy: req.user.id, timestamp: new Date() };
  }
}
