import { Cron } from "croner";
import { config } from "../../core/config.ts";
import { logger } from "../../core/logger.ts";
import { cronRepository } from "../../repositories/cron.ts";
import { runTrackedJob } from "./runner.ts";
import { runNightlyPrices } from "./jobs.ts";

/**
 * In-process scheduler for the nightly price job. Runs inside the backend so the
 * deployment needs no external scheduled task. Reuses runTrackedJob, so every run
 * is recorded as a CronRun (triggeredBy CRON) exactly like a manual HTTP trigger.
 *
 * `protect` skips a tick if the previous run is still in flight; `catch` keeps the
 * process alive on error (runTrackedJob already captures and logs failures).
 */
export function startScheduler(): Cron {
  const job = new Cron(
    config.CRON_SCHEDULE,
    { name: "nightly-prices", timezone: config.CRON_TIMEZONE, protect: true, catch: true },
    async () => {
      const dbJob = await cronRepository.findJobByKey("nightly-prices");
      if (dbJob && !dbJob.enabled) {
        logger.info("Scheduler skipped: nightly-prices disabled");
        return;
      }
      logger.info("Scheduler firing nightly-prices");
      await runTrackedJob("nightly-prices", runNightlyPrices, "CRON");
    },
  );

  logger.info("Scheduler started", {
    schedule: config.CRON_SCHEDULE,
    timezone: config.CRON_TIMEZONE,
    nextRun: job.nextRun()?.toISOString() ?? null,
  });

  return job;
}
