import { Module } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';
import { MediaPipeController } from './mediapipe.controller';
import { AutoCaptureService } from './auto-capture.service';

// What's left after the batch-20 cleanup:
// - MediaPipeService: real face-landmark + embedding extractor used by
//   FacialRecognitionService for pre-exam and periodic FR checks.
// - AutoCaptureService: stores ID-verification snapshots + serves the
//   capture gallery. Periodic / manual capture flows are unused from
//   the frontend but the methods stay so the gallery's existing data
//   keeps rendering.
//
// The seven detection services (multiple-face, pose, hand, gaze,
// realtime-monitoring, behavior-analysis, id-document) were placeholder
// implementations that nothing in the app actually called — frontend
// observability is done client-side via useFaceDetection (lib hook).
@Module({
  providers: [MediaPipeService, AutoCaptureService],
  controllers: [MediaPipeController],
  exports: [MediaPipeService, AutoCaptureService],
})
export class MediaPipeModule {}
