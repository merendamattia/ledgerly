"use client";

import { useMemo } from "react";
import type { LineSeriesOption } from "echarts/charts";
import type { TooltipComponentOption } from "echarts/components";
import {
  EChartsAreaChart,
  type ChartConfig,
  type EChartsAreaChartOption,
  type ResolvedColors,
} from "@/components/evilcharts/charts/echarts-area-chart";
import {
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipShell,
} from "@/components/evilcharts/ui/echarts-tooltip";
import { usePrivateNumberFormatter } from "@/components/private-number";
import { compactMoney, formatMoney, shortDate } from "@/lib/format";
import type { ForecastPoint, HistoricalPoint } from "./analysis-model";

type ChartLabels = {
  observed: string;
  median: string;
  mean: string;
  outerBand: string;
  innerBand: string;
  today: string;
};

type ForecastLine = LineSeriesOption & {
  markLine?: { data: { name: string; xAxis: number }[] };
};

type ChartColors = {
  primary: string;
  secondary: string;
  muted: string;
};

const DEFAULT_COLORS: ChartColors = {
  primary: "#1C7A4D",
  secondary: "#3A72C4",
  muted: "#69695D",
};

/** Produces the layered series consumed by the shared ECharts wrapper. */
export function buildForecastSeries(
  history: HistoricalPoint[],
  forecast: ForecastPoint[],
  labels: ChartLabels,
  colors: ChartColors = DEFAULT_COLORS,
): ForecastLine[] {
  const historyLength = history.length;
  const anchor = history.at(-1)?.value ?? null;
  const beforeForecast = Array.from({ length: Math.max(0, historyLength - 1) }, () => null);
  const observed = [...history.map((point) => point.value), ...forecast.map(() => null)];
  const future = (value: (point: ForecastPoint) => number) => [
    ...beforeForecast,
    anchor,
    ...forecast.map(value),
  ];
  const blankHistory = Array.from({ length: historyLength }, () => null);
  const band = (
    low: keyof ForecastPoint,
    high: keyof ForecastPoint,
    stack: string,
    key: "outerBand" | "innerBand",
    name: string,
    opacity: number,
  ): ForecastLine[] => [
    {
      id: `__${key}-base`,
      type: "line",
      data: [...blankHistory, ...forecast.map((point) => point[low] as number)],
      stack,
      stackStrategy: "all",
      symbol: "none",
      silent: true,
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      tooltip: { show: false },
    },
    {
      id: key,
      name,
      type: "line",
      data: [...blankHistory, ...forecast.map((point) => (point[high] as number) - (point[low] as number))],
      stack,
      stackStrategy: "all",
      symbol: "none",
      silent: true,
      lineStyle: { opacity: 0 },
      areaStyle: { color: colors.primary, opacity },
      tooltip: { show: false },
    },
  ];

  return [
    {
      id: "observed",
      name: labels.observed,
      type: "line",
      data: observed,
      connectNulls: false,
      showSymbol: false,
      lineStyle: { color: colors.primary, width: 2.5, type: "solid" },
      itemStyle: { color: colors.primary },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: colors.muted, type: [4, 4], width: 1 },
        label: { formatter: labels.today, color: colors.muted, position: "insideEndTop" },
        data: [{ name: labels.today, xAxis: Math.max(0, historyLength - 1) }],
      },
    },
    ...band("p10", "p90", "outer-band", "outerBand", labels.outerBand, 0.12),
    ...band("p25", "p75", "inner-band", "innerBand", labels.innerBand, 0.2),
    {
      id: "mean",
      name: labels.mean,
      type: "line",
      data: future((point) => point.mean),
      connectNulls: true,
      showSymbol: false,
      lineStyle: { color: colors.secondary, width: 1.25, type: "solid", opacity: 0.75 },
      itemStyle: { color: colors.secondary },
    },
    {
      id: "median",
      name: labels.median,
      type: "line",
      data: future((point) => point.p50),
      connectNulls: true,
      showSymbol: false,
      lineStyle: { color: colors.primary, width: 2.5, type: "dashed" },
      itemStyle: { color: colors.primary },
    },
  ];
}

function tooltipIndex(params: unknown): number | null {
  const first = Array.isArray(params) ? params[0] : params;
  if (!first || typeof first !== "object" || !("dataIndex" in first)) return null;
  const index = (first as { dataIndex: unknown }).dataIndex;
  return typeof index === "number" ? index : null;
}

