import { expect, test } from "bun:test";
import {
  HORIZON_OPTIONS,
  buildForecastChartRows,
  horizonMonths,
  sliceForecastSeries,
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
