import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecordingsService } from './recordings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import * as fs from 'fs';
import { Response } from 'express';

// Per-chunk size cap. 5-second WebM/VP8 chunks at our bitrate (~500 kbps)
// are ~300 KB. We allow up to 5 MB to be generous for screen-share peaks.
const MAX_CHUNK_BYTES = 5 * 1024 * 1024;

@ApiTags('recordings')
@Controller('recordings')
export class RecordingsController {
  constructor(
    private recordingsService: RecordingsService,
    private prisma: PrismaService,
  ) {}

  @Post('sessions/:sessionId/chunk')
  @UseInterceptors(FileInterceptor('chunk', { limits: { fileSize: MAX_CHUNK_BYTES } }))
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @Query('token') token: string,
    @Query('candidateId') candidateId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { streamType: 'screen' | 'webcam'; chunkIndex: string; candidateId?: string },
  ) {
    if (!file) throw new BadRequestException('chunk file is required');
    if (!token) throw new UnauthorizedException('token is required');
    if (!body?.streamType || !['screen', 'webcam'].includes(body.streamType)) {
      throw new BadRequestException('streamType must be "screen" or "webcam"');
    }
    const chunkIndex = parseInt(body.chunkIndex, 10);
    if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
      throw new BadRequestException('chunkIndex must be a non-negative integer');
    }

    // Magic-token authorization: the token must belong to this session AND
    // the session must be in an exam-active state. This stops a stale or
    // wrong-session token from spamming our disk.
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      select: { id: true, status: true, candidateId: true, isMultiCandidate: true },
    });
    if (!session || session.id !== sessionId) {
      throw new UnauthorizedException('Invalid token for this session');
    }
    const recordableStatuses = ['CHECKLIST', 'WAITING_ROOM', 'MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'];
    if (!recordableStatuses.includes(session.status)) {
      throw new BadRequestException(`Recording is not allowed in status ${session.status}`);
    }

    // Resolve the candidate that owns this chunk. Multi-candidate slots
    // MUST pass the OTP-resolved id; single-candidate falls back to the
    // session's primary. Verify the id is actually part of this session.
    let cId = candidateId || body.candidateId;
    if (!cId) {
      if (session.isMultiCandidate) {
        throw new BadRequestException('candidateId is required for multi-candidate sessions');
      }
      cId = session.candidateId;
    } else if (cId !== session.candidateId) {
      const sc = await this.prisma.sessionCandidate.findUnique({
        where: { sessionId_candidateId: { sessionId, candidateId: cId } },
        select: { id: true },
      });
      if (!sc) throw new UnauthorizedException('candidateId is not part of this session');
    }

    return this.recordingsService.saveChunk(sessionId, cId, body.streamType, chunkIndex, file.buffer);
  }

  @Post('sessions/:sessionId/finalize')
  async finalizeRecording(
    @Param('sessionId') sessionId: string,
    @Query('token') token: string,
    @Query('candidateId') candidateId?: string,
  ) {
    if (!token) throw new UnauthorizedException('token is required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      select: { id: true, candidateId: true, isMultiCandidate: true },
    });
    if (!session || session.id !== sessionId) {
      throw new UnauthorizedException('Invalid token for this session');
    }
    // Per-candidate finalize for the candidate that left the page. If no
    // id is provided we finalize EVERYTHING under the session (the
    // proctor's terminate flow or server-side recovery path).
    if (candidateId) {
      let cId = candidateId;
      if (cId !== session.candidateId) {
        const sc = await this.prisma.sessionCandidate.findUnique({
          where: { sessionId_candidateId: { sessionId, candidateId: cId } },
          select: { id: true },
        });
        if (!sc) throw new UnauthorizedException('candidateId is not part of this session');
      }
      return this.recordingsService.finalizeRecordingForCandidate(sessionId, cId);
    }
    return this.recordingsService.finalizeRecording(sessionId);
  }

  @Get('sessions/:sessionId/url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getRecordingUrl(
    @Param('sessionId') sessionId: string,
    @Query('candidateId') candidateId: string | undefined,
    @Query('streamType') streamType: 'screen' | 'webcam' | undefined,
    @Req() req: any,
  ) {
    return this.recordingsService.getRecordingUrl(sessionId, req.user, candidateId, streamType);
  }

  @Get('sessions/:sessionId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getStatus(@Param('sessionId') sessionId: string) {
    return this.recordingsService.getRecordingStatus(sessionId);
  }

  @Get('stream/:token')
  async streamRecording(@Param('token') token: string, @Res() res: Response) {
    const { filePath } = await this.recordingsService.streamRecording(token);
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(filePath).pipe(res);
  }
}
