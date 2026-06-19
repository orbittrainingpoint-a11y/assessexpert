import { Module } from '@nestjs/common';
import { QuizController, QuizPublicController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [QuizController, QuizPublicController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
