import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { GatewayModule } from '../gateway/gateway.module';
import { AiTranscriptionModule } from '../ai-transcription/ai-transcription.module';
import { RecordingsModule } from '../recordings/recordings.module';
import { AdminModule } from '../admin/admin.module';
import { PracticalSetsModule } from '../practical-sets/practical-sets.module';

@Module({
  imports: [GatewayModule, AiTranscriptionModule, RecordingsModule, AdminModule, PracticalSetsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
