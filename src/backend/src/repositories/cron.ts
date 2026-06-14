import type { CronStatus, CronTrigger } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for cron job definitions and their run logs.
export const cronRepository = {
  listJobs() {
    return prisma.cronJob.findMany({
      orderBy: { key: "asc" },
      include: {
        runs: { orderBy: { startedAt: "desc" }, take: 1 },
      },
    });
  },

  findJobByKey(key: string) {
    return prisma.cronJob.findUnique({ where: { key } });
  },

  listRuns(limit: number, jobId?: string) {
    return prisma.cronRun.findMany({
      where: jobId ? { jobId } : undefined,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { job: { select: { key: true, name: true } } },
    });
  },

  startRun(jobId: string, triggeredBy: CronTrigger) {
    return prisma.cronRun.create({
      data: { jobId, status: "RUNNING", triggeredBy },
    });
  },

  finishRun(id: string, status: CronStatus, itemsProcessed: number, error?: string) {
    return prisma.cronRun.update({
      where: { id },
      data: { status, itemsProcessed, error, finishedAt: new Date() },
    });
  },

  touchJob(id: string) {
    return prisma.cronJob.update({ where: { id }, data: { lastRunAt: new Date() } });
  },
};
