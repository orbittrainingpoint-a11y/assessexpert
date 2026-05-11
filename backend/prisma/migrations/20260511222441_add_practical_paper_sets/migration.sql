-- CreateEnum
CREATE TYPE "PracticalAnswerType" AS ENUM ('FILE_UPLOAD', 'NUMERIC', 'TEXT');

-- CreateEnum
CREATE TYPE "NumericMatchMode" AS ENUM ('EXACT', 'TOLERANCE');

-- CreateEnum
CREATE TYPE "TextMatchMode" AS ENUM ('EXACT', 'CONTAINS', 'MANUAL');

-- AlterTable
ALTER TABLE "ExamSession" ADD COLUMN     "practicalPaperSetId" TEXT;

-- CreateTable
CREATE TABLE "PracticalPaperSet" (
    "id" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticalPaperSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalSetFile" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticalSetFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalQuestion" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "answerType" "PracticalAnswerType" NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rubric" TEXT,
    "acceptedFileTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxFileSizeMB" INTEGER,
    "expectedNumericAnswer" DOUBLE PRECISION,
    "numericTolerance" DOUBLE PRECISION,
    "numericUnit" TEXT,
    "numericMatchMode" "NumericMatchMode" NOT NULL DEFAULT 'TOLERANCE',
    "expectedTextAnswer" TEXT,
    "textMatchMode" "TextMatchMode" NOT NULL DEFAULT 'MANUAL',
    "textCaseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalQuestionFile" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "PracticalQuestionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "uploadedFilePath" TEXT,
    "uploadedFileName" TEXT,
    "uploadedFileSize" INTEGER,
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "submittedAt" TIMESTAMP(3),
    "marks" DOUBLE PRECISION,
    "maxMarks" DOUBLE PRECISION,
    "isCorrect" BOOLEAN,
    "autoGraded" BOOLEAN NOT NULL DEFAULT false,
    "graderNotes" TEXT,
    "gradedAt" TIMESTAMP(3),
    "gradedBy" TEXT,

    CONSTRAINT "PracticalAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organizationId" TEXT,
    "invitedBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticalPaperSet_assessmentTypeId_status_idx" ON "PracticalPaperSet"("assessmentTypeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PracticalPaperSet_assessmentTypeId_name_key" ON "PracticalPaperSet"("assessmentTypeId", "name");

-- CreateIndex
CREATE INDEX "PracticalQuestion_setId_idx" ON "PracticalQuestion"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticalQuestion_setId_position_key" ON "PracticalQuestion"("setId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PracticalQuestionFile_questionId_fileId_key" ON "PracticalQuestionFile"("questionId", "fileId");

-- CreateIndex
CREATE INDEX "PracticalAnswer_sessionId_idx" ON "PracticalAnswer"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticalAnswer_sessionId_questionId_key" ON "PracticalAnswer"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_token_key" ON "UserInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_email_organizationId_key" ON "UserInvitation"("email", "organizationId");

-- AddForeignKey
ALTER TABLE "PracticalPaperSet" ADD CONSTRAINT "PracticalPaperSet_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "AssessmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalSetFile" ADD CONSTRAINT "PracticalSetFile_setId_fkey" FOREIGN KEY ("setId") REFERENCES "PracticalPaperSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalQuestion" ADD CONSTRAINT "PracticalQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "PracticalPaperSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalQuestionFile" ADD CONSTRAINT "PracticalQuestionFile_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PracticalQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalQuestionFile" ADD CONSTRAINT "PracticalQuestionFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "PracticalSetFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalAnswer" ADD CONSTRAINT "PracticalAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticalAnswer" ADD CONSTRAINT "PracticalAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PracticalQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_practicalPaperSetId_fkey" FOREIGN KEY ("practicalPaperSetId") REFERENCES "PracticalPaperSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
