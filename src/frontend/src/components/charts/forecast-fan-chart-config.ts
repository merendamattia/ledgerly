import type { LineSeriesOption } from "echarts/charts";
import type { ForecastChartRow } from "@/lib/analysis-view";

const GAP = "-" as const;

export function forecastLegendLabels(
  actualLabel: string,
  medianLabel: string,
  meanLabel: string,
  historicalOverlayLabel?: string,
): string[] {
  return [actualLabel, historicalOverlayLabel, medianLabel, meanLabel].filter(
    (label): label is string => Boolean(label),
  );
}

/** Visible line series shared by every forecast fan chart. */
export function buildForecastLineSeries({
  rows,
  actualLabel,
  medianLabel,
  meanLabel,
  historicalOverlayLabel,
  actualColor,
  forecastColor,
  historicalOverlayColor,
  mutedColor,
  todayLabel,
}: {
  rows: ForecastChartRow[];
  actualLabel: string;
  medianLabel: string;
  meanLabel: string;
  historicalOverlayLabel?: string;
  actualColor: string;
  forecastColor: string;
  historicalOverlayColor?: string;
  mutedColor: string;
  todayLabel: string;
}): LineSeriesOption[] {
  const boundaryIndex = rows.findIndex((row) => row.today);
  const actual: LineSeriesOption = {
    id: "actual",
    name: actualLabel,
    type: "line",
    data: rows.map((row) => (row.actual == null ? GAP : row.actual)),
    showSymbol: false,
    connectNulls: false,
    lineStyle: { color: actualColor, width: 2.5, type: "solid" },
    itemStyle: { color: actualColor },
    markLine:
      boundaryIndex >= 0
        ? {
            silent: true,
            symbol: ["none", "none"],
            label: { show: true, formatter: todayLabel, color: mutedColor, fontSize: 11 },
            lineStyle: { color: mutedColor, type: [3, 3], width: 1 },
            data: [{ xAxis: boundaryIndex }],
          }
        : undefined,
  };
  const overlay: LineSeriesOption[] = historicalOverlayLabel
    ? [
        {
          id: "historical-overlay",
          name: historicalOverlayLabel,
          type: "line",
          data: rows.map((row) => row.historicalOverlay ?? GAP),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: historicalOverlayColor, width: 1.75, type: "solid" },
          itemStyle: { color: historicalOverlayColor },
        },
      ]
    : [];
  const future = (row: ForecastChartRow) => row.today || row.actual == null;
  return [
    actual,
    ...overlay,
    {
      id: "forecast",
      name: medianLabel,
      type: "line",
      data: rows.map((row) => (future(row) ? row.p50 : GAP)),
      showSymbol: false,
      lineStyle: { color: forecastColor, width: 2.5, type: [6, 4] },
      itemStyle: { color: forecastColor },
    },
    {
      id: "mean",
      name: meanLabel,
      type: "line",
      data: rows.map((row) => (future(row) ? row.mean : GAP)),
      showSymbol: false,
      lineStyle: { color: forecastColor, width: 1.75, type: [2, 4], opacity: 0.8 },
      itemStyle: { color: forecastColor, opacity: 0.8 },
    },
  ];
}
