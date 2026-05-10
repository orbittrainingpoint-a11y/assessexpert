import { Module } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';
import { MediaPipeController } from './mediapipe.controller';
import { MultipleFaceDetectionService } from './multiple-face-detection.service';
import { RealTimeMonitoringService } from './realtime-monitoring.service';
import { PoseDetectionService } from './pose-detection.service';
import { HandDetectionService } from './hand-detection.service';
import { GazeTrackingService } from './gaze-tracking.service';
import { BehaviorAnalysisService } from './behavior-analysis.service';
import { AutoCaptureService } from './auto-capture.service';
import { IDDocumentDetectionService } from './id-document-detection.service';
import { ProctoringModule } from '../proctoring/proctoring.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [ProctoringModule, GatewayModule],
  providers: [
    MediaPipeService,
    MultipleFaceDetectionService,
    RealTimeMonitoringService,
    PoseDetectionService,
    HandDetectionService,
    GazeTrackingService,
    BehaviorAnalysisService,
    AutoCaptureService,
    IDDocumentDetectionService,
  ],
  controllers: [MediaPipeController],
  exports: [
    MediaPipeService,
    MultipleFaceDetectionService,
    RealTimeMonitoringService,
    PoseDetectionService,
    HandDetectionService,
    GazeTrackingService,
    BehaviorAnalysisService,
    AutoCaptureService,
    IDDocumentDetectionService,
  ],
})
export class MediaPipeModule {}
