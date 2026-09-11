import { expect, test } from "bun:test";
import { buildForecastSeries } from "./forecast-chart";

test("forecast chart exposes observed, percentile bands, mean, median and Today divider", () => {
  const series = buildForecastSeries(
    [{ date: "2039-12-01", value: 95 }],
    [
      {
        date: "2040-01-01",
        mean: 101,
        p10: 80,
        p25: 90,
        p50: 100,
        p75: 110,
        p90: 120,
      },
    ],
    {
      observed: "Observed",
      median: "P50",
      mean: "Mean",
      outerBand: "P10–P90",
      innerBand: "P25–P75",
      today: "Today",
    },
  );

  expect(series.map((item) => item.name).filter(Boolean)).toEqual([
    "Observed",
    "P10–P90",
    "P25–P75",
    "Mean",
    "P50",
  ]);
  expect(series.find((item) => item.name === "Observed")?.lineStyle?.type).toBe("solid");
  expect(series.find((item) => item.name === "P50")?.lineStyle?.type).toBe("dashed");
  expect(series.find((item) => item.name === "P50")?.data).toEqual([95, 100]);
  expect(series.find((item) => item.name === "Observed")?.markLine?.data).toEqual([
    { name: "Today", xAxis: 0 },
  ]);
});
