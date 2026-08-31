import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin, requireAuth, requireCronOrAuth } from "../middlewares/auth.ts";
import { cronRepository } from "../../repositories/cron.ts";
import { cronHandlers } from "../../services/cron/jobs.ts";
import { runTrackedJob } from "../../services/cron/runner.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const cronRoutes = new Hono<AppEnv>()
  // List job definitions with their latest run. `runnable` flags the jobs the UI
  // can trigger via "Run now" (those with a registered handler).
  .get("/jobs", requireAuth, requireAdmin, async (c) => {
    const jobs = await cronRepository.listJobs();
    return c.json(jobs.map((job) => ({ ...job, runnable: job.key in cronHandlers })));
  })
  // List recent runs (optionally filtered by job).
  .get(
    "/runs",
    requireAuth,
    requireAdmin,
    zValidator(
      "query",
      z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), jobId: z.string().optional() }),
    ),
    async (c) => {
      const { limit, jobId } = c.req.valid("query");
      return c.json(await cronRepository.listRuns(limit, jobId));
    },
  )
  // Trigger a job by key. Allowed for the scheduler (cron secret) or a user.
  .post("/:key/run", requireCronOrAuth, async (c) => {
    const key = c.req.param("key");
    const handler = cronHandlers[key];
    if (!handler) throw new NotFoundError(`No runnable cron job with key: ${key}`);

    const triggeredBy = c.req.header("x-cron-secret") ? "CRON" : "MANUAL";
    // A user-triggered run does a single attempt so the HTTP request returns
    // promptly; scheduled runs keep the default 5×/30s retry policy.
    const options = triggeredBy === "MANUAL" ? { maxAttempts: 1 } : undefined;
    const run = await runTrackedJob(key, handler, triggeredBy, options);
    return c.json(run);
  });
