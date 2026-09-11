import { describe, expect, test } from "bun:test";
import {
  FORECAST_HORIZONS,
  buildForecastChartModel,
  forecastExplanationFacts,
  forecastViewState,
  sliceForecast,
  type ForecastSnapshot,
} from "./analysis-model";

function snapshot(months = 240): ForecastSnapshot {
  const points = Array.from({ length: months }, (_, index) => ({
    date: `2040-${String((index % 12) + 1).padStart(2, "0")}-01`,
    mean: 100 + index,
    p10: 80 + index,
    p25: 90 + index,
    p50: 100 + index,
    p75: 110 + index,
    p90: 120 + index,
  }));

  return {
    id: "forecast-1",
    generatedAt: "2040-01-02T12:00:00.000Z",
    sourceDataCutoff: "2040-01-01T00:00:00.000Z",
    currency: "EUR",
    effectiveLookbackMonths: 12,
    observationCount: 12,
    simulationCount: 10_000,
    dataQuality: "HIGH",
    assumptions: ["tracked-components-flat"],
    history: {
      netWorth: [{ date: "2039-12-01", value: 95 }],
      income: [{ date: "2039-12-01", value: 10 }],
      expenses: [{ date: "2039-12-01", value: 4 }],
      investments: [{ date: "2039-12-01", value: 30, contribution: 2 }],
    },
    series: {
      netWorth: points,
      income: points,
      expenses: points,
      investments: points,
      contributions: points,
    },
    summary: {
      startingNetWorth: 95,
      savingsContribution: 12,
      investmentReturnContribution: 4,
      startingPortfolioValue: 30,
      historicalInvestmentReturnRate: 0.061,
      historicalInvestmentReturnMonths: 12,
    },
  };
}

describe("forecast horizons", () => {
  test("offers only 1, 2, 5, 10, 15 and 20 years", () => {
    expect(FORECAST_HORIZONS).toEqual([1, 2, 5, 10, 15, 20]);
  });

  test("slices the cached 240-month result without changing the source", () => {
    const original = snapshot();
    expect(sliceForecast(original, 5).series.netWorth).toHaveLength(60);
    expect(original.series.netWorth).toHaveLength(240);
  });
});

describe("forecast chart model", () => {
  test("joins observed history to a dashed P50 forecast and exposes percentile bands", () => {
    const model = buildForecastChartModel(snapshot(), "netWorth", 1);

    expect(model.history.at(-1)?.date).toBe("2039-12-01");
    expect(model.forecast).toHaveLength(12);
    expect(model.series.map((series) => series.key)).toEqual([
      "observed",
      "p10-p90",
      "p25-p75",
      "mean",
      "p50",
    ]);
    expect(model.series.find((series) => series.key === "observed")?.lineStyle).toBe("solid");
    expect(model.series.find((series) => series.key === "p50")?.lineStyle).toBe("dashed");
    expect(model.todayIndex).toBe(0);
  });

  test("keeps contributions separate from investment portfolio value", () => {
    const model = buildForecastChartModel(snapshot(), "investments", 2);
    expect(model.secondarySeries?.key).toBe("contributions");
    expect(model.forecast).toHaveLength(24);
  });
});

describe("forecast view states", () => {
  test("preserves a stale snapshot while refreshing and after refresh failure", () => {
    const value = snapshot();
    expect(forecastViewState({ status: "GENERATING", snapshot: value })).toBe("refreshing");
    expect(forecastViewState({ status: "FAILED", snapshot: value, error: "failed" })).toBe(
      "stale-error",
    );
  });

  test("distinguishes loading, no forecast and terminal error states", () => {
    expect(forecastViewState(undefined)).toBe("loading");
    expect(forecastViewState(undefined, { isError: true })).toBe("error");
    expect(forecastViewState({ status: "EMPTY", snapshot: null })).toBe("empty");
    expect(forecastViewState({ status: "GENERATING", snapshot: null })).toBe("refreshing");
    expect(forecastViewState({ status: "FAILED", snapshot: null, error: "failed" })).toBe("error");
  });
});

test("deterministic explanations use persisted endpoint and contribution facts", () => {
  const facts = forecastExplanationFacts(snapshot(), 1);
  expect(facts.netWorth).toEqual({
    start: 95,
    p50: 111,
    p10: 91,
    p90: 131,
    savingsContribution: 12,
    investmentReturnContribution: 4,
  });
  expect(facts.investments).toEqual({
    start: 30,
    flowAdjustedReturnRate: 0.061,
    observationMonths: 12,
  });
});
