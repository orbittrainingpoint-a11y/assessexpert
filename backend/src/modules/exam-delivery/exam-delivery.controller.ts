import { Controller, Get, Post, Body, Query, Req, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamDeliveryService } from './exam-delivery.service';
import { SessionsService } from '../sessions/sessions.service';
import { FacialRecognitionService } from '../facial-recognition/facial-recognition.service';
import { AiTranscriptionService } from '../ai-transcription/ai-transcription.service';
import { AppGateway } from '../gateway/app.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags } from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('exam')
@Controller('exam')
export class ExamDeliveryController {
  constructor(
    private examDeliveryService: ExamDeliveryService,
    private sessionsService: SessionsService,
    private frService: FacialRecognitionService,
    private aiTranscription: AiTranscriptionService,
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

  // Candidate-side audio chunk → Gemini → appended to transcript.
  // Magic-token auth. The hook on the candidate browser posts ~8s WebM/Opus
  // audio chunks here; we forward them to the AI service. If the model
  // returns empty text (silence / no speech), we silently skip — the
  // candidate doesn't see "EMPTY" lines on the report.
  @Post('transcribe-audio')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async transcribeCandidateAudio(
    @Query('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { candidateId?: string; timestamp?: string },
  ) {
    if (!file) throw new BadRequestException('audio file is required');
    if (!token) throw new BadRequestException('token required');
    const session = await this.examDeliveryService.getSessionByToken(token);
    if (!session) throw new BadRequestException('Invalid token');

    const text = await this.aiTranscription.transcribe(file.buffer, file.mimetype || 'audio/webm');
    if (!text) return { transcribed: false };

    return this.sessionsService.appendVerificationTranscript(session.id, {
      candidateId: body.candidateId,
      speaker: 'CANDIDATE',
      text,
      timestamp: body.timestamp,
    });
  }

  // Candidate uploads a one-time reference photo during their camera-check
  // phase. Magic-token authenticated. Refuses to overwrite an existing
  // reference unless the candidate doesn't have one yet.
  @Post('reference-photo')
  async uploadReferencePhoto(
    @Query('token') token: string,
    @Body() body: { candidateId?: string; imageBase64: string },
  ) {
    if (!body?.imageBase64) throw new BadRequestException('imageBase64 required');
    const session = await this.examDeliveryService.getSessionByToken(token);
    if (!session) throw new BadRequestException('Invalid session token');

    // Resolve which candidate (multi-candidate slots share the magic link).
    // The browser is expected to pass its OTP-resolved candidateId; if not
    // provided we default to the session's primary candidate.
    let candidateId = body.candidateId || session.candidateId;
    // Verify the candidateId is actually attached to this session (either
    // primary or a SessionCandidate row) — prevent cross-session abuse.
    if (candidateId !== session.candidateId) {
      const sc = await this.prisma.sessionCandidate.findFirst({
        where: { sessionId: session.id, candidateId },
        select: { id: true },
      });
      if (!sc) throw new BadRequestException('candidateId not part of this session');
    }

    return this.frService.saveReferencePhoto(candidateId, body.imageBase64);
  }

  @Get('reference-photo/status')
  async referencePhotoStatus(
    @Query('token') token: string,
    @Query('candidateId') candidateId?: string,
  ) {
    const session = await this.examDeliveryService.getSessionByToken(token);
    if (!session) throw new BadRequestException('Invalid session token');
    const id = candidateId || session.candidateId;
    return this.frService.hasReferencePhoto(id);
  }

  // Candidate-side transcript append (magic-token auth, no JWT).
  @Post('transcript')
  async appendTranscriptCandidate(
    @Query('token') token: string,
    @Body() body: { candidateId?: string; text: string; timestamp?: string },
  ) {
    const session = await this.examDeliveryService.getSessionByToken(token);
    if (!session) throw new BadRequestException('Invalid session token');
    return this.sessionsService.appendVerificationTranscript(session.id, {
      candidateId: body.candidateId,
      speaker: 'CANDIDATE',
      text: body.text,
      timestamp: body.timestamp,
    });
  }

  @Get('session')
  async getSessionState(
    @Query('token') token: string,
    @Query('candidateId') candidateId?: string,
  ) {
    return this.examDeliveryService.getSessionState(token, candidateId);
  }

  @Get('question/current')
  async getCurrentQuestion(
    @Query('token') token: string,
    @Query('candidateId') candidateId?: string,
  ) {
    return this.examDeliveryService.getCurrentQuestion(token, candidateId);
  }

  @Post('question/submit')
  async submitAnswer(
    @Query('token') token: string,
    @Query('candidateId') candidateId: string | undefined,
    @Body() body: { questionId: string; response: any; timeSpentSeconds: number; candidateId?: string },
  ) {
    return this.examDeliveryService.submitAnswer(
      token,
      body.questionId,
      body.response,
      body.timeSpentSeconds,
      // Accept candidateId from either source so older clients keep working.
      candidateId || body.candidateId,
    );
  }

  @Get('timer')
  async getTimer(@Query('token') token: string) {
    return this.examDeliveryService.getTimer(token);
  }

  // Candidate-facing notification that the client-side countdown just
  // hit zero. The backend re-validates the timer (defence against a
  // tampered clock) and only auto-submits if the server agrees time
  // has actually run out. Without this the server-side cron is the
  // only thing that catches expired exams — fine in the worst case,
  // but a minute of "session still in progress" UX is jarring.
  @Post('timer/expired')
  async notifyTimerExpired(
    @Query('token') token: string,
    @Query('candidateId') candidateIdQuery: string | undefined,
    @Body() body: { phase: 'mcq' | 'practical'; candidateId?: string },
  ) {
    return this.examDeliveryService.handleClientTimerExpired(
      token,
      body.phase,
      candidateIdQuery || body.candidateId,
    );
  }

  @Get('practical/task')
  async getPracticalTask(
    @Query('token') token: string,
    @Query('candidateId') candidateId?: string,
  ) {
    return this.examDeliveryService.getPracticalTask(token, candidateId);
  }

  @Post('practical/submit')
  @UseInterceptors(FileInterceptor('file'))
  async submitPractical(
    @Query('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let filePath: string | undefined;
    let fileName: string | undefined;

    if (file) {
      const storagePath = process.env.PRACTICAL_FILES_PATH || './storage/practical-files';
      if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
      // SAST P0 #5 — path traversal. Was `${Date.now()}-${file.originalname}`
      // with originalname unfiltered. Multer's originalname can contain
      // `..` and `/` (browsers don't strip them and crafty clients can
      // set the header directly). `path.join('storage', '1234-../../etc/foo')`
      // resolves the `..` segments and escapes the storage dir.
      //
      // Defence: take only the basename (drops any path segments) and
      // strip everything except a conservative allowlist of characters,
      // then resolve the final path and verify it's still under the
      // storage root before writing. Belt and braces.
      const rawName = path.basename(String(file.originalname || 'submission.bin'));
      const safeName = rawName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-180); // cap length
      fileName = `${Date.now()}-${safeName}`;
      filePath = path.join(storagePath, fileName);
      const resolvedRoot = path.resolve(storagePath);
      const resolvedTarget = path.resolve(filePath);
      if (!resolvedTarget.startsWith(resolvedRoot + path.sep) && resolvedTarget !== resolvedRoot) {
        throw new BadRequestException('Invalid filename');
      }
      fs.writeFileSync(filePath, file.buffer);
    }

    const result = await this.examDeliveryService.submitPractical(token, filePath, fileName);
    // Notify proctor that candidate submitted
    const session = await this.examDeliveryService.getSessionByToken(token);
    if (session) this.gateway.emitToSession(session.id, 'session.submitted', { sessionId: session.id, timestamp: new Date().toISOString() });
    return result;
  }
}
