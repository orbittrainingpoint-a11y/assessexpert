import { Module } from '@nestjs/common';
import { ExamDeliveryController } from './exam-delivery.controller';
import { ExamDeliveryService } from './exam-delivery.service';
import { QuestionsModule } from '../questions/questions.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [QuestionsModule, SessionsModule],
  controllers: [ExamDeliveryController],
  providers: [ExamDeliveryService],
  exports: [ExamDeliveryService],
})
export class ExamDeliveryModule {}
