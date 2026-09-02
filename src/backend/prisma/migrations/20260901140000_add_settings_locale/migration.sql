ALTER TABLE "Settings" ADD COLUMN "locale" TEXT;

-- Existing users keep today's English behavior. Newly provisioned settings
-- remain NULL until the user completes language onboarding.
UPDATE "Settings" SET "locale" = 'en';
