-- Per-candidate practical assignment + answers.
--
-- Multi-candidate slots need independent practical paper sets / tasks and
-- answer buckets per candidate. The session-level columns on ExamSession
-- stay populated for single-candidate sessions (backward compat) but are
-- ignored on multi-candidate sessions in favour of the SessionCandidate
-- row. PracticalAnswer.candidateId is required so two candidates in the
-- same slot don't overwrite each other's answers via the existing
-- (sessionId, questionId) unique key.
DO $$
BEGIN
  -- 1) Per-candidate practical assignment fields on SessionCandidate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SessionCandidate' AND column_name = 'practicalPaperSetId'
  ) THEN
    ALTER TABLE "SessionCandidate" ADD COLUMN "practicalPaperSetId" TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SessionCandidate' AND column_name = 'practicalTaskId'
  ) THEN
    ALTER TABLE "SessionCandidate" ADD COLUMN "practicalTaskId" TEXT;
  END IF;

  -- 2) PracticalAnswer.candidateId — backfill from session.candidateId
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

-- 3) Foreign keys for the new columns. Created separately because we can't
-- create FKs inside the DO $$ block without dynamic SQL ceremony.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SessionCandidate_practicalPaperSetId_fkey'
  ) THEN
    ALTER TABLE "SessionCandidate"
      ADD CONSTRAINT "SessionCandidate_practicalPaperSetId_fkey"
      FOREIGN KEY ("practicalPaperSetId") REFERENCES "PracticalPaperSet"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SessionCandidate_practicalTaskId_fkey'
  ) THEN
    ALTER TABLE "SessionCandidate"
      ADD CONSTRAINT "SessionCandidate_practicalTaskId_fkey"
      FOREIGN KEY ("practicalTaskId") REFERENCES "PracticalTask"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Swap PracticalAnswer's uniqueness from (sessionId, questionId) to
-- (sessionId, candidateId, questionId) so each candidate in a slot has
-- their own row per question.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'PracticalAnswer_sessionId_questionId_key'
  ) THEN
    ALTER TABLE "PracticalAnswer" DROP CONSTRAINT IF EXISTS "PracticalAnswer_sessionId_questionId_key";
    DROP INDEX IF EXISTS "PracticalAnswer_sessionId_questionId_key";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'PracticalAnswer_sessionId_candidateId_questionId_key'
  ) THEN
    CREATE UNIQUE INDEX "PracticalAnswer_sessionId_candidateId_questionId_key"
      ON "PracticalAnswer"("sessionId", "candidateId", "questionId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'PracticalAnswer_sessionId_candidateId_idx'
  ) THEN
    CREATE INDEX "PracticalAnswer_sessionId_candidateId_idx"
      ON "PracticalAnswer"("sessionId", "candidateId");
  END IF;
END $$;
