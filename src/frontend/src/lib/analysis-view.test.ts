import { expect, test } from "bun:test";
import {
  HORIZON_OPTIONS,
  buildForecastChartRows,
  buildNetWorthExplanation,
  horizonMonths,
  sliceForecastSeries,
  visibleAiInterpretation,
} from "./analysis-view.ts";

const point = (date: string, value: number) => ({
  date,
  mean: value,
  p10: value - 10,
  p25: value - 5,
  p50: value,
  p75: value + 5,
  p90: value + 10,
  min: value - 20,
  max: value + 20,
});

test("Analysis exposes exactly the six cached forecast horizons", () => {
  expect(HORIZON_OPTIONS.map((option) => option.years)).toEqual([1, 2, 5, 10, 15, 20]);
  expect(HORIZON_OPTIONS[0].years).toBe(1);
  expect(horizonMonths(15)).toBe(180);
});

test("changing horizon slices the loaded series without changing its source", () => {
  const source = Array.from({ length: 240 }, (_, index) => point(`month-${index}`, index));
  expect(sliceForecastSeries(source, 1)).toHaveLength(12);
  expect(sliceForecastSeries(source, 20)).toHaveLength(240);
  expect(source).toHaveLength(240);
});

test("Net Worth explanation uses the selected horizon savings and market-return contributions", () => {
  const explanation = buildNetWorthExplanation({
    years: 2,
    currentValue: 1_000,
    forecast: Array.from({ length: 24 }, (_, index) => point(`month-${index}`, 1_100 + index)),
    contributions: Array.from({ length: 24 }, (_, index) => ({
      date: `month-${index}`,
      savings: 10 * (index + 1),
      marketReturn: 5 * (index + 1),
    })),
  });

  expect(explanation).toEqual({
    startingValue: 1_000,
    median: 1_123,
    p10: 1_113,
    p90: 1_133,
    savingsContribution: 240,
    marketReturnContribution: 120,
  });
});

test("privacy mode suppresses the complete AI interpretation", () => {
  const interpretation = { summary: "Net worth may reach €10,000 with a 70% savings rate." };

  expect(visibleAiInterpretation(interpretation, true)).toBeNull();
  expect(visibleAiInterpretation(interpretation, false)).toBe(interpretation);
});

test("chart rows connect solid actuals to the dashed median at the Today boundary", () => {
  const rows = buildForecastChartRows({
    history: Array.from({ length: 30 }, (_, index) => ({ date: `history-${index}`, value: index })),
    forecast: [point("2026-02-01", 40)],
    cutoff: "2026-01-31",
    currentValue: 30,
  });

  expect(rows).toHaveLength(26);
  expect(rows[0].date).toBe("history-6");
  expect(rows[24]).toMatchObject({ date: "2026-01-31", actual: 30, p50: 30, today: true });
  expect(rows[25]).toMatchObject({ date: "2026-02-01", actual: null, p50: 40 });
});

test("investment chart rows align historical contributions by month without changing future values", () => {
  const rows = buildForecastChartRows({
    history: [
      { date: "2025-12-31", value: 900 },
      { date: "2026-01-31", value: 1_000 },
    ],
    historicalOverlay: [
      { date: "2025-12-01", value: 75 },
      { date: "2026-01-01", value: 100 },
    ],
    forecast: [point("2026-02-01", 1_100)],
    cutoff: "2026-01-31",
    currentValue: 1_000,
  });

  expect(rows[0]).toMatchObject({
    date: "2025-12-31",
    actual: 900,
    historicalOverlay: 75,
  });
  expect(rows[1]).toMatchObject({
    date: "2026-01-31",
    actual: 1_000,
    historicalOverlay: null,
    today: true,
  });
  expect(rows[2]).toMatchObject({
    date: "2026-02-01",
    actual: null,
    historicalOverlay: null,
    p50: 1_100,
  });
});
