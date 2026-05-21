-- Unify single-candidate and multi-candidate sessions.
--
-- After this migration:
--   - every ExamSession is treated as multi-candidate (N may be 1)
--   - every ExamSession has at least one SessionCandidate row (the primary)
--   - the frontend renders one UI for both N=1 and N>1
--
-- This is a backfill-only migration: no schema changes. The
-- `isMultiCandidate` column stays for compatibility with existing
-- service code that still branches on it (gracefully treats every row
-- as multi after this).

-- pgcrypto provides gen_random_uuid(). Already a default extension on
-- modern Postgres but explicit-enable here is a no-op when present.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Backfill SessionCandidate for every primary candidate that doesn't
--    already have one. The NOT EXISTS predicate no-ops on sessions that
--    were already promoted by the auto-merge code path.
INSERT INTO "SessionCandidate" ("id", "sessionId", "candidateId", "status", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    s."id",
    s."candidateId",
    'PENDING'::"CandidateSessionStatus",
    NOW(),
    NOW()
FROM "ExamSession" s
WHERE NOT EXISTS (
    SELECT 1 FROM "SessionCandidate" sc
    WHERE sc."sessionId" = s."id" AND sc."candidateId" = s."candidateId"
);

-- 2) Flip every existing session to multi-candidate. New rows already
--    default to true via the application code; this catches legacy data.
UPDATE "ExamSession" SET "isMultiCandidate" = TRUE WHERE "isMultiCandidate" = FALSE;
