CREATE TYPE "FinancialForecastGenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "FinancialAnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "financial_forecast_state" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "FinancialForecastGenerationStatus" NOT NULL DEFAULT 'PENDING',
  "queueJobId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_forecast_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_forecast_snapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataCutoff" DATE NOT NULL,
  "effectiveLookbackMonths" INTEGER NOT NULL,
  "observationMonths" INTEGER NOT NULL,
  "simulationCount" INTEGER NOT NULL,
  "maxHorizonMonths" INTEGER NOT NULL,
  "seed" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "analysisStatus" "FinancialAnalysisStatus" NOT NULL DEFAULT 'PENDING',
  "analysisQueueJobId" TEXT,
  "analysisQueuedAt" TIMESTAMP(3),
  "analysisStartedAt" TIMESTAMP(3),
  "analysisCompletedAt" TIMESTAMP(3),
  "analysisFailedAt" TIMESTAMP(3),
  "analysisContent" JSONB,
  "analysisError" TEXT,
  CONSTRAINT "financial_forecast_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_forecast_state_userId_key" ON "financial_forecast_state"("userId");
CREATE UNIQUE INDEX "financial_forecast_state_queueJobId_key" ON "financial_forecast_state"("queueJobId");
CREATE UNIQUE INDEX "financial_forecast_snapshot_analysisQueueJobId_key" ON "financial_forecast_snapshot"("analysisQueueJobId");
CREATE INDEX "financial_forecast_snapshot_userId_generatedAt_idx" ON "financial_forecast_snapshot"("userId", "generatedAt");

ALTER TABLE "financial_forecast_state"
  ADD CONSTRAINT "financial_forecast_state_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_forecast_snapshot"
  ADD CONSTRAINT "financial_forecast_snapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
