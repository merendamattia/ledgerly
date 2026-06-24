-- CreateEnum
CREATE TYPE "RecurInterval" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "RecurEndMode" AS ENUM ('NEVER', 'AFTER_OCCURRENCES', 'ON_DATE');

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "recurringExpenseId" TEXT;

-- CreateTable
CREATE TABLE "recurring_expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "amount" DECIMAL(20,2) NOT NULL,
    "direction" "TxDirection" NOT NULL,
    "note" TEXT,
    "intervalUnit" "RecurInterval" NOT NULL,
    "intervalCount" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "nextRunDate" DATE NOT NULL,
    "endMode" "RecurEndMode" NOT NULL DEFAULT 'NEVER',
    "maxOccurrences" INTEGER,
    "endDate" DATE,
    "occurrencesCount" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_expense_nextRunDate_idx" ON "recurring_expense"("nextRunDate");

-- CreateIndex
CREATE INDEX "transaction_recurringExpenseId_idx" ON "transaction"("recurringExpenseId");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "recurring_expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
