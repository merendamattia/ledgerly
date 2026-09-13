import { Worker } from "bullmq";
import Redis from "ioredis";
import type { AppleWalletJobData } from "./core/appleWalletQueue.ts";
import type {
  FinancialForecastJobData,
  FinancialInterpretationJobData,
} from "./core/financialAnalysisQueue.ts";
import {
  appleWalletQueueName,
  config,
  financialForecastQueueName,
  financialInterpretationQueueName,
} from "./core/config.ts";
import { logger } from "./core/logger.ts";
import { appleWalletImportRepository } from "./repositories/appleWalletImport.ts";
import { financialForecastRepository } from "./repositories/financialForecast.ts";
import { recoverQueuedAppleWalletImports } from "./services/appleWalletImport.ts";
import { processAppleWalletImport } from "./services/appleWalletWorker.ts";
import {
  processFinancialForecast,
  recoverFinancialAnalysisJobs,
} from "./services/financialForecastGeneration.ts";
import { processFinancialInterpretation } from "./services/financialAnalysisWorker.ts";

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const walletWorker = new Worker<AppleWalletJobData>(
  appleWalletQueueName,
  async (job) =>
    processAppleWalletImport(job.data.importId, job.attemptsMade + 1, job.opts.attempts ?? 1),
  { connection, concurrency: config.APPLE_PAY_WORKER_CONCURRENCY },
);
const forecastWorker = new Worker<FinancialForecastJobData>(
  financialForecastQueueName,
  async (job) => processFinancialForecast(job.data.userId, job.data.generationId),
  { connection, concurrency: config.FINANCIAL_FORECAST_WORKER_CONCURRENCY },
);
const interpretationWorker = new Worker<FinancialInterpretationJobData>(
  financialInterpretationQueueName,
  async (job) =>
    processFinancialInterpretation(
      job.data.snapshotId,
      job.data.userId,
      job.data.locale,
      job.data.queueJobId,
    ),
  { connection, concurrency: config.FINANCIAL_ANALYSIS_WORKER_CONCURRENCY },
);

async function recoverQueuedImports() {
  try {
    return await recoverQueuedAppleWalletImports();
  } catch (error) {
    logger.warn("Apple Wallet queue recovery failed", { error: String(error) });
    return 0;
  }
}

async function recoverFinancialJobs() {
  try {
    return await recoverFinancialAnalysisJobs();
  } catch (error) {
    logger.warn("Financial analysis recovery failed", { error: String(error) });
    return { generations: 0, interpretations: 0 };
  }
}

const recovered = await recoverQueuedImports();
const financialRecovered = await recoverFinancialJobs();
const recoveryTimer = setInterval(() => void recoverQueuedImports(), 30_000);
const financialRecoveryTimer = setInterval(() => void recoverFinancialJobs(), 30_000);

walletWorker.on("completed", (job, result) => logger.info("Apple Wallet import processed", { jobId: job.id, result }));
walletWorker.on("failed", (job, error) => {
  logger.warn("Apple Wallet import attempt failed", {
    jobId: job?.id,
    importId: job?.data.importId,
    error: error instanceof Error ? error.message : String(error),
  });
  if (job?.id && job.failedReason.includes("job stalled more than allowable limit")) {
    void appleWalletImportRepository.failStalled(job.data.importId);
  }
});
walletWorker.on("error", (error) => logger.error("Apple Wallet worker error", { error: String(error) }));

forecastWorker.on("completed", (job, result) =>
  logger.info("Financial forecast processed", { jobId: job.id, userId: job.data.userId, result }),
);
forecastWorker.on("failed", (job, error) => {
  logger.warn("Financial forecast attempt failed", {
    jobId: job?.id,
    userId: job?.data.userId,
    error: error.message,
  });
  const terminal =
    job &&
    (job.failedReason.includes("job stalled more than allowable limit") ||
      job.attemptsMade >= (job.opts.attempts ?? 1));
  if (terminal) {
    void financialForecastRepository.failGeneration(
      job.data.userId,
      job.data.generationId,
      error.message,
    );
  }
});
forecastWorker.on("error", (error) =>
  logger.error("Financial forecast worker error", { error: String(error) }),
);

interpretationWorker.on("completed", (job, result) =>
  logger.info("Financial interpretation processed", {
    jobId: job.id,
    snapshotId: job.data.snapshotId,
    result,
  }),
);
interpretationWorker.on("failed", (job, error) => {
  logger.warn("Financial interpretation attempt failed", {
    jobId: job?.id,
    snapshotId: job?.data.snapshotId,
    error: error.message,
  });
  const terminal =
    job &&
    (job.failedReason.includes("job stalled more than allowable limit") ||
      job.attemptsMade >= (job.opts.attempts ?? 1));
  if (terminal) {
    void financialForecastRepository.failAnalysis(
      job.data.snapshotId,
      job.data.queueJobId,
      error.message,
    );
  }
});
interpretationWorker.on("error", (error) =>
  logger.error("Financial interpretation worker error", { error: String(error) }),
);

logger.info("Apple Wallet worker started", { concurrency: config.APPLE_PAY_WORKER_CONCURRENCY, recovered });
logger.info("Financial analysis workers started", {
  forecastConcurrency: config.FINANCIAL_FORECAST_WORKER_CONCURRENCY,
  interpretationConcurrency: config.FINANCIAL_ANALYSIS_WORKER_CONCURRENCY,
  recovered: financialRecovered,
});

async function shutdown() {
  clearInterval(recoveryTimer);
  clearInterval(financialRecoveryTimer);
  await Promise.all([walletWorker.close(), forecastWorker.close(), interpretationWorker.close()]);
  await connection.quit();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
