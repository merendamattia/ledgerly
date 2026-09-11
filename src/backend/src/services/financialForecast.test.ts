import { expect, test } from "bun:test";
import {
  buildFinancialForecast,
  flowAdjustedMonthlyReturns,
  getFinancialForecast,
  percentile,
  type FinancialForecastInput,
  type ForecastDataSources,
} from "./financialForecast.ts";

const baseInput = (overrides: Partial<FinancialForecastInput> = {}): FinancialForecastInput => ({
  asOf: new Date("2026-06-30T00:00:00Z"),
  currency: "EUR",
  current: {
    netWorth: 10_000,
    investments: 1_000,
    marketInvestments: 1_000,
    flatInvestments: 0,
  },
  observations: [
    {
      month: "2026-06",
      income: 2_000,
      expense: 1_200,
      contribution: 300,
      recurringIncome: 0,
      recurringExpense: 0,
      recurringContribution: 0,
    },
  ],
  recurring: [],
  portfolioReturns: [0.01, -0.02, 0.03],
  portfolioReturnPeriod: { from: "2026-04", to: "2026-06" },
  returnFallback: "none",
  componentAssumptions: [],
  ...overrides,
});

test("percentile interpolates sorted values and never mutates the sample", () => {
  const sample = [40, 10, 30, 20];
  expect(percentile(sample, 0.25)).toBe(17.5);
  expect(sample).toEqual([40, 10, 30, 20]);
});

test("seeded forecasts are deterministic, ordered, and contain 240 future months", () => {
  const first = buildFinancialForecast(baseInput(), { seed: 42, simulations: 200 });
  const second = buildFinancialForecast(baseInput(), { seed: 42, simulations: 200 });

  expect(first).toEqual(second);
  expect(first.status).toBe("ready");
  expect(first.series.netWorth).toHaveLength(240);
  expect(first.series.return).toHaveLength(240);
  expect(first.series.netWorth[0].month).toBe("2026-07");
  expect(first.historicalPortfolioReturn?.period).toEqual({
    from: "2026-04", to: "2026-06", months: 3,
  });
  for (const point of Object.values(first.series).flat()) {
    expect(point.p10).toBeLessThanOrEqual(point.p25);
    expect(point.p25).toBeLessThanOrEqual(point.p50);
    expect(point.p50).toBeLessThanOrEqual(point.p75);
    expect(point.p75).toBeLessThanOrEqual(point.p90);
    expect(Object.values(point).every((value) => typeof value === "string" || Number.isFinite(value))).toBe(true);
  }
});

test("uses only the latest 12 observations and reports sparse histories", () => {
  const observations = Array.from({ length: 14 }, (_, index) => ({
    month: `2025-${String(index + 1).padStart(2, "0")}`,
    income: index < 2 ? 100_000 : 1_000,
    expense: 0,
    contribution: 0,
    recurringIncome: 0,
    recurringExpense: 0,
    recurringContribution: 0,
  }));
  const full = buildFinancialForecast(baseInput({ observations }), { seed: 1, simulations: 1 });
  const sparse = buildFinancialForecast(baseInput({ observations: observations.slice(0, 4) }), {
    seed: 1,
    simulations: 1,
  });

  expect(full.assumptions.observationCount).toBe(12);
  expect(full.assumptions.effectiveLookbackMonths).toBe(12);
  expect(full.series.income[0].mean).toBe(1_000);
  expect(sparse.assumptions.observationCount).toBe(4);
  expect(sparse.assumptions.dataQuality).toBe("reduced");
});

test("compounds opening investments before adding end-of-month contributions", () => {
  const forecast = buildFinancialForecast(
    baseInput({
      current: { netWorth: 1_000, investments: 1_000, marketInvestments: 1_000, flatInvestments: 0 },
      observations: [{
        month: "2026-06", income: 0, expense: 0, contribution: 100,
        recurringIncome: 0, recurringExpense: 0, recurringContribution: 0,
      }],
      portfolioReturns: [0.1],
    }),
    { seed: 1, simulations: 1, horizonMonths: 2 },
  );

  expect(forecast.series.investment.map((point) => point.mean)).toEqual([1_200, 1_420]);
  expect(forecast.series.contribution.map((point) => point.mean)).toEqual([100, 100]);
  expect(forecast.series.netWorth.map((point) => point.mean)).toEqual([1_100, 1_220]);
});

test("adds known recurring movements deterministically and bootstraps only residual cash flow", () => {
  const forecast = buildFinancialForecast(
    baseInput({
      observations: [{
        month: "2026-06", income: 1_000, expense: 400, contribution: 0,
        recurringIncome: 600, recurringExpense: 100, recurringContribution: 0,
      }],
      recurring: [{ month: "2026-07", income: 700, expense: 200, contribution: 50 }],
      portfolioReturns: [0],
    }),
    { seed: 1, simulations: 1, horizonMonths: 1 },
  );

  expect(forecast.series.income[0].mean).toBe(1_100);
  expect(forecast.series.expense[0].mean).toBe(500);
  expect(forecast.series.contribution[0].mean).toBe(50);
  expect(forecast.series.surplus[0].mean).toBe(600);
});

test("flow-adjusted portfolio returns remove buys and retain multi-asset market growth", () => {
  const result = flowAdjustedMonthlyReturns([
    { date: "2026-01-31", value: 1_000, invested: 1_000 },
    { date: "2026-02-28", value: 1_500, invested: 1_500 },
    { date: "2026-03-31", value: 1_650, invested: 1_500 },
  ]);

  expect(result).toEqual([{ month: "2026-02", rate: 0 }, { month: "2026-03", rate: 0.1 }]);
});

test("manual or missing-price investments stay flat and unsafe numbers are sanitized", () => {
  const forecast = buildFinancialForecast(
    baseInput({
      current: { netWorth: -5_000, investments: 500, marketInvestments: 0, flatInvestments: 500 },
      observations: [{
        month: "2026-06", income: 0, expense: 0, contribution: 0,
        recurringIncome: 0, recurringExpense: 0, recurringContribution: 0,
      }],
      portfolioReturns: [Number.NaN, Number.POSITIVE_INFINITY],
      returnFallback: "flat_manual_or_missing_price",
    }),
    { seed: 2, simulations: 2, horizonMonths: 2 },
  );

  expect(forecast.series.investment.map((point) => point.mean)).toEqual([500, 500]);
  expect(forecast.series.netWorth.map((point) => point.mean)).toEqual([-5_000, -5_000]);
  expect(forecast.assumptions.returnFallback).toBe("flat_manual_or_missing_price");
});

test("returns an explicit safe no-history result", () => {
  const forecast = buildFinancialForecast(baseInput({ observations: [] }), { seed: 1 });
  expect(forecast.status).toBe("no_history");
  expect(Object.values(forecast.series).every((series) => series.length === 0)).toBe(true);
});

test("the input loader passes the same owner id to every user-scoped source", async () => {
  const calls: string[] = [];
  const source = <T>(value: T) => async (userId: string): Promise<T> => { calls.push(userId); return value; };
  const sources: ForecastDataSources = {
    netWorth: source({ baseCurrency: "EUR", total: 0, investments: 0, holdings: [] }),
    netWorthHistory: source([]),
    cashflow: source({ baseCurrency: "EUR", months: [], income: [], expense: [], investment: [] }),
    transactions: source([]),
    recurringRules: source([]),
    investmentHistory: source([]),
  };

  await getFinancialForecast("owner-7", { now: new Date("2026-06-30"), sources });
  expect(calls).toEqual(Array(6).fill("owner-7"));
});
