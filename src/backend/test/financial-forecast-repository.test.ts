import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/core/db.ts";
import { financialForecastRepository } from "../src/repositories/financialForecast.ts";

const suffix = `${Date.now()}-${process.pid}`;
const users = [`forecast-a-${suffix}`, `forecast-b-${suffix}`];

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
        data: { id, name: `Forecast ${index}`, email: `${id}@example.com` },
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
