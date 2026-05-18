import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { GatewayModule } from '../gateway/gateway.module';
import { AiTranscriptionModule } from '../ai-transcription/ai-transcription.module';

@Module({
  imports: [GatewayModule, AiTranscriptionModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
