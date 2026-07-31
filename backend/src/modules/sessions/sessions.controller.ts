import { BadRequestException, Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionsService } from './sessions.service';
import { AiTranscriptionService } from '../ai-transcription/ai-transcription.service';
import { AdminService } from '../admin/admin.service';
import { AppGateway } from '../gateway/app.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sessions')
export class SessionsController {
  constructor(
    private sessionsService: SessionsService,
    private gateway: AppGateway,
    private aiTranscription: AiTranscriptionService,
    private admin: AdminService,
  ) {}

  // Proctor-side audio chunk → Gemini → appended to transcript.
  // JWT auth. Tagged with the candidateId the proctor is currently
  // verifying (from the body) so the report can group correctly.
  @Post(':id/transcribe-audio')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async transcribeProctorAudio(
    @Param('id') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { candidateId?: string; timestamp?: string },
  ) {
    if (!file) throw new BadRequestException('audio file is required');
    const text = await this.aiTranscription.transcribe(file.buffer, file.mimetype || 'audio/webm');
    if (!text) return { transcribed: false };
    return this.sessionsService.appendVerificationTranscript(sessionId, {
      candidateId: body.candidateId,
      speaker: 'PROCTOR',
      text,
      timestamp: body.timestamp,
    });
  }

  @Get()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR', 'HR_MANAGER', 'ORG_ADMIN', 'HIRING_MANAGER')
  async getAllSessions(@Query() filters: any, @Req() req: any) {
    // Proctor sees only their own sessions
    if (req.user.role === 'PROCTOR') {
      return this.sessionsService.getSessionsForProctor(req.user.id);
    }
    // Org-scoped roles only see sessions inside their own organization
    if (['HR_MANAGER', 'ORG_ADMIN', 'HIRING_MANAGER'].includes(req.user.role)) {
      return this.sessionsService.getAllSessions({
        ...filters,
        organizationId: req.user.organizationId,
      });
    }
    // SUPER_ADMIN / MASTER_PROCTOR — unrestricted
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
    // Platform-side roles (AssessExpert HQ staff) proctor sessions across
    // every client organization, so they bypass the tenant check.
    // sessions.service.ts:getSession uses explicit `null` as the bypass
    // sentinel — passing `undefined` here was a latent bug that made every
    // cross-tenant fetch 403 for the exact people who should have access.
    const orgId = ['SUPER_ADMIN', 'MASTER_PROCTOR', 'PROCTOR'].includes(req.user.role)
      ? null
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

  // /sessions/multi-candidate was a dedicated path for creating an
  // exam slot with a pre-populated list of candidates. Now that every
  // session is created as multi-candidate (with the primary already
  // promoted to a SessionCandidate row), the regular scheduling flow
  // and the @Post(':id/candidates') endpoint below cover all the same
  // use cases — the dedicated path was just one more shape to maintain.

  @Post(':id/candidates')
  @Roles('SUPER_ADMIN', 'HR_MANAGER', 'ORG_ADMIN', 'PROCTOR')
  async addCandidate(@Param('id') id: string, @Body() body: { candidateId: string }) {
    return this.sessionsService.addCandidateToSession(id, body.candidateId);
  }

  @Get(':id/candidates')
  async getSessionCandidates(@Param('id') id: string) {
    return this.sessionsService.getSessionCandidates(id);
  }

  @Put(':id/candidates/:candidateId')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async updateCandidateStatus(
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
    @Body() body: { status: string; data?: any },
  ) {
    return this.sessionsService.updateCandidateStatus(id, candidateId, body.status, body.data);
  }

  @Get(':id/verification-status')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async checkVerificationStatus(@Param('id') id: string) {
    return this.sessionsService.checkAllCandidatesVerified(id);
  }

  @Get(':id/mcq-status')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async checkMCQStatus(@Param('id') id: string) {
    return this.sessionsService.checkAllMCQSubmitted(id);
  }

  @Post(':id/begin')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async beginAssessment(@Param('id') id: string, @Req() req: any) {
    const result = await this.sessionsService.startMcq(id, req.user.id);
    this.gateway.emitToSession(id, 'session.phase', { phase: 'MCQ_IN_PROGRESS', sessionId: id });
    return result;
  }

  @Post(':id/assign-practical')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async assignPractical(
    @Param('id') id: string,
    @Body() body: { practicalTaskId: string; candidateId?: string },
    @Req() req: any,
  ) {
    const result = await this.sessionsService.assignPracticalTask(id, body.practicalTaskId, req.user.id, body.candidateId);
    this.gateway.emitToSession(id, 'session.phase', {
      phase: 'PRACTICAL_IN_PROGRESS',
      sessionId: id,
      candidateId: body.candidateId,
      practicalTask: result.practicalTask ? {
        title: (result as any).practicalTask.title,
        description: (result as any).practicalTask.description,
        acceptedFileTypes: (result as any).practicalTask.acceptedFileTypes,
      } : null,
    });
    return result;
  }

  // Master proctor reassigns a live session to a different proctor.
  // Both the kicked proctor and the new one need to know — the kicked
  // browser listens for proctor.reassigned and bails out, and the new
  // proctor's dashboard re-queries to pick up the session. A signed
  // audit entry is written so the chain-hashed log captures who did
  // the swap and why.
  @Put(':id/proctor')
  @Roles('MASTER_PROCTOR')
  async reassignProctor(
    @Param('id') id: string,
    @Body() body: { newProctorId: string; reason?: string },
    @Req() req: any,
  ) {
    const result = await this.sessionsService.reassignProctor(id, body.newProctorId);
    const payload = {
      sessionId: id,
      previousProctorId: result.previousProctorId,
      newProctorId: body.newProctorId,
      newProctorName: `${result.newProctor.firstName} ${result.newProctor.lastName}`.trim(),
      reassignedBy: req.user.id,
      reason: body.reason || null,
      timestamp: new Date().toISOString(),
    };
    this.gateway.emitToSession(id, 'proctor.reassigned', payload);

    // Audit log. Failure here shouldn't abort the reassignment — the
    // socket emit already went out and the DB row is updated. Just
    // log a warning so we know to investigate.
    try {
      await this.admin.writeAuditLog({
        userId: req.user.id,
        userEmail: req.user.email,
        role: req.user.role,
        eventType: 'SESSION_PROCTOR_REASSIGNED',
        target: 'ExamSession',
        targetId: id,
        payload: {
          previousProctorId: result.previousProctorId,
          newProctorId: body.newProctorId,
          reason: body.reason || null,
        },
        ipAddress: req.ip || 'unknown',
      });
    } catch (e: any) {
      // Don't reuse the controller logger — fall back to console.
      // eslint-disable-next-line no-console
      console.warn(`Audit log write failed for reassign ${id}: ${e?.message || e}`);
    }
    return result.session;
  }

  @Post(':id/terminate')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async terminate(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: any) {
    const result = await this.sessionsService.terminateSession(id, body.reason, req.user.id);
    this.gateway.emitToSession(id, 'session.phase', { phase: 'TERMINATED', sessionId: id, reason: body.reason });
    return result;
  }

  @Post(':id/pause')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async pause(@Param('id') id: string) {
    const result = await this.sessionsService.pauseSession(id);
    this.gateway.emitToSession(id, 'session.pause', { paused: true, sessionId: id });
    return result;
  }

  @Post(':id/resume')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async resume(@Param('id') id: string) {
    const result = await this.sessionsService.resumeSession(id);
    this.gateway.emitToSession(id, 'session.pause', { paused: false, sessionId: id });
    return result;
  }

  // Proctor appends a verification transcript line (JWT-auth).
  @Post(':id/transcript')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async appendTranscriptProctor(
    @Param('id') id: string,
    @Body() body: { candidateId?: string; text: string; timestamp?: string },
  ) {
    return this.sessionsService.appendVerificationTranscript(id, {
      candidateId: body.candidateId,
      speaker: 'PROCTOR',
      text: body.text,
      timestamp: body.timestamp,
    });
  }

  @Get(':id/transcript')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN', 'HR_MANAGER', 'ORG_ADMIN', 'HIRING_MANAGER')
  async getTranscript(@Param('id') id: string) {
    return this.sessionsService.getVerificationTranscript(id);
  }

  @Post(':id/proctor-message')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async proctorMessage(
    @Param('id') id: string,
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    this.gateway.emitToSession(id, 'proctor.message', { message: body.message, timestamp: new Date().toISOString() });
    return { sessionId: id, message: body.message, sentBy: req.user.id, timestamp: new Date() };
  }
}
