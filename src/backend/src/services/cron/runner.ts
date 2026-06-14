import type { CronRun, CronTrigger } from "@prisma/client";
import { cronRepository } from "../../repositories/cron.ts";
import { logger } from "../../core/logger.ts";

/**
 * Execute a unit of work as a tracked cron run: opens a CronRun (status RUNNING),
 * runs `work`, then closes it as SUCCESS or FAILED. `work` returns the number of
 * processed items. Errors are captured on the run, not rethrown.
 */
export async function runTrackedJob(
  jobKey: string,
  work: () => Promise<number>,
  triggeredBy: CronTrigger,
): Promise<CronRun> {
  const job = await cronRepository.findJobByKey(jobKey);
  if (!job) throw new Error(`Unknown cron job: ${jobKey}`);

  const run = await cronRepository.startRun(job.id, triggeredBy);
  try {
    const items = await work();
    await cronRepository.touchJob(job.id);
    logger.info("Cron job succeeded", { jobKey, items, triggeredBy });
    return cronRepository.finishRun(run.id, "SUCCESS", items);
  } catch (err) {
    await cronRepository.touchJob(job.id);
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Cron job failed", { jobKey, error: message, triggeredBy });
    return cronRepository.finishRun(run.id, "FAILED", 0, message);
  }
}
