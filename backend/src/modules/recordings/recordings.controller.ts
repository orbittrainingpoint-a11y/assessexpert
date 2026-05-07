import { Controller, Get, Post, Param, Req, Res, UseGuards, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import * as fs from 'fs';
import { Response } from 'express';

@ApiTags('recordings')
@Controller('recordings')
export class RecordingsController {
  constructor(private recordingsService: RecordingsService) {}

  @Post('sessions/:sessionId/chunk')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { streamType: 'screen' | 'webcam'; chunkIndex: string },
  ) {
    return this.recordingsService.saveChunk(sessionId, body.streamType, parseInt(body.chunkIndex), file.buffer);
  }

  @Post('sessions/:sessionId/finalize')
  async finalizeRecording(@Param('sessionId') sessionId: string) {
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
