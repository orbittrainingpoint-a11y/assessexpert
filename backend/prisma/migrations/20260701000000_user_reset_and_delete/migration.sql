-- Adds password-reset flow fields + soft-delete audit column + DELETED
-- enum value for the UserStatus enum. All additive; safe to run against
-- any existing DB without data migration.

-- 1. Extend the UserStatus enum with DELETED
ALTER TYPE "UserStatus" ADD VALUE 'DELETED';

-- 2. Add password reset + soft-delete fields to User
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 3. Unique index on the reset token so the DB rejects any accidental
--    duplication (the auth service generates 32-byte random tokens, so
--    collision is astronomical, but the index also protects a future
--    admin action from reusing a token).
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
