import { expect, test } from "bun:test";
import { buildForecastLineSeries, forecastLegendLabels } from "./forecast-fan-chart-config.ts";
import type { ForecastChartRow } from "@/lib/analysis-view";

const rows: ForecastChartRow[] = [
  {
    date: "2026-01-31",
    actual: 1_000,
    historicalOverlay: null,
    today: true,
    mean: 1_000,
    p10: 1_000,
    p25: 1_000,
    p50: 1_000,
    p75: 1_000,
    p90: 1_000,
    min: 1_000,
    max: 1_000,
  },
  {
    date: "2026-02-01",
    actual: null,
    historicalOverlay: null,
    today: false,
    mean: 1_120,
    p10: 900,
    p25: 1_000,
    p50: 1_100,
    p75: 1_200,
    p90: 1_300,
    min: 800,
    max: 1_400,
  },
];

test("forecast chart renders distinct visible median and mean lines with matching legend labels", () => {
  const series = buildForecastLineSeries({
    rows,
    actualLabel: "Actual",
    medianLabel: "P50 median",
    meanLabel: "Mean",
    actualColor: "#111111",
    forecastColor: "#222222",
    mutedColor: "#333333",
    todayLabel: "Today",
  });

  expect(forecastLegendLabels("Actual", "P50 median", "Mean")).toEqual([
    "Actual",
    "P50 median",
    "Mean",
  ]);
  expect(series.find((item) => item.id === "forecast")?.name).toBe("P50 median");
  expect(series.find((item) => item.id === "mean")).toMatchObject({
    name: "Mean",
    data: [1_000, 1_120],
    lineStyle: { type: [2, 4] },
  });
});

test("forecast chart includes the localized historical contribution overlay only when configured", () => {
  const series = buildForecastLineSeries({
    rows: [{ ...rows[0], historicalOverlay: 125 }, rows[1]],
    actualLabel: "Portfolio value",
    medianLabel: "P50 median",
    meanLabel: "Mean",
    historicalOverlayLabel: "Contributions",
    actualColor: "#111111",
    forecastColor: "#222222",
    historicalOverlayColor: "#444444",
    mutedColor: "#333333",
    todayLabel: "Today",
  });

  expect(forecastLegendLabels("Portfolio value", "P50 median", "Mean", "Contributions")).toEqual([
    "Portfolio value",
    "Contributions",
    "P50 median",
    "Mean",
  ]);
  expect(series.find((item) => item.id === "historical-overlay")).toMatchObject({
    name: "Contributions",
    data: [125, "-"],
    lineStyle: { type: "solid" },
  });
});
