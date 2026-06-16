-- CreateEnum
CREATE TYPE "InvestmentSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "cash_snapshot" (
    "id" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "balance" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOAN',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "amount" DECIMAL(20,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_transaction" (
    "id" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "side" "InvestmentSide" NOT NULL,
    "quantity" DECIMAL(28,10) NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_snapshot_cashAccountId_idx" ON "cash_snapshot"("cashAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_snapshot_cashAccountId_date_key" ON "cash_snapshot"("cashAccountId", "date");

-- CreateIndex
CREATE INDEX "investment_transaction_tickerId_idx" ON "investment_transaction"("tickerId");

-- CreateIndex
CREATE INDEX "investment_transaction_date_idx" ON "investment_transaction"("date");

-- AddForeignKey
ALTER TABLE "cash_snapshot" ADD CONSTRAINT "cash_snapshot_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "cash_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transaction" ADD CONSTRAINT "investment_transaction_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "ticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
