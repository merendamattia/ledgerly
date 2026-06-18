-- AlterTable
ALTER TABLE "cron_run" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "log" TEXT;
