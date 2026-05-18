-- Per-candidate recording paths. Multi-candidate slots need separate
-- webcam.webm / screen.webm per candidate; the existing session-level
-- columns on ExamSession stay for single-candidate sessions and are
-- ignored by the finalizer when the session is multi-candidate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SessionCandidate' AND column_name = 'screenRecordingPath'
  ) THEN
    ALTER TABLE "SessionCandidate" ADD COLUMN "screenRecordingPath" TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SessionCandidate' AND column_name = 'webcamRecordingPath'
  ) THEN
    ALTER TABLE "SessionCandidate" ADD COLUMN "webcamRecordingPath" TEXT;
  END IF;
END $$;
