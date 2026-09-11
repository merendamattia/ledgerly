import { randomUUID } from "node:crypto";
import type { Prisma, UserForecast } from "@prisma/client";
import { prisma } from "../core/db.ts";
import type { ForecastSnapshot } from "../services/forecastContract.ts";

export const userForecastRepository = {
  find(userId: string) {
    return prisma.userForecast.findUnique({ where: { userId } });
  },

  async reserve(userId: string) {
    await prisma.userForecast.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    const queueJobId = randomUUID();
    const reserved = await prisma.userForecast.updateMany({
      where: { userId, status: { in: ["IDLE", "READY", "FAILED"] } },
      data: { status: "QUEUED", queueJobId, lastError: null },
    });
    return reserved.count === 1 ? queueJobId : null;
  },

  async claim(queueJobId: string) {
    const claimed = await prisma.userForecast.updateMany({
      where: { queueJobId, status: "QUEUED" },
      data: { status: "RUNNING" },
    });
    if (claimed.count === 0) return null;
    return prisma.userForecast.findUnique({ where: { queueJobId } });
  },

  complete(userId: string, queueJobId: string, snapshot: ForecastSnapshot) {
    return prisma.userForecast.updateMany({
      where: { userId, queueJobId, status: "RUNNING" },
      data: {
        status: "READY",
        snapshotId: snapshot.id,
        payload: snapshot as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(snapshot.generatedAt),
        sourceDataCutoff: new Date(snapshot.sourceDataCutoff),
        queueJobId: null,
        lastError: null,
      },
    });
  },

  fail(queueJobId: string, error: string) {
    return prisma.userForecast.updateMany({
      where: { queueJobId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "FAILED", queueJobId: null, lastError: error },
    });
  },
};

export type PersistedForecast = UserForecast;
