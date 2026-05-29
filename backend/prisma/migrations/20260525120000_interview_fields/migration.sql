-- Interview model extensions: HR-driven interview flow.
--
-- Adds magic-link candidate join, FR-vs-reference-photo verification
-- fields, manual-verify by HR, and the structured columns the
-- previous interviews.service was already writing to via a try/catch
-- that silently swallowed the missing columns (scheduledBy, endedAt,
-- impression, recommendation).
--
-- NOT NULL on magicToken + tokenExpiresAt is safe: existing row count
-- is zero (the previous Interview table was unused scaffolding).

ALTER TABLE "Interview"
  ADD COLUMN "scheduledBy"      TEXT,
  ADD COLUMN "hrUserId"         TEXT,
  ADD COLUMN "magicToken"       TEXT NOT NULL,
  ADD COLUMN "tokenExpiresAt"   TIMESTAMP(3) NOT NULL,
  ADD COLUMN "startedAt"        TIMESTAMP(3),
  ADD COLUMN "endedAt"          TIMESTAMP(3),
  ADD COLUMN "impression"       TEXT,
  ADD COLUMN "recommendation"   TEXT,
  ADD COLUMN "frVerdict"        TEXT,
  ADD COLUMN "frSimilarity"     DOUBLE PRECISION,
  ADD COLUMN "frCheckedAt"      TIMESTAMP(3),
  ADD COLUMN "manualVerified"   BOOLEAN,
  ADD COLUMN "manualVerifyNote" TEXT;

CREATE UNIQUE INDEX "Interview_magicToken_key"
  ON "Interview"("magicToken");

CREATE INDEX "Interview_organizationId_status_scheduledAt_idx"
  ON "Interview"("organizationId", "status", "scheduledAt");

CREATE INDEX "Interview_candidateId_idx"
  ON "Interview"("candidateId");
