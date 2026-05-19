-- FacialRecognitionLog.candidateId — required so multi-candidate slots
-- attribute each periodic FR check to the right candidate. Nullable for
-- now to keep the migration safe on existing rows; backfilled from the
-- session's primary candidate then left nullable for legacy single-cam
-- callers that don't yet pass an id.
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'FacialRecognitionLog_sessionId_candidateId_idx'
  ) THEN
    CREATE INDEX "FacialRecognitionLog_sessionId_candidateId_idx"
      ON "FacialRecognitionLog"("sessionId", "candidateId");
  END IF;
END $$;
