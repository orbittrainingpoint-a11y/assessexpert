import { Module } from '@nestjs/common';
import { InterviewsController, InterviewsPublicController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { FacialRecognitionModule } from '../facial-recognition/facial-recognition.module';

@Module({
  imports: [NotificationsModule, FacialRecognitionModule],
  controllers: [InterviewsController, InterviewsPublicController],
  providers: [InterviewsService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
