-- One-time reference photo captured at the candidate's first OTP-verified
-- session. Used as the baseline for facial recognition checks. Idempotent:
-- safe to re-run on a DB where the columns already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CandidateRecord' AND column_name = 'referencePhotoPath'
  ) THEN
    ALTER TABLE "CandidateRecord" ADD COLUMN "referencePhotoPath" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CandidateRecord' AND column_name = 'referencePhotoCapturedAt'
  ) THEN
    ALTER TABLE "CandidateRecord" ADD COLUMN "referencePhotoCapturedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CandidateRecord' AND column_name = 'referenceFaceEmbedding'
  ) THEN
    ALTER TABLE "CandidateRecord" ADD COLUMN "referenceFaceEmbedding" TEXT;
  END IF;
END $$;
