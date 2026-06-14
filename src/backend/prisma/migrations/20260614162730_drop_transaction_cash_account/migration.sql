/*
  Warnings:

  - You are about to drop the column `cashAccountId` on the `transaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_cashAccountId_fkey";

-- AlterTable
ALTER TABLE "transaction" DROP COLUMN "cashAccountId";
