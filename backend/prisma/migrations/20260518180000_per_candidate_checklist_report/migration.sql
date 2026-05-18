-- Per-candidate ProctorChecklist and Report. Multi-candidate slots need
-- ONE row per candidate so the proctor's verification state and the final
-- report are independent. Single-candidate sessions are backfilled with
-- the session's primary candidate, so behaviour stays identical.

-- ─── ProctorChecklist.candidateId ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ProctorChecklist' AND column_name = 'candidateId'
  ) THEN
    ALTER TABLE "ProctorChecklist" ADD COLUMN "candidateId" TEXT;
    UPDATE "ProctorChecklist" pc
       SET "candidateId" = es."candidateId"
      FROM "ExamSession" es
     WHERE pc."sessionId" = es."id"
       AND pc."candidateId" IS NULL;
    ALTER TABLE "ProctorChecklist" ALTER COLUMN "candidateId" SET NOT NULL;
  END IF;

  -- Drop the old sessionId @unique constraint.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ProctorChecklist' AND indexname = 'ProctorChecklist_sessionId_key'
  ) THEN
    ALTER TABLE "ProctorChecklist" DROP CONSTRAINT IF EXISTS "ProctorChecklist_sessionId_key";
    DROP INDEX IF EXISTS "ProctorChecklist_sessionId_key";
  END IF;

  -- Add the composite unique.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ProctorChecklist'
      AND indexname = 'ProctorChecklist_sessionId_candidateId_key'
  ) THEN
    CREATE UNIQUE INDEX "ProctorChecklist_sessionId_candidateId_key"
      ON "ProctorChecklist"("sessionId", "candidateId");
  END IF;
END $$;

-- ─── Report: drop sessionId @unique, add composite ──────────────────────
DO $$
BEGIN
  -- candidateId already exists on Report (declared in earlier schema),
  -- so only the unique-constraint swap is needed here.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'Report' AND indexname = 'Report_sessionId_key'
  ) THEN
    ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_sessionId_key";
    DROP INDEX IF EXISTS "Report_sessionId_key";
  END IF;

  -- Backfill any rows where candidateId is somehow NULL (shouldn't be,
  -- but defensive — the column was NOT NULL in the previous schema).
  UPDATE "Report" r
     SET "candidateId" = es."candidateId"
    FROM "ExamSession" es
   WHERE r."sessionId" = es."id"
     AND r."candidateId" IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'Report'
      AND indexname = 'Report_sessionId_candidateId_key'
  ) THEN
    CREATE UNIQUE INDEX "Report_sessionId_candidateId_key"
      ON "Report"("sessionId", "candidateId");
  END IF;
END $$;
