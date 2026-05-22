-- =============================================================================
-- AssessExpert — Consolidated migration (last 3 days: 2026-05-19 → 2026-05-22)
-- =============================================================================
-- Combines these 6 Prisma migrations, in order:
--   1. 20260519080000_session_candidate_recording_paths
--   2. 20260519100000_per_candidate_practical
--   3. 20260519120000_fr_log_candidate_id
--   4. 20260520120000_unify_to_multi_candidate
--   5. 20260520140000_org_timezone
--   6. 20260521161950_add_cms_models
--
-- PREFERRED WAY TO APPLY (handles ordering, the enum step, and Prisma's
-- migration history automatically):
--     cd backend && npx prisma migrate deploy
--
-- This file is for manual / DBA review or for a hand-applied run. It is
-- written to be IDEMPOTENT (safe to re-run) and does NOT wrap everything in
-- one transaction, because `ALTER TYPE ... ADD VALUE` (section 6) cannot run
-- inside a transaction on PostgreSQL < 12 and the new value can't be used in
-- the same transaction on any version.
--
-- IMPORTANT: if you apply this file by hand, Prisma's `_prisma_migrations`
-- table will NOT know these ran. To keep `migrate deploy` happy afterwards,
-- mark each as applied (see the block at the very bottom), OR just use
-- `migrate deploy` in the first place and ignore this file.
-- Requires PostgreSQL 12+ (uses ALTER TYPE ADD VALUE outside an explicit txn).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) 20260519080000_session_candidate_recording_paths
--    Per-candidate webcam/screen recording paths.
-- -----------------------------------------------------------------------------
ALTER TABLE "SessionCandidate" ADD COLUMN IF NOT EXISTS "screenRecordingPath" TEXT;
ALTER TABLE "SessionCandidate" ADD COLUMN IF NOT EXISTS "webcamRecordingPath" TEXT;


-- -----------------------------------------------------------------------------
-- 2) 20260519100000_per_candidate_practical
--    Per-candidate practical assignment + answer attribution.
-- -----------------------------------------------------------------------------
ALTER TABLE "SessionCandidate" ADD COLUMN IF NOT EXISTS "practicalPaperSetId" TEXT;
ALTER TABLE "SessionCandidate" ADD COLUMN IF NOT EXISTS "practicalTaskId" TEXT;

-- PracticalAnswer.candidateId — add, backfill from the session's candidate,
-- then enforce NOT NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PracticalAnswer' AND column_name = 'candidateId'
  ) THEN
    ALTER TABLE "PracticalAnswer" ADD COLUMN "candidateId" TEXT;
    UPDATE "PracticalAnswer" pa
      SET "candidateId" = es."candidateId"
      FROM "ExamSession" es
      WHERE pa."sessionId" = es."id" AND pa."candidateId" IS NULL;
    ALTER TABLE "PracticalAnswer" ALTER COLUMN "candidateId" SET NOT NULL;
  END IF;
END $$;

-- Foreign keys for the new SessionCandidate columns.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SessionCandidate_practicalPaperSetId_fkey') THEN
    ALTER TABLE "SessionCandidate"
      ADD CONSTRAINT "SessionCandidate_practicalPaperSetId_fkey"
      FOREIGN KEY ("practicalPaperSetId") REFERENCES "PracticalPaperSet"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SessionCandidate_practicalTaskId_fkey') THEN
    ALTER TABLE "SessionCandidate"
      ADD CONSTRAINT "SessionCandidate_practicalTaskId_fkey"
      FOREIGN KEY ("practicalTaskId") REFERENCES "PracticalTask"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Swap PracticalAnswer uniqueness to (sessionId, candidateId, questionId).
ALTER TABLE "PracticalAnswer" DROP CONSTRAINT IF EXISTS "PracticalAnswer_sessionId_questionId_key";
DROP INDEX IF EXISTS "PracticalAnswer_sessionId_questionId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PracticalAnswer_sessionId_candidateId_questionId_key"
  ON "PracticalAnswer"("sessionId", "candidateId", "questionId");
CREATE INDEX IF NOT EXISTS "PracticalAnswer_sessionId_candidateId_idx"
  ON "PracticalAnswer"("sessionId", "candidateId");


-- -----------------------------------------------------------------------------
-- 3) 20260519120000_fr_log_candidate_id
--    Attribute each periodic FR check to the right candidate.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'FacialRecognitionLog' AND column_name = 'candidateId'
  ) THEN
    ALTER TABLE "FacialRecognitionLog" ADD COLUMN "candidateId" TEXT;
    UPDATE "FacialRecognitionLog" frl
      SET "candidateId" = es."candidateId"
      FROM "ExamSession" es
      WHERE frl."sessionId" = es."id" AND frl."candidateId" IS NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "FacialRecognitionLog_sessionId_candidateId_idx"
  ON "FacialRecognitionLog"("sessionId", "candidateId");


-- -----------------------------------------------------------------------------
-- 4) 20260520120000_unify_to_multi_candidate
--    Backfill: every session gets a SessionCandidate row; all multi-candidate.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "SessionCandidate" ("id", "sessionId", "candidateId", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", s."candidateId", 'PENDING'::"CandidateSessionStatus", NOW(), NOW()
FROM "ExamSession" s
WHERE NOT EXISTS (
  SELECT 1 FROM "SessionCandidate" sc
  WHERE sc."sessionId" = s."id" AND sc."candidateId" = s."candidateId"
);

UPDATE "ExamSession" SET "isMultiCandidate" = TRUE WHERE "isMultiCandidate" = FALSE;


-- -----------------------------------------------------------------------------
-- 5) 20260520140000_org_timezone
-- -----------------------------------------------------------------------------
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai';


-- -----------------------------------------------------------------------------
-- 6) 20260521161950_add_cms_models
--    CMS tables + CMS roles. (ALTER TYPE ADD VALUE must be outside a txn.)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CmsContentStatus') THEN
    CREATE TYPE "CmsContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');
  END IF;
END $$;

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CMS_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CMS_EDITOR';

DROP INDEX IF EXISTS "PracticalAnswer_sessionId_idx";

CREATE TABLE IF NOT EXISTS "CmsPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CmsContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "content" JSONB NOT NULL DEFAULT '{}',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CmsPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CmsContentStatus" NOT NULL DEFAULT 'DRAFT',
    "authorName" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CmsPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CmsMedia" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CmsMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPage_slug_key" ON "CmsPage"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "CmsPost_slug_key" ON "CmsPost"("slug");
CREATE INDEX IF NOT EXISTS "CmsPost_status_publishedAt_idx" ON "CmsPost"("status", "publishedAt");


-- =============================================================================
-- OPTIONAL — only if you applied this file BY HAND (not via migrate deploy).
-- Tell Prisma these migrations are already applied so the next deploy
-- doesn't try to re-run them. Run from the backend dir:
--
--   for m in 20260519080000_session_candidate_recording_paths \
--            20260519100000_per_candidate_practical \
--            20260519120000_fr_log_candidate_id \
--            20260520120000_unify_to_multi_candidate \
--            20260520140000_org_timezone \
--            20260521161950_add_cms_models; do
--     npx prisma migrate resolve --applied "$m"
--   done
-- =============================================================================
