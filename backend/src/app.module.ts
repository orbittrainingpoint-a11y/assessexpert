import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { PracticalTasksModule } from './modules/practical-tasks/practical-tasks.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { ChecklistModule } from './modules/checklist/checklist.module';
import { ExamDeliveryModule } from './modules/exam-delivery/exam-delivery.module';
import { ProctoringModule } from './modules/proctoring/proctoring.module';
import { FacialRecognitionModule } from './modules/facial-recognition/facial-recognition.module';
import { MediaPipeModule } from './modules/mediapipe/mediapipe.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { GradingModule } from './modules/grading/grading.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './modules/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { SalesModule } from './modules/sales/sales.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { JitsiModule } from './modules/jitsi/jitsi.module';
import { PracticalSetsModule } from './modules/practical-sets/practical-sets.module';
import { LegalModule } from './modules/legal/legal.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AssessmentsModule,
    QuestionsModule,
    PracticalTasksModule,
    CandidatesModule,
    SchedulingModule,
    SessionsModule,
    ChecklistModule,
    ExamDeliveryModule,
    ProctoringModule,
    FacialRecognitionModule,
    MediaPipeModule,
    RecordingsModule,
    GradingModule,
    ReportsModule,
    NotificationsModule,
    StorageModule,
    AdminModule,
    SalesModule,
    GatewayModule,
    InterviewsModule,
    JitsiModule,
    PracticalSetsModule,
    LegalModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
