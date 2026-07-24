-- Account safety fields — email verification + login lockout +
-- MFA backup codes. All additive; safe to run against any existing DB.

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");
