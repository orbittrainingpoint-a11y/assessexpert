import { Controller, Get, Post, Body, Query, Req, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamDeliveryService } from './exam-delivery.service';
import { SessionsService } from '../sessions/sessions.service';
import { FacialRecognitionService } from '../facial-recognition/facial-recognition.service';
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
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

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

  @Get('practical/task')
  async getPracticalTask(@Query('token') token: string) {
    return this.examDeliveryService.getPracticalTask(token);
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
      fileName = `${Date.now()}-${file.originalname}`;
      filePath = path.join(storagePath, fileName);
      fs.writeFileSync(filePath, file.buffer);
    }

    const result = await this.examDeliveryService.submitPractical(token, filePath, fileName);
    // Notify proctor that candidate submitted
    const session = await this.examDeliveryService.getSessionByToken(token);
    if (session) this.gateway.emitToSession(session.id, 'session.submitted', { sessionId: session.id, timestamp: new Date().toISOString() });
    return result;
  }
}
