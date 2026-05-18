import { Controller, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';
import { MultipleFaceDetectionService } from './multiple-face-detection.service';
import { BehaviorAnalysisService } from './behavior-analysis.service';
import { AutoCaptureService } from './auto-capture.service';
import { IDDocumentDetectionService } from './id-document-detection.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

class DetectFacesDto {
  image: string; // base64
}

class CompareFacesDto {
  image1: string; // base64
  image2: string; // base64
}

@ApiTags('mediapipe')
@Controller('mediapipe')
export class MediaPipeController {
  constructor(
    private mediaPipeService: MediaPipeService,
    private multipleFaceService: MultipleFaceDetectionService,
    private behaviorService: BehaviorAnalysisService,
    private autoCaptureService: AutoCaptureService,
    private idDocumentService: IDDocumentDetectionService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check MediaPipe service health' })
  getHealth() {
    return {
      status: this.mediaPipeService.isReady() ? 'ready' : 'not_ready',
      ...this.mediaPipeService.getStatus(),
    };
  }

  @Post('detect-faces')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detect faces in image' })
  async detectFaces(@Body() dto: DetectFacesDto) {
    const faces = await this.mediaPipeService.detectFaces(dto.image);
    return {
      faceCount: faces.length,
      faces,
      hasMultipleFaces: faces.length > 1,
    };
  }

  @Post('extract-landmarks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Extract face landmarks and embedding' })
  async extractLandmarks(@Body() dto: DetectFacesDto) {
    const result = await this.mediaPipeService.extractFaceLandmarks(dto.image);
    return result;
  }

  @Post('compare-faces')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Compare two face images' })
  async compareFaces(@Body() dto: CompareFacesDto) {
    const landmarks1 = await this.mediaPipeService.extractFaceLandmarks(dto.image1);
    const landmarks2 = await this.mediaPipeService.extractFaceLandmarks(dto.image2);

    if (!landmarks1 || !landmarks2) {
      return {
        error: 'Could not extract face landmarks from one or both images',
        similarity: 0,
        outcome: 'REJECTED',
      };
    }

    const result = this.mediaPipeService.compareFaceEmbeddings(
      landmarks1.embedding,
      landmarks2.embedding
    );

    return result;
  }

  @Post('count-faces')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Count faces in image' })
  async countFaces(@Body() dto: DetectFacesDto) {
    const count = await this.mediaPipeService.countFaces(dto.image);
    return { count, hasMultipleFaces: count > 1 };
  }

  @Post('check-multiple-faces/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check for multiple faces and generate alert if needed' })
  async checkMultipleFaces(
    @Param('sessionId') sessionId: string,
    @Body() dto: DetectFacesDto
  ) {
    // Note: emitAlert function should be provided by WebSocket gateway
    // For now, return detection result without emitting
    const result = await this.multipleFaceService.checkMultipleFaces(
      sessionId,
      dto.image,
      () => {} // No-op emit function for REST endpoint
    );
    return result;
  }

  @Post('check-absence/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if candidate is absent from frame' })
  async checkAbsence(
    @Param('sessionId') sessionId: string,
    @Body() dto: DetectFacesDto
  ) {
    const isAbsent = await this.multipleFaceService.checkAbsence(
      sessionId,
      dto.image,
      () => {} // No-op emit function for REST endpoint
    );
    return { isAbsent };
  }

  @Get('behavior-score/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get behavior score for session' })
  async getBehaviorScore(@Param('sessionId') sessionId: string) {
    return await this.behaviorService.calculateBehaviorScore(sessionId);
  }

  @Get('behavior-summary/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get behavior summary for report' })
  async getBehaviorSummary(@Param('sessionId') sessionId: string) {
    return await this.behaviorService.generateBehaviorSummary(sessionId);
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
  @ApiOperation({ summary: 'Periodic auto-capture during exam' })
  async capturePeriodicSnapshot(
    @Param('sessionId') sessionId: string,
    @Body() dto: DetectFacesDto
  ) {
    return await this.autoCaptureService.capturePeriodicSnapshot(
      sessionId,
      dto.image
    );
  }

  @Post('capture/manual/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manual capture by proctor' })
  async captureManual(
    @Param('sessionId') sessionId: string,
    @Body() dto: DetectFacesDto
  ) {
    return await this.autoCaptureService.captureManual(sessionId, dto.image);
  }

  @Get('captures/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all captures for session' })
  async getSessionCaptures(@Param('sessionId') sessionId: string) {
    return await this.autoCaptureService.getSessionCaptures(sessionId);
  }

  @Get('capture-stats/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get capture statistics' })
  async getCaptureStats(@Param('sessionId') sessionId: string) {
    return await this.autoCaptureService.getCaptureStats(sessionId);
  }

  @Post('detect-id-document')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detect ID document in image' })
  async detectIDDocument(@Body() dto: DetectFacesDto) {
    return await this.idDocumentService.detectDocument(dto.image);
  }

  @Post('validate-id-quality')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate ID document quality' })
  async validateIDQuality(@Body() dto: DetectFacesDto) {
    return await this.idDocumentService.validateIDQuality(dto.image);
  }
}
