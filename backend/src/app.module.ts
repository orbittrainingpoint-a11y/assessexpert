import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
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
import { TurnModule } from './modules/turn/turn.module';
import { PracticalSetsModule } from './modules/practical-sets/practical-sets.module';
import { LegalModule } from './modules/legal/legal.module';
import { CmsModule } from './modules/cms/cms.module';
import { RedisModule } from './modules/redis/redis.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Named throttle profiles so individual endpoints can opt into a
    // tighter budget than the global default. Stricter limits go on
    // the public, unauthenticated paths (login, OTP, magic-link verify)
    // and a separate generous one on recording-chunk uploads since the
    // candidate browser legitimately fires ~24 of those per minute.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 10 },         // login, OTP send/verify, magic-link
      { name: 'recording', ttl: 60_000, limit: 240 },   // 4 streams worst-case @ 12 chunks/min
    ]),
    PrismaModule,
    RedisModule,
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
    TurnModule,
    PracticalSetsModule,
    LegalModule,
    CmsModule,
  ],
  controllers: [AppController],
  providers: [
    // Audit log interceptor — emits an AuditLog row per authenticated
    // mutation. Registered via APP_INTERCEPTOR so it can DI PrismaService.
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
