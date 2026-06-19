-- Quiz mode: lightweight MCQ-only exam without camera/proctor
ALTER TABLE "ExamSession" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'PROCTORED';
ALTER TABLE "ExamSession" ADD COLUMN "quizOtpHash" TEXT;
ALTER TABLE "ExamSession" ADD COLUMN "quizOtpExpiresAt" TIMESTAMP(3);
CREATE INDEX "ExamSession_mode_idx" ON "ExamSession"("mode");
