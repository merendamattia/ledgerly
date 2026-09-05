ALTER TABLE "transaction"
  ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "apple_wallet_import"
  ADD COLUMN "aiModel" TEXT,
  ADD COLUMN "aiInputTokens" INTEGER,
  ADD COLUMN "aiOutputTokens" INTEGER,
  ADD COLUMN "aiTotalTokens" INTEGER,
  ADD COLUMN "normalizedResult" JSONB,
  ADD COLUMN "integrationTokenPrefix" TEXT,
  ADD COLUMN "integrationTokenSuffix" TEXT;

CREATE INDEX "apple_wallet_import_userId_status_createdAt_idx"
  ON "apple_wallet_import"("userId", "status", "createdAt");
CREATE INDEX "apple_wallet_import_status_createdAt_idx"
  ON "apple_wallet_import"("status", "createdAt");
