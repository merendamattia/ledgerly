CREATE TYPE "ForecastGenerationStatus" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'READY', 'FAILED');

CREATE TABLE "user_forecast" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ForecastGenerationStatus" NOT NULL DEFAULT 'IDLE',
    "snapshotId" TEXT,
    "payload" JSONB,
    "generatedAt" TIMESTAMP(3),
    "sourceDataCutoff" TIMESTAMP(3),
    "queueJobId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_forecast_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_forecast_userId_key" ON "user_forecast"("userId");
CREATE UNIQUE INDEX "user_forecast_snapshotId_key" ON "user_forecast"("snapshotId");
CREATE UNIQUE INDEX "user_forecast_queueJobId_key" ON "user_forecast"("queueJobId");
CREATE INDEX "user_forecast_status_updatedAt_idx" ON "user_forecast"("status", "updatedAt");

ALTER TABLE "user_forecast" ADD CONSTRAINT "user_forecast_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
