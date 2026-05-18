import { Module } from '@nestjs/common';
import { ExamDeliveryController } from './exam-delivery.controller';
import { ExamDeliveryService } from './exam-delivery.service';
import { QuestionsModule } from '../questions/questions.module';
import { SessionsModule } from '../sessions/sessions.module';
import { GatewayModule } from '../gateway/gateway.module';
import { FacialRecognitionModule } from '../facial-recognition/facial-recognition.module';
import { AiTranscriptionModule } from '../ai-transcription/ai-transcription.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [QuestionsModule, SessionsModule, GatewayModule, FacialRecognitionModule, AiTranscriptionModule, PrismaModule],
  controllers: [ExamDeliveryController],
  providers: [ExamDeliveryService],
  exports: [ExamDeliveryService],
})
export class ExamDeliveryModule {}
