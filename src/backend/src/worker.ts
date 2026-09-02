import { Worker } from "bullmq";
import Redis from "ioredis";
import type { AppleWalletJobData } from "./core/appleWalletQueue.ts";
import { appleWalletQueueName, config } from "./core/config.ts";
import { logger } from "./core/logger.ts";
import { appleWalletImportRepository } from "./repositories/appleWalletImport.ts";
import { recoverQueuedAppleWalletImports } from "./services/appleWalletImport.ts";
import { processAppleWalletImport } from "./services/appleWalletWorker.ts";

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker<AppleWalletJobData>(
  appleWalletQueueName,
  async (job) =>
    processAppleWalletImport(job.data.importId, job.attemptsMade + 1, job.opts.attempts ?? 1),
  { connection, concurrency: config.APPLE_PAY_WORKER_CONCURRENCY },
);

async function recoverQueuedImports() {
  try {
    return await recoverQueuedAppleWalletImports();
  } catch (error) {
    logger.warn("Apple Wallet queue recovery failed", { error: String(error) });
    return 0;
  }
}

const recovered = await recoverQueuedImports();
const recoveryTimer = setInterval(() => void recoverQueuedImports(), 30_000);

worker.on("completed", (job, result) => logger.info("Apple Wallet import processed", { jobId: job.id, result }));
worker.on("failed", (job) => {
  logger.warn("Apple Wallet import attempt failed", { jobId: job?.id });
  if (job?.id && job.failedReason.includes("job stalled more than allowable limit")) {
    void appleWalletImportRepository.failStalled(job.data.importId);
  }
});
worker.on("error", (error) => logger.error("Apple Wallet worker error", { error: String(error) }));

logger.info("Apple Wallet worker started", { concurrency: config.APPLE_PAY_WORKER_CONCURRENCY, recovered });

async function shutdown() {
  clearInterval(recoveryTimer);
  await worker.close();
  await connection.quit();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
