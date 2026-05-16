-- Append-only pre-exam verification transcript. Stored as JSON because the
-- shape is open-ended (utterance lines with speaker, candidateId, timestamp).
-- Idempotent: safe to re-run if the column already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ExamSession' AND column_name = 'verificationTranscript'
  ) THEN
    ALTER TABLE "ExamSession" ADD COLUMN "verificationTranscript" JSONB;
  END IF;
END $$;
