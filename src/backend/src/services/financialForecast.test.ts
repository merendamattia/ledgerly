import { expect, test } from "bun:test";
import {
  buildFinancialForecast,
  computeFlowAdjustedMonthlyReturns,
  mulberry32,
  percentile,
  type FinancialForecastInputs,
} from "./financialForecast.ts";

const zeroRecurring = Array.from({ length: 240 }, (_, index) => ({
  month: new Date(Date.UTC(2026, index + 1, 1)).toISOString().slice(0, 10),
  income: 0,
  expenses: 0,
  investmentContributions: 0,
}));

function inputs(overrides: Partial<FinancialForecastInputs> = {}): FinancialForecastInputs {
  return {
    cutoff: new Date("2026-01-31T00:00:00.000Z"),
    baseCurrency: "EUR",
    current: {
      cash: 1_000,
      credits: 0,
      otherAssets: 0,
      investments: 1_000,
      debts: 0,
      total: 2_000,
    },
    monthlyObservations: [
      {
        month: "2026-01-01",
        income: 100,
        expenses: 50,
        investmentContributions: 100,
      },
    ],
    recurringFuture: zeroRecurring,
    investmentReturns: [0.1],
    historical: {
      netWorth: [{ date: "2026-01-31", value: 2_000 }],
      income: [{ date: "2026-01-01", value: 100 }],
      expenses: [{ date: "2026-01-01", value: 50 }],
      investments: [{ date: "2026-01-31", value: 1_000 }],
      contributions: [{ date: "2026-01-01", value: 100 }],
    },
    investmentReturn: {
      observationMonths: 1,
      cagr: 2.1384,
      annualizedArithmeticReturn: 1.2,
      annualizedVolatility: 0,
      fallback: null,
    },
    ...overrides,
  };
}

test("percentile interpolates a sorted financial distribution", () => {
  expect(percentile([0, 10, 20, 30], 0.5)).toBe(15);
  expect(percentile([0, 10, 20, 30], 0.1)).toBeCloseTo(3);
  expect(percentile([], 0.5)).toBe(0);
});

test("forecast compounds the existing portfolio without double-counting contributions", () => {
  const forecast = buildFinancialForecast(inputs(), {
    horizonMonths: 2,
    simulationCount: 4,
    random: () => 0,
  });

  expect(forecast.series.netWorth).toHaveLength(2);
  expect(forecast.series.netWorth[0].p50).toBeCloseTo(2_160);
  expect(forecast.series.netWorth[1].p50).toBeCloseTo(2_341);
  expect(forecast.series.investments[0].p50).toBeCloseTo(1_210);
  expect(forecast.series.investments[1].p50).toBeCloseTo(1_441);
  expect(forecast.series.surplus[0].p50).toBe(50);
});

test("forecast creates one reusable 240-month percentile series", () => {
  const forecast = buildFinancialForecast(inputs(), {
    horizonMonths: 240,
    simulationCount: 8,
    random: () => 0,
  });

  for (const series of Object.values(forecast.series)) {
    expect(series).toHaveLength(240);
    expect(series[239]).toMatchObject({
      mean: expect.any(Number),
      p10: expect.any(Number),
      p25: expect.any(Number),
      p50: expect.any(Number),
      p75: expect.any(Number),
      p90: expect.any(Number),
    });
  }
});

test("the same seed produces the same Monte Carlo distribution", () => {
  const first = buildFinancialForecast(
    inputs({
      monthlyObservations: [
        { month: "2025-12-01", income: 80, expenses: 60, investmentContributions: 10 },
        { month: "2026-01-01", income: 140, expenses: 90, investmentContributions: 20 },
      ],
      investmentReturns: [-0.03, 0.05],
    }),
    { horizonMonths: 12, simulationCount: 20, random: mulberry32(42) },
  );
  const second = buildFinancialForecast(
    inputs({
      monthlyObservations: [
        { month: "2025-12-01", income: 80, expenses: 60, investmentContributions: 10 },
        { month: "2026-01-01", income: 140, expenses: 90, investmentContributions: 20 },
      ],
      investmentReturns: [-0.03, 0.05],
    }),
    { horizonMonths: 12, simulationCount: 20, random: mulberry32(42) },
  );

  expect(first.series).toEqual(second.series);
});

test("forecast remains finite with no investments and sparse cash-flow history", () => {
  const forecast = buildFinancialForecast(
    inputs({
      current: {
        cash: -200,
        credits: 0,
        otherAssets: 700,
        investments: 0,
        debts: 1_000,
        total: -500,
      },
      monthlyObservations: [
        { month: "2026-01-01", income: 100, expenses: 50, investmentContributions: 0 },
      ],
      investmentReturns: [],
      investmentReturn: {
        observationMonths: 0,
        cagr: null,
        annualizedArithmeticReturn: null,
        annualizedVolatility: null,
        fallback: "NO_RELIABLE_MARKET_HISTORY",
      },
    }),
    { horizonMonths: 240, simulationCount: 2, random: () => 0 },
  );

  expect(forecast.series.investments.every((point) => point.p50 === 0)).toBe(true);
  expect(forecast.series.netWorth.every((point) => Number.isFinite(point.p50))).toBe(true);
});

test("flow-adjusted returns treat contributions as flows, not performance", () => {
  const returns = computeFlowAdjustedMonthlyReturns([
    { date: "2026-01-31", value: 100, invested: 100 },
    { date: "2026-02-28", value: 150, invested: 150 },
    { date: "2026-03-31", value: 165, invested: 150 },
  ]);

  expect(returns).toEqual([0, 0.1]);
});
