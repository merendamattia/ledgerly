-- AlterTable
ALTER TABLE "investment_transaction" ADD COLUMN     "cashAccountId" TEXT;

-- CreateTable
CREATE TABLE "debt_snapshot" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debt_snapshot_debtId_idx" ON "debt_snapshot"("debtId");

-- CreateIndex
CREATE UNIQUE INDEX "debt_snapshot_debtId_date_key" ON "debt_snapshot"("debtId", "date");

-- CreateIndex
CREATE INDEX "investment_transaction_cashAccountId_idx" ON "investment_transaction"("cashAccountId");

-- AddForeignKey
ALTER TABLE "debt_snapshot" ADD CONSTRAINT "debt_snapshot_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transaction" ADD CONSTRAINT "investment_transaction_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "cash_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
