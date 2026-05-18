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
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { streamType: 'screen' | 'webcam'; chunkIndex: string },
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
      select: { id: true, status: true },
    });
    if (!session || session.id !== sessionId) {
      throw new UnauthorizedException('Invalid token for this session');
    }
    const recordableStatuses = ['CHECKLIST', 'WAITING_ROOM', 'MCQ_IN_PROGRESS', 'PRACTICAL_IN_PROGRESS'];
    if (!recordableStatuses.includes(session.status)) {
      throw new BadRequestException(`Recording is not allowed in status ${session.status}`);
    }

    return this.recordingsService.saveChunk(sessionId, body.streamType, chunkIndex, file.buffer);
  }

  @Post('sessions/:sessionId/finalize')
  async finalizeRecording(
    @Param('sessionId') sessionId: string,
    @Query('token') token: string,
  ) {
    if (!token) throw new UnauthorizedException('token is required');
    const session = await this.prisma.examSession.findUnique({
      where: { magicToken: token },
      select: { id: true },
    });
    if (!session || session.id !== sessionId) {
      throw new UnauthorizedException('Invalid token for this session');
    }
    return this.recordingsService.finalizeRecording(sessionId);
  }

  @Get('sessions/:sessionId/url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getRecordingUrl(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.recordingsService.getRecordingUrl(sessionId, req.user);
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
