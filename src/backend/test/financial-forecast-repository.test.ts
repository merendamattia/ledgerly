import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/core/db.ts";
import { financialForecastRepository } from "../src/repositories/financialForecast.ts";

const suffix = `${Date.now()}-${process.pid}`;
const users = [
  `forecast-a-${suffix}`,
  `forecast-b-${suffix}`,
  `forecast-recovery-${suffix}`,
  `analysis-recovery-${suffix}`,
  `forecast-recovery-race-${suffix}`,
  `analysis-recovery-race-${suffix}`,
];

const payload = {
  hasData: true,
  baseCurrency: "EUR",
  current: { cash: 100, credits: 0, otherAssets: 0, investments: 0, debts: 0, total: 100 },
  historical: { netWorth: [], income: [], expenses: [], investments: [], contributions: [] },
  series: { netWorth: [], income: [], expenses: [], investments: [], surplus: [] },
  summary: {
    averageMonthlyIncome: 0,
    averageMonthlyExpenses: 0,
    averageMonthlyContributions: 0,
    incomeVariability: 0,
    expenseVariability: 0,
    investmentReturn: {
      observationMonths: 0,
      cagr: null,
      annualizedArithmeticReturn: null,
      annualizedVolatility: null,
      fallback: "NO_RELIABLE_MARKET_HISTORY",
    },
  },
  assumptions: {
    effectiveLookbackMonths: 0,
    observationMonths: 0,
    dataQuality: "REDUCED",
    recurringMovementsIncluded: false,
    flatComponents: ["credits", "otherAssets", "debts"],
  },
} as unknown as Prisma.InputJsonValue;

