-- Super-admin opt-in feature flag for the MCQ-only Quiz mode per Organization.
ALTER TABLE "Organization" ADD COLUMN "quizEnabled" BOOLEAN NOT NULL DEFAULT false;
