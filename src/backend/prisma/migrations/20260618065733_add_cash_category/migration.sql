-- CreateEnum
CREATE TYPE "CashCategory" AS ENUM ('LIQUIDITY', 'CREDIT', 'OTHER_ASSET');

-- AlterTable
ALTER TABLE "cash_account" ADD COLUMN     "category" "CashCategory" NOT NULL DEFAULT 'LIQUIDITY';
