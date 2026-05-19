import { Module } from '@nestjs/common';
import { FacialRecognitionController } from './facial-recognition.controller';
import { FacialRecognitionService } from './facial-recognition.service';
import { MediaPipeModule } from '../mediapipe/mediapipe.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [MediaPipeModule, GatewayModule],
  controllers: [FacialRecognitionController],
  providers: [FacialRecognitionService],
  exports: [FacialRecognitionService],
})
export class FacialRecognitionModule {}
