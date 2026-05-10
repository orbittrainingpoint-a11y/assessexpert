-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'SALES_AGENT', 'ORG_ADMIN', 'HR_MANAGER', 'HIRING_MANAGER', 'PROCTOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'INVITED', 'WAITING_ROOM', 'CHECKLIST', 'VERIFICATION_IN_PROGRESS', 'MCQ_IN_PROGRESS', 'MCQ_COMPLETE', 'PRACTICAL_IN_PROGRESS', 'SUBMITTED', 'GRADING', 'PENDING_PROCTOR_REVIEW', 'REPORT_PUBLISHED', 'CANCELLED', 'NO_SHOW', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'RETURNED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProctorVerdict" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL', 'FLAGGED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "PracticalQuality" AS ENUM ('EXCELLENT', 'GOOD', 'SATISFACTORY', 'POOR', 'DID_NOT_SUBMIT');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PracticalType" AS ENUM ('CAD', 'CODING', 'LAB', 'FILE', 'NONE');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CandidateSessionStatus" AS ENUM ('PENDING', 'JOINED', 'VERIFYING', 'VERIFIED', 'MCQ_IN_PROGRESS', 'MCQ_SUBMITTED', 'PRACTICAL_IN_PROGRESS', 'PRACTICAL_SUBMITTED', 'COMPLETED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('UPLOAD', 'MANUAL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('FACE_ABSENT', 'FACE_MULTIPLE', 'GAZE_OFFSCREEN', 'AUDIO_ANOMALY', 'TAB_SWITCH', 'COPY_PASTE_ATTEMPT', 'FULLSCREEN_EXIT', 'DUPLICATE_LOGIN', 'GUARDPRO_DISCONNECT', 'VM_DETECTED', 'PROCTOR_WARNING', 'SESSION_PAUSED', 'SESSION_TERMINATED');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('AI', 'GUARDPRO', 'PROCTOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('DISMISSED', 'CONFIRMED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "FREventType" AS ENUM ('PRE_EXAM_ID', 'PERIODIC_CHECK', 'LIVE_ANOMALY');