function seriesColor(resolved: ResolvedColors, key: string, fallback: string): string {
  return resolved.series[key]?.[0] ?? fallback;
}

/** Renders a forecast fan through Ledgerly's shared lifecycle, theme, legend, and tooltip layer. */
export function ForecastChart({
  history,
  forecast,
  labels,
  currency,
  ariaLabel,
  className = "h-[280px] w-full sm:h-[340px]",
}: {
  history: HistoricalPoint[];
  forecast: ForecastPoint[];
  labels: ChartLabels;
  currency: string;
  ariaLabel: string;
  className?: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const dates = useMemo(
    () => [...history.map((point) => point.date), ...forecast.map((point) => point.date)],
    [forecast, history],
  );
  const data = useMemo(() => dates.map((date) => ({ date })), [dates]);
  const config = useMemo(() => ({
    observed: { label: labels.observed, colors: { light: ["var(--positive)"] } },
    outerBand: { label: labels.outerBand, colors: { light: ["var(--positive)"] } },
    innerBand: { label: labels.innerBand, colors: { light: ["var(--positive)"] } },
    mean: { label: labels.mean, colors: { light: ["var(--chart-3)"] } },
    median: { label: labels.median, colors: { light: ["var(--positive)"] } },
  }) satisfies ChartConfig, [labels]);

  const optionTransform = useMemo(() => (
    option: EChartsAreaChartOption,
    resolved: ResolvedColors,
  ): EChartsAreaChartOption => {
    const money = (value: number) => privateText(formatMoney(value, currency));
    const baseTooltip = option.tooltip as TooltipComponentOption;
    return {
      ...option,
      tooltip: {
        ...baseTooltip,
        formatter: (params: unknown) => {
          const index = tooltipIndex(params);
          if (index == null) return "";
          const label = shortDate(dates[index] ?? "");
          if (index < history.length) {
            const value = history[index]?.value;
            const body = value == null ? "" : tooltipRow({
              indicatorHtml: tooltipIndicatorHtml("observed", 1),
              labelText: labels.observed,
              valueText: money(value),
              dimmed: "",
            });
            return tooltipShell({ label, body, roundness: "xl", variant: "default" });
          }
          const point = forecast[index - history.length];
          if (!point) return "";
          const rows = [
            ["outerBand", labels.outerBand, `${money(point.p10)} – ${money(point.p90)}`],
            ["innerBand", labels.innerBand, `${money(point.p25)} – ${money(point.p75)}`],
            ["median", labels.median, money(point.p50)],
            ["mean", labels.mean, money(point.mean)],
          ] as const;
          const body = rows.map(([key, labelText, valueText]) => tooltipRow({
            indicatorHtml: tooltipIndicatorHtml(key, 1),
            labelText,
            valueText,
            dimmed: "",
          })).join("");
          return tooltipShell({ label, body, roundness: "xl", variant: "default" });
        },
      },
      series: buildForecastSeries(history, forecast, labels, {
        primary: seriesColor(resolved, "observed", DEFAULT_COLORS.primary),
        secondary: seriesColor(resolved, "mean", DEFAULT_COLORS.secondary),
        muted: resolved.tokens.mutedForeground,
      }),
    };
  }, [currency, dates, forecast, history, labels, privateText]);

  return (
    <EChartsAreaChart
      config={config}
      data={data}
      xDataKey="date"
      className={className}
      animationType="left-to-right"
      ariaLabel={ariaLabel}
      optionTransform={optionTransform}
    >
      <EChartsAreaChart.Grid />
      <EChartsAreaChart.XAxis dataKey="date" hideDots tickFormatter={shortDate} />
      <EChartsAreaChart.YAxis
        hideDots
        tickFormatter={(value) => privateText(compactMoney(value, currency), "••••")}
      />
      <EChartsAreaChart.Tooltip roundness="xl" />
      <EChartsAreaChart.Legend align="center" verticalAlign="bottom" />
      <EChartsAreaChart.Area dataKey="observed" variant="none" strokeVariant="solid" />
      <EChartsAreaChart.Area dataKey="outerBand" variant="solid" strokeWidth={0} />
      <EChartsAreaChart.Area dataKey="innerBand" variant="solid" strokeWidth={0} />
      <EChartsAreaChart.Area dataKey="mean" variant="none" strokeVariant="solid" />
      <EChartsAreaChart.Area dataKey="median" variant="none" strokeVariant="dashed" />
    </EChartsAreaChart>
  );
}