beforeAll(async () => {
  await Promise.all(
    users.map((id, index) =>
      prisma.user.create({
        data: {
          id,
          name: `Forecast ${index}`,
          email: `${id}@example.com`,
          settings: { create: { baseCurrency: "EUR", locale: index === 3 ? "it" : "en" } },
        },
      }),
    ),
  );
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

test("only one generation can be active for the same user", async () => {
  expect(await financialForecastRepository.requestGeneration(users[0], "job-a-1")).toBe(true);
  expect(await financialForecastRepository.requestGeneration(users[0], "job-a-2")).toBe(false);
  expect(await financialForecastRepository.requestGeneration(users[1], "job-b-1")).toBe(true);
});

test("a failed replacement keeps the previous user-scoped snapshot readable", async () => {
  expect(await financialForecastRepository.claimGeneration(users[0], "job-a-1")).toBe(true);
  const first = await financialForecastRepository.completeGeneration(users[0], "job-a-1", {
    dataCutoff: new Date("2026-09-12T00:00:00.000Z"),
    effectiveLookbackMonths: 1,
    observationMonths: 1,
    simulationCount: 10,
    maxHorizonMonths: 240,
    seed: 1,
    payload,
  });
  expect((await financialForecastRepository.latestForUser(users[0])).snapshot?.id).toBe(first.id);
  expect((await financialForecastRepository.latestForUser(users[1])).snapshot).toBeNull();

  expect(await financialForecastRepository.requestGeneration(users[0], "job-a-3")).toBe(true);
  expect(await financialForecastRepository.claimGeneration(users[0], "job-a-3")).toBe(true);
  await financialForecastRepository.failGeneration(users[0], "job-a-3", "simulation failed");

  const result = await financialForecastRepository.latestForUser(users[0]);
  expect(result.snapshot?.id).toBe(first.id);
  expect(result.state?.status).toBe("FAILED");
  expect(result.state?.lastError).toBe("simulation failed");
});

test("recovery makes stale forecast claims retryable and republishes them", async () => {
  expect(await financialForecastRepository.requestGeneration(users[2], "recover-forecast")).toBe(true);

  let work = await financialForecastRepository.prepareRecovery(new Date(0));
  expect(work.generations).toContainEqual({
    userId: users[2],
    generationId: "recover-forecast",
  });

  expect(await financialForecastRepository.claimGeneration(users[2], "recover-forecast")).toBe(true);
  await prisma.financialForecastState.update({
    where: { userId: users[2] },
    data: { startedAt: new Date("2020-01-01T00:00:00.000Z") },
  });

  work = await financialForecastRepository.prepareRecovery(new Date("2021-01-01T00:00:00.000Z"));
  const recoveredGeneration = work.generations.find(({ userId }) => userId === users[2]);
  expect(recoveredGeneration?.generationId).toBeString();
  expect(recoveredGeneration?.generationId).not.toBe("recover-forecast");
  if (!recoveredGeneration) throw new Error("Expected a recovered forecast generation");
  const generationState = await prisma.financialForecastState.findUniqueOrThrow({
    where: { userId: users[2] },
  });
  expect(generationState).toMatchObject({
    status: "PENDING",
    queueJobId: recoveredGeneration.generationId,
  });
  expect(await financialForecastRepository.claimGeneration(users[2], "recover-forecast")).toBe(false);
  expect(
    await financialForecastRepository.claimGeneration(
      users[2],
      recoveredGeneration.generationId,
    ),
  ).toBe(true);
});

test("recovery makes stale interpretation claims retryable and republishes them", async () => {
  const snapshot = await prisma.financialForecastSnapshot.create({
    data: {
      userId: users[3],
      dataCutoff: new Date("2026-09-12T00:00:00.000Z"),
      effectiveLookbackMonths: 1,
      observationMonths: 1,
      simulationCount: 10,
      maxHorizonMonths: 240,
      seed: 2,
      payload,
      analysisQueueJobId: "recover-analysis",
    },
  });

  let work = await financialForecastRepository.prepareRecovery(new Date(0));
  expect(work.interpretations).toContainEqual({
    userId: users[3],
    snapshotId: snapshot.id,
    locale: "it",
    queueJobId: "recover-analysis",
  });

  expect(await financialForecastRepository.claimAnalysis(snapshot.id, "recover-analysis")).toBe(true);
  await prisma.financialForecastSnapshot.update({
    where: { id: snapshot.id },
    data: { analysisStartedAt: new Date("2020-01-01T00:00:00.000Z") },
  });

  work = await financialForecastRepository.prepareRecovery(new Date("2021-01-01T00:00:00.000Z"));
  const recoveredInterpretation = work.interpretations.find(
    ({ snapshotId }) => snapshotId === snapshot.id,
  );
  expect(recoveredInterpretation).toMatchObject({
    userId: users[3],
    snapshotId: snapshot.id,
    locale: "it",
  });
  expect(recoveredInterpretation?.queueJobId).toBeString();
  expect(recoveredInterpretation?.queueJobId).not.toBe("recover-analysis");
  if (!recoveredInterpretation) throw new Error("Expected a recovered interpretation");
  const recoveredSnapshot = await prisma.financialForecastSnapshot.findUniqueOrThrow({
    where: { id: snapshot.id },
  });
  expect(recoveredSnapshot).toMatchObject({
    analysisStatus: "PENDING",
    analysisQueueJobId: recoveredInterpretation.queueJobId,
  });
  expect(await financialForecastRepository.claimAnalysis(snapshot.id, "recover-analysis")).toBe(false);
  await expect(
    financialForecastRepository.completeAnalysis(snapshot.id, "recover-analysis", payload),
  ).rejects.toThrow("Financial interpretation claim was lost");
  expect(
    await financialForecastRepository.claimAnalysis(
      snapshot.id,
      recoveredInterpretation.queueJobId,
    ),
  ).toBe(true);
});

test("forecast completion between recovery scan and transition is not reset", async () => {
  const queueJobId = "forecast-completion-race";
  const startedAt = new Date("2020-01-01T00:00:00.000Z");
  expect(await financialForecastRepository.requestGeneration(users[4], queueJobId)).toBe(true);
  expect(await financialForecastRepository.claimGeneration(users[4], queueJobId)).toBe(true);
  const staleClaim = await prisma.financialForecastState.update({
    where: { userId: users[4] },
    data: { startedAt },
    select: { id: true, startedAt: true },
  });
  if (!staleClaim.startedAt) throw new Error("Expected a running forecast claim");

  const completed = await financialForecastRepository.completeGeneration(users[4], queueJobId, {
    dataCutoff: new Date("2026-09-12T00:00:00.000Z"),
    effectiveLookbackMonths: 1,
    observationMonths: 1,
    simulationCount: 10,
    maxHorizonMonths: 240,
    seed: 3,
    payload,
  });
  const recoveredJobId = await financialForecastRepository.recoverStaleGenerationClaim(
    staleClaim.id,
    staleClaim.startedAt,
  );

  expect(recoveredJobId).toBeNull();
  expect(await prisma.financialForecastState.findUniqueOrThrow({
    where: { userId: users[4] },
  })).toMatchObject({ status: "COMPLETED", queueJobId });
  expect(await prisma.financialForecastSnapshot.findUnique({ where: { id: completed.id } })).not.toBeNull();
});

test("interpretation completion between recovery scan and transition is not reset", async () => {
  const queueJobId = "analysis-completion-race";
  const startedAt = new Date("2020-01-01T00:00:00.000Z");
  const snapshot = await prisma.financialForecastSnapshot.create({
    data: {
      userId: users[5],
      dataCutoff: new Date("2026-09-12T00:00:00.000Z"),
      effectiveLookbackMonths: 1,
      observationMonths: 1,
      simulationCount: 10,
      maxHorizonMonths: 240,
      seed: 4,
      payload,
      analysisQueueJobId: queueJobId,
    },
  });
  expect(await financialForecastRepository.claimAnalysis(snapshot.id, queueJobId)).toBe(true);
  const staleClaim = await prisma.financialForecastSnapshot.update({
    where: { id: snapshot.id },
    data: { analysisStartedAt: startedAt },
    select: { id: true, analysisStartedAt: true },
  });
  if (!staleClaim.analysisStartedAt) throw new Error("Expected a running interpretation claim");

  await financialForecastRepository.completeAnalysis(snapshot.id, queueJobId, payload);
  const recoveredJobId = await financialForecastRepository.recoverStaleInterpretationClaim(
    staleClaim.id,
    staleClaim.analysisStartedAt,
  );

  expect(recoveredJobId).toBeNull();
  expect(await prisma.financialForecastSnapshot.findUniqueOrThrow({
    where: { id: snapshot.id },
  })).toMatchObject({
    analysisStatus: "COMPLETED",
    analysisQueueJobId: queueJobId,
    analysisContent: payload,
  });
});
