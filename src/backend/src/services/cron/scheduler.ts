import { Cron } from "croner";
import { config } from "../../core/config.ts";
import { logger } from "../../core/logger.ts";
import { cronRepository } from "../../repositories/cron.ts";
import { runTrackedJob } from "./runner.ts";
import { cronHandlers } from "./jobs.ts";

/**
 * In-process scheduler. Runs inside the backend so the deployment needs no external
 * scheduled task. Registers one croner per DB cron job that has both a schedule and a
 * registered handler — schedules live in the seed (e.g. prices/FX at 02:00, snapshots
 * at 03:00); the timezone comes from CRON_TIMEZONE. Every fire reuses runTrackedJob, so
 * each run is recorded as a CronRun (triggeredBy CRON) exactly like a manual HTTP trigger.
 *
 * `protect` skips a tick if the previous run is still in flight; `catch` keeps the
 * process alive on error (runTrackedJob already captures and logs failures).
 */
export async function startScheduler(): Promise<Cron[]> {
  const jobs = await cronRepository.listJobs();
  const crons: Cron[] = [];

  for (const job of jobs) {
    if (!job.schedule || !cronHandlers[job.key]) continue;

    const cron = new Cron(
      job.schedule,
      { name: job.key, timezone: config.CRON_TIMEZONE, protect: true, catch: true },
      async () => {
        const dbJob = await cronRepository.findJobByKey(job.key);
        if (dbJob && !dbJob.enabled) {
          logger.info("Scheduler skipped: job disabled", { jobKey: job.key });
          return;
        }
        logger.info("Scheduler firing job", { jobKey: job.key });
        await runTrackedJob(job.key, cronHandlers[job.key], "CRON");
      },
    );

    crons.push(cron);
    logger.info("Scheduler registered job", {
      jobKey: job.key,
      schedule: job.schedule,
      timezone: config.CRON_TIMEZONE,
      nextRun: cron.nextRun()?.toISOString() ?? null,
    });
  }

  logger.info("Scheduler started", { jobs: crons.length });
  return crons;
}
