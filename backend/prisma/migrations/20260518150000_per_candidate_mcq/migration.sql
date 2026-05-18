-- Per-candidate MCQ delivery. Multi-candidate slots need their own
-- shuffled question order and their own answer bucket per candidate.
-- Existing rows are backfilled from ExamSession.candidateId so the
-- transition is non-destructive for single-candidate sessions.

-- ─── ExamAnswer.candidateId ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ExamAnswer' AND column_name = 'candidateId'
  ) THEN
    -- Add as nullable so the backfill can run, then enforce NOT NULL.
    ALTER TABLE "ExamAnswer" ADD COLUMN "candidateId" TEXT;
    UPDATE "ExamAnswer" ea
       SET "candidateId" = es."candidateId"
      FROM "ExamSession" es
     WHERE ea."sessionId" = es."id"
       AND ea."candidateId" IS NULL;
    ALTER TABLE "ExamAnswer" ALTER COLUMN "candidateId" SET NOT NULL;
  END IF;

  -- Helpful index for the per-candidate count() / find() queries.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ExamAnswer' AND indexname = 'ExamAnswer_sessionId_candidateId_idx'
  ) THEN
    CREATE INDEX "ExamAnswer_sessionId_candidateId_idx" ON "ExamAnswer"("sessionId", "candidateId");
  END IF;
END $$;

-- ─── SessionQuestionAssignment: one per (session, candidate) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SessionQuestionAssignment' AND column_name = 'candidateId'
  ) THEN
    ALTER TABLE "SessionQuestionAssignment" ADD COLUMN "candidateId" TEXT;
    UPDATE "SessionQuestionAssignment" sqa
       SET "candidateId" = es."candidateId"
      FROM "ExamSession" es
     WHERE sqa."sessionId" = es."id"
       AND sqa."candidateId" IS NULL;
    ALTER TABLE "SessionQuestionAssignment" ALTER COLUMN "candidateId" SET NOT NULL;
  END IF;

  -- Drop the old sessionId @unique constraint if it still exists.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'SessionQuestionAssignment'
      AND indexname = 'SessionQuestionAssignment_sessionId_key'
  ) THEN
    ALTER TABLE "SessionQuestionAssignment" DROP CONSTRAINT IF EXISTS "SessionQuestionAssignment_sessionId_key";
    DROP INDEX IF EXISTS "SessionQuestionAssignment_sessionId_key";
  END IF;

  -- Replace with the per-candidate composite unique.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'SessionQuestionAssignment'
      AND indexname = 'SessionQuestionAssignment_sessionId_candidateId_key'
  ) THEN
    CREATE UNIQUE INDEX "SessionQuestionAssignment_sessionId_candidateId_key"
      ON "SessionQuestionAssignment"("sessionId", "candidateId");
  END IF;
END $$;
