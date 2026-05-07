import { Module } from '@nestjs/common';
import { FacialRecognitionController } from './facial-recognition.controller';
import { FacialRecognitionService } from './facial-recognition.service';

@Module({
  controllers: [FacialRecognitionController],
  providers: [FacialRecognitionService],
  exports: [FacialRecognitionService],
})
export class FacialRecognitionModule {}