-- CreateEnum
CREATE TYPE "FROutcome" AS ENUM ('VERIFIED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'NEGOTIATING', 'CONVERTED', 'LOST');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tradingName" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "industry" TEXT NOT NULL,
    "size" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "address" TEXT,
    "taxRegNumber" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "brandingConfig" JSONB,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "assessmentCredits" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 5,
    "recordingRetentionDays" INTEGER NOT NULL DEFAULT 7,
    "reportingLanguage" TEXT NOT NULL DEFAULT 'en',
    "allowedAssessmentTypes" TEXT[],
    "accountTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "internalNotes" TEXT,
    "assignedSalesAgentId" TEXT,
    "primaryContactName" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactPhone" TEXT,
    "billingContactName" TEXT,
    "billingContactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "organizationId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "profilePhoto" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "certificationLevel" TEXT,
    "certificationDomains" TEXT[],
    "languages" TEXT[],
    "maxSessionsPerDay" INTEGER,
    "region" TEXT,
    "specialistDomains" TEXT[],
    "accessLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "jobRole" TEXT NOT NULL,
    "description" TEXT,
    "mcqTimeLimit" INTEGER NOT NULL DEFAULT 30,
    "mcqQuestionCount" INTEGER NOT NULL DEFAULT 25,
    "mcqPassThreshold" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "practicalType" "PracticalType" NOT NULL DEFAULT 'NONE',
    "practicalTimeLimit" INTEGER NOT NULL DEFAULT 60,
    "practicalPassThreshold" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "mcqWeight" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "practicalWeight" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "overallPassLogic" TEXT NOT NULL DEFAULT 'BOTH',
    "overallPassThreshold" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "requiresGuardPro" BOOLEAN NOT NULL DEFAULT false,
    "blockedApplications" TEXT[],
    "blockMultiMonitor" BOOLEAN NOT NULL DEFAULT false,
    "blockVirtualMachines" BOOLEAN NOT NULL DEFAULT false,
    "allowClipboard" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "content" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" JSONB NOT NULL,
    "explanation" TEXT,
    "difficulty" "Difficulty" NOT NULL,
    "domain" TEXT NOT NULL,
    "tags" TEXT[],
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionHistory" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionQuestionAssignment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionIds" TEXT[],
    "questionOrder" JSONB NOT NULL,
    "shuffleSeed" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByProctorId" TEXT NOT NULL,

    CONSTRAINT "SessionQuestionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalTask" (
    "id" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "type" "PracticalType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starterFilePath" TEXT,
    "starterFileName" TEXT,
    "rubricData" JSONB NOT NULL,
    "rubricFilePath" TEXT,
    "acceptedFileTypes" TEXT[],
    "difficulty" TEXT NOT NULL DEFAULT 'STANDARD',
    "estimatedMinutes" INTEGER,
    "evaluatorNotes" TEXT,
    "testCases" JSONB,
    "status" "TaskStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionHistory" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "jobPosition" TEXT NOT NULL,
    "yearsExperience" TEXT,
    "department" TEXT,
    "notes" TEXT,
    "batchId" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proctorId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "magicToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "tokenUsedAt" TIMESTAMP(3),
    "tokenUsedFromIp" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isMultiCandidate" BOOLEAN NOT NULL DEFAULT false,
    "checklistCompletedAt" TIMESTAMP(3),
    "mcqStartedAt" TIMESTAMP(3),
    "mcqSubmittedAt" TIMESTAMP(3),
    "practicalTaskId" TEXT,
    "practicalStartedAt" TIMESTAMP(3),
    "practicalSubmittedAt" TIMESTAMP(3),
    "practicalFilePath" TEXT,
    "practicalFileName" TEXT,
    "guardproConnected" BOOLEAN NOT NULL DEFAULT false,
    "candidateIp" TEXT,
    "screenRecordingPath" TEXT,
    "webcamRecordingPath" TEXT,
    "recordingExpiresAt" TIMESTAMP(3),
    "recordingPurged" BOOLEAN NOT NULL DEFAULT false,
    "integrityScore" DOUBLE PRECISION,
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "disqualifyReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCandidate" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "CandidateSessionStatus" NOT NULL DEFAULT 'PENDING',
    "socketId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "mcqStartedAt" TIMESTAMP(3),
    "mcqSubmittedAt" TIMESTAMP(3),
    "mcqScore" DOUBLE PRECISION,
    "practicalStartedAt" TIMESTAMP(3),
    "practicalSubmittedAt" TIMESTAMP(3),
    "practicalScore" DOUBLE PRECISION,
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "disqualifyReason" TEXT,
    "checklistCompleted" BOOLEAN NOT NULL DEFAULT false,
    "checklistData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "candidateResponse" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "correctAnswer" JSONB NOT NULL,
    "timeSpentSeconds" INTEGER NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctorChecklist" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "proctorId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "candidateNameConfirmed" TEXT,
    "candidateEmailConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "idPhotoPath" TEXT,
    "frVerificationResult" JSONB,
    "recordingConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "examGuidelinesDelivered" BOOLEAN NOT NULL DEFAULT false,
    "candidateAgreedToRules" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProctorChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "severity" "EventSeverity" NOT NULL,
    "source" "EventSource" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "screenshotPath" TEXT,
    "reviewedBy" TEXT,
    "reviewOutcome" "ReviewOutcome",
    "proctorNote" TEXT,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacialRecognitionLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "FREventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedImagePath" TEXT NOT NULL,
    "referenceImagePath" TEXT,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "outcome" "FROutcome" NOT NULL,
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "faceEmbedding" TEXT,
    "landmarkData" JSONB,
    "detectionMethod" TEXT NOT NULL DEFAULT 'MEDIAPIPE',
    "faceCount" INTEGER,
    "poseData" JSONB,

    CONSTRAINT "FacialRecognitionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "mcqScore" DOUBLE PRECISION NOT NULL,
    "mcqPassed" BOOLEAN NOT NULL,
    "mcqBreakdown" JSONB NOT NULL,
    "practicalScore" DOUBLE PRECISION,
    "practicalPassed" BOOLEAN,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "overallPassed" BOOLEAN NOT NULL,
    "integrityScore" DOUBLE PRECISION NOT NULL,
    "competencyRadar" JSONB,
    "aiNarrative" TEXT,
    "aiRecommendation" TEXT,
    "proctorNarrative" TEXT,
    "proctorVerdict" "ProctorVerdict",
    "practicalQuality" "PracticalQuality",
    "proctorOverrides" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "pdfPath" TEXT,
    "pdfVersion" INTEGER NOT NULL DEFAULT 1,
    "masterProctorReview" JSONB,
    "hrRating" INTEGER,
    "hrRatingNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "target" TEXT,
    "targetId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT NOT NULL,
    "chainHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "companySize" TEXT,
    "assessmentTypes" TEXT[],
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedAgentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctorAvailability" (
    "id" TEXT NOT NULL,
    "proctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideDate" TIMESTAMP(3),
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sessionId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'VIDEO',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "interviewers" TEXT[],
    "notes" TEXT,
    "verdict" TEXT,
    "recordingPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentType_shortCode_key" ON "AssessmentType"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "SessionQuestionAssignment_sessionId_key" ON "SessionQuestionAssignment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateRecord_email_organizationId_key" ON "CandidateRecord"("email", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSession_magicToken_key" ON "ExamSession"("magicToken");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCandidate_sessionId_candidateId_key" ON "SessionCandidate"("sessionId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ProctorChecklist_sessionId_key" ON "ProctorChecklist"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_sessionId_key" ON "Report"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSettings_key_key" ON "PlatformSettings"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionQuestionAssignment" ADD CONSTRAINT "SessionQuestionAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalTask" ADD CONSTRAINT "PracticalTask_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateRecord" ADD CONSTRAINT "CandidateRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_practicalTaskId_fkey" FOREIGN KEY ("practicalTaskId") REFERENCES "PracticalTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCandidate" ADD CONSTRAINT "SessionCandidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCandidate" ADD CONSTRAINT "SessionCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctorChecklist" ADD CONSTRAINT "ProctorChecklist_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacialRecognitionLog" ADD CONSTRAINT "FacialRecognitionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
