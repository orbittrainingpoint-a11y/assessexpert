import { Controller, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';
import { AutoCaptureService } from './auto-capture.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

class DetectFacesDto {
  image: string; // base64
}

// Trimmed in batch-20. The detection / behavior / id-document endpoints
// were never called by the frontend and only existed to wrap the
// matching placeholder services. Everything that remains is hit by
// real code: capture-gallery reads from /captures/* and ID
// verification posts to /capture/id-verification.
@ApiTags('mediapipe')
@Controller('mediapipe')
export class MediaPipeController {
  constructor(
    private mediaPipeService: MediaPipeService,
    private autoCaptureService: AutoCaptureService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check MediaPipe service health' })
  getHealth() {
    return {
      status: this.mediaPipeService.isReady() ? 'ready' : 'not_ready',
      ...this.mediaPipeService.getStatus(),
    };
  }

  @Post('capture/id-verification/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auto-capture + compare against stored reference for ID verification' })
  async captureIDVerification(
    @Param('sessionId') sessionId: string,
    @Body() dto: { image: string; checklistItemKey: string; candidateId?: string },
  ) {
    return this.autoCaptureService.captureForIDVerification(
      sessionId,
      dto.image,
      dto.checklistItemKey,
      dto.candidateId,
    );
  }

  @Post('capture/periodic/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Periodic auto-capture during exam (proctor JWT)' })
  async capturePeriodicSnapshot(
    @Param('sessionId') sessionId: string,
    @Body() dto: DetectFacesDto,
  ) {
    return this.autoCaptureService.capturePeriodicSnapshot(sessionId, dto.image);
  }

  @Post('capture/manual/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manual capture by proctor' })
  async captureManual(
    @Param('sessionId') sessionId: string,
    @Body() dto: DetectFacesDto,
  ) {
    return this.autoCaptureService.captureManual(sessionId, dto.image);
  }

  @Get('captures/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all captures for session (capture gallery)' })
  async getSessionCaptures(@Param('sessionId') sessionId: string) {
    return this.autoCaptureService.getSessionCaptures(sessionId);
  }

  @Get('capture-stats/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get capture statistics' })
  async getCaptureStats(@Param('sessionId') sessionId: string) {
    return this.autoCaptureService.getCaptureStats(sessionId);
  }
}
