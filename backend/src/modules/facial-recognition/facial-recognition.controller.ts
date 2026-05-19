import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FacialRecognitionService } from './facial-recognition.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('facial-recognition')
@Controller('facial-recognition')
export class FacialRecognitionController {
  constructor(private frService: FacialRecognitionService) {}

  // Candidate-side periodic FR check. Magic-token authed (no JWT) so
  // the candidate browser can post a webcam frame every couple of
  // minutes while sitting the exam. Outcome is logged and a socket
  // event is emitted to the proctor on any non-VERIFIED result. We
  // rate-limit at the same budget as other heavy candidate uploads.
  @Post('sessions/:sessionId/candidate-periodic')
  @Throttle({ recording: { ttl: 60_000, limit: 240 } })
  async runCandidatePeriodicCheck(
    @Param('sessionId') sessionId: string,
    @Query('token') token: string,
    @Query('candidateId') candidateIdQuery: string | undefined,
    @Body() body: { capturedImage: string; candidateId?: string },
  ) {
    if (!token) throw new BadRequestException('token is required');
    if (!body?.capturedImage) throw new BadRequestException('capturedImage is required');
    const resolved = await this.frService.resolveCandidateFromToken(
      token,
      sessionId,
      candidateIdQuery || body.candidateId,
    );
    return this.frService.runCandidatePeriodicCheck(
      resolved.sessionId,
      resolved.candidateId,
      body.capturedImage,
    );
  }

  // ── JWT-guarded staff endpoints ──────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('sessions/:sessionId/pre-exam')
  @Roles('PROCTOR', 'MASTER_PROCTOR')
  async runPreExamCheck(
    @Param('sessionId') sessionId: string,
    @Body() body: { capturedImage: string; referenceImage: string; candidateId?: string },
    @Req() req: any,
  ) {
    return this.frService.runPreExamCheck(sessionId, body.capturedImage, body.referenceImage, req.user.id, body.candidateId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('sessions/:sessionId/periodic')
  async runPeriodicCheck(
    @Param('sessionId') sessionId: string,
    @Body() body: { capturedImage: string },
  ) {
    return this.frService.runPeriodicCheck(sessionId, body.capturedImage);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('sessions/:sessionId/logs')
  @Roles('PROCTOR', 'MASTER_PROCTOR', 'SUPER_ADMIN')
  async getLogs(@Param('sessionId') sessionId: string) {
    return this.frService.getFrLogs(sessionId);
  }
}
