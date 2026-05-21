-- Add timezone column to Organization. Defaults to Asia/Dubai so any
-- existing rows keep the old hardcoded behavior (every email used to
-- format times in Asia/Dubai regardless of the candidate). New customers
-- can change this from the admin UI.
ALTER TABLE "Organization" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai';
