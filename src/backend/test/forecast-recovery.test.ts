import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/core/db.ts";
import { userForecastRepository } from "../src/repositories/userForecast.ts";
import type { ForecastSnapshot } from "../src/services/forecastContract.ts";
import {
  processForecastGeneration,
  recoverForecastGenerations,
} from "../src/services/forecastGeneration.ts";

const suffix = `${Date.now()}-${process.pid}`;
const userId = `forecast-recovery-${suffix}`;
const point = { date: "2026-10-01", mean: 110, p10: 90, p25: 100, p50: 110, p75: 120, p90: 130 };

function snapshot(id: string): ForecastSnapshot {
  return {
    id,
    generatedAt: "2026-09-11T09:00:00.000Z",
    sourceDataCutoff: "2026-09-11T08:59:00.000Z",
    currency: "EUR",
    effectiveLookbackMonths: 1,
    observationCount: 1,
    simulationCount: 1,
    dataQuality: "MEDIUM",
    assumptions: [],
    history: { netWorth: [], income: [], expenses: [], investments: [] },
    series: {
      netWorth: [point], income: [point], expenses: [point], investments: [point],
      contributions: [point], savingsContributions: [point], investmentReturnContributions: [point],
    },
    summary: {
      startingNetWorth: 100,
      startingPortfolioValue: 0,
      historicalInvestmentReturnRate: null,
      historicalInvestmentReturnMonths: 0,
    },
  };
}

beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: userId,
      name: "Forecast Recovery Owner",
      email: `${userId}@example.com`,
      settings: { create: { baseCurrency: "EUR" } },
    },
  });
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
});

test("worker recovery republishes queued work, reclaims interruption, and permits refresh", async () => {
  const queuedJobId = `queued-${suffix}`;
  await prisma.userForecast.create({
    data: {
      userId,
      status: "QUEUED",
      queueJobId: queuedJobId,
    },
  });

  expect(await recoverForecastGenerations(async (queueJobId) => {
    await processForecastGeneration(queueJobId, async () => snapshot(`queued-recovered-${suffix}`));
  })).toBe(1);

  const interruptedJobId = await userForecastRepository.reserve(userId);
  expect(interruptedJobId).not.toBeNull();
  expect(await userForecastRepository.claim(interruptedJobId!)).not.toBeNull();
  await prisma.userForecast.update({
    where: { userId },
    data: { updatedAt: new Date(Date.now() - 60_000) },
  });

  expect(await recoverForecastGenerations(async (queueJobId) => {
    await processForecastGeneration(queueJobId, async () => snapshot(`interrupted-recovered-${suffix}`));
  })).toBe(1);
  expect((await userForecastRepository.find(userId))?.status).toBe("READY");

  const refreshJobId = await userForecastRepository.reserve(userId);
  expect(refreshJobId).not.toBeNull();
  await processForecastGeneration(refreshJobId!, async () => snapshot(`refreshed-${suffix}`));
  expect(await userForecastRepository.find(userId)).toEqual(expect.objectContaining({
    status: "READY",
    snapshotId: `refreshed-${suffix}`,
  }));
});
