CREATE TYPE "AppleWalletImportStatus" AS ENUM (
  'PENDING',
  'QUEUED',
  'RUNNING',
  'RETRYING',
  'COMPLETED',
  'FAILED'
);

ALTER TABLE "Settings"
  ADD COLUMN "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "apple_wallet_import" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "AppleWalletImportStatus" NOT NULL DEFAULT 'PENDING',
  "queueJobId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "queuedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "transactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "apple_wallet_import_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "transactionId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpointHash" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "apple_wallet_import_queueJobId_key" ON "apple_wallet_import"("queueJobId");
CREATE UNIQUE INDEX "apple_wallet_import_transactionId_key" ON "apple_wallet_import"("transactionId");
CREATE UNIQUE INDEX "apple_wallet_import_userId_idempotencyKey_key" ON "apple_wallet_import"("userId", "idempotencyKey");
CREATE INDEX "apple_wallet_import_userId_createdAt_idx" ON "apple_wallet_import"("userId", "createdAt");
CREATE INDEX "apple_wallet_import_status_heartbeatAt_idx" ON "apple_wallet_import"("status", "heartbeatAt");
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");
CREATE UNIQUE INDEX "push_subscription_endpointHash_key" ON "push_subscription"("endpointHash");
CREATE INDEX "push_subscription_userId_idx" ON "push_subscription"("userId");

ALTER TABLE "apple_wallet_import" ADD CONSTRAINT "apple_wallet_import_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "apple_wallet_import" ADD CONSTRAINT "apple_wallet_import_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
