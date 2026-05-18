import { Module } from '@nestjs/common';
import { AiTranscriptionService } from './ai-transcription.service';

@Module({
  providers: [AiTranscriptionService],
  exports: [AiTranscriptionService],
})
export class AiTranscriptionModule {}
