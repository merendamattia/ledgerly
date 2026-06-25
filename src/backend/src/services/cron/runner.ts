import type { CronRun, CronTrigger } from "@prisma/client";
import { cronRepository } from "../../repositories/cron.ts";
import { logger } from "../../core/logger.ts";

// Default retry policy for scheduled jobs: up to 5 attempts, 30s apart. Manual
// triggers override maxAttempts to 1 so the HTTP request doesn't hang on retries.
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 30_000;

export interface RunOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
}

/** Waits for the configured retry delay between cron job attempts. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Returns the current timestamp for cron run log lines. */
const stamp = () => new Date().toISOString();

/**
 * Execute a unit of work as a tracked cron run: opens a CronRun (status RUNNING),
 * runs `work`, then closes it as SUCCESS or FAILED. `work` returns the number of
 * processed items. On failure the work is retried up to `maxAttempts` times,
 * waiting `retryDelayMs` between tries; every attempt is appended to the run's
 * `log` so the UI can show the full detail. Errors are captured, not rethrown.
 */
export async function runTrackedJob(
  jobKey: string,
  work: () => Promise<number>,
  triggeredBy: CronTrigger,
  options: RunOptions = {},
): Promise<CronRun> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const job = await cronRepository.findJobByKey(jobKey);
  if (!job) throw new Error(`Unknown cron job: ${jobKey}`);

  const run = await cronRepository.startRun(job.id, triggeredBy);
  const log: string[] = [];
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const items = await work();
      log.push(`[${stamp()}] attempt ${attempt}/${maxAttempts}: success — ${items} item(s)`);
      await cronRepository.touchJob(job.id);
      logger.info("Cron job succeeded", { jobKey, items, attempt, triggeredBy });
      return cronRepository.finishRun(run.id, "SUCCESS", items, {
        attempts: attempt,
        error: null,
        log: log.join("\n"),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log.push(`[${stamp()}] attempt ${attempt}/${maxAttempts}: failed — ${lastError}`);
      logger.error("Cron job attempt failed", { jobKey, attempt, error: lastError, triggeredBy });
      if (attempt < maxAttempts) {
        log.push(`[${stamp()}] retrying in ${Math.round(retryDelayMs / 1000)}s…`);
        await sleep(retryDelayMs);
      }
    }
  }

  await cronRepository.touchJob(job.id);
  logger.error("Cron job failed after retries", {
    jobKey,
    attempts: maxAttempts,
    error: lastError,
    triggeredBy,
  });
  return cronRepository.finishRun(run.id, "FAILED", 0, {
    attempts: maxAttempts,
    error: lastError,
    log: log.join("\n"),
  });
}
