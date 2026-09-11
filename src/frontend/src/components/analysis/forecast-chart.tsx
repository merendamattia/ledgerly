"use client";

import { useEffect, useRef } from "react";
import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { HistoricalPoint, ForecastPoint } from "./analysis-model";
import { compactMoney, formatMoney, shortDate } from "@/lib/format";
import { usePrivateNumberFormatter } from "@/components/private-number";
import { cn } from "@/lib/utils";

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

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
  border: string;
  muted: string;
};

const DEFAULT_COLORS: ChartColors = {
  primary: "#1C7A4D",
  secondary: "#3A72C4",
  border: "#DFDCCF",
  muted: "#69695D",
};

/** Produces the layered ECharts series used by every forecast graph. */
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
  const band = (low: keyof ForecastPoint, high: keyof ForecastPoint, stack: string, name: string, opacity: number) => [
    {
      type: "line" as const,
      data: [...blankHistory, ...forecast.map((point) => point[low] as number)],
      stack,
      stackStrategy: "all" as const,
      symbol: "none",
      silent: true,
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      tooltip: { show: false },
    },
    {
      name,
      type: "line" as const,
      data: [
        ...blankHistory,
        ...forecast.map((point) => (point[high] as number) - (point[low] as number)),
      ],
      stack,
      stackStrategy: "all" as const,
      symbol: "none",
      silent: true,
      lineStyle: { opacity: 0 },
      areaStyle: { color: colors.primary, opacity },
      tooltip: { show: false },
    },
  ];

  return [
    {
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
    ...band("p10", "p90", "outer-band", labels.outerBand, 0.12),
    ...band("p25", "p75", "inner-band", labels.innerBand, 0.2),
    {
      name: labels.mean,
      type: "line",
      data: future((point) => point.mean),
      connectNulls: true,
      showSymbol: false,
      lineStyle: { color: colors.secondary, width: 1.25, type: "solid", opacity: 0.75 },
      itemStyle: { color: colors.secondary },
    },
    {
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

function cssToken(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function tooltipIndex(params: unknown): number | null {
  const first = Array.isArray(params) ? params[0] : params;
  if (!first || typeof first !== "object" || !("dataIndex" in first)) return null;
  const index = (first as { dataIndex: unknown }).dataIndex;
  return typeof index === "number" ? index : null;
}

/** Renders an accessible observed-to-forecast percentile fan with a Today divider. */
export function ForecastChart({
  history,
  forecast,
  labels,
  currency,
  ariaLabel,
  className,
}: {
  history: HistoricalPoint[];
  forecast: ForecastPoint[];
  labels: ChartLabels;
  currency: string;
  ariaLabel: string;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { privateText } = usePrivateNumberFormatter();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || history.length === 0) return;
    const chart = echarts.init(mount, null, { renderer: "canvas" });
    const colors = {
      primary: cssToken(mount, "--positive", DEFAULT_COLORS.primary),
      secondary: cssToken(mount, "--chart-3", DEFAULT_COLORS.secondary),
      border: cssToken(mount, "--border", DEFAULT_COLORS.border),
      muted: cssToken(mount, "--muted-foreground", DEFAULT_COLORS.muted),
    };
    const dates = [...history.map((point) => point.date), ...forecast.map((point) => point.date)];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    chart.setOption({
      animation: !reduceMotion,
      animationDuration: 240,
      grid: { left: 8, right: 12, top: 12, bottom: 48, containLabel: true },
      legend: {
        bottom: 0,
        itemWidth: 12,
        itemHeight: 6,
        textStyle: { color: colors.muted, fontSize: 11 },
        data: [labels.observed, labels.outerBand, labels.innerBand, labels.mean, labels.median],
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: dates,
        axisLine: { lineStyle: { color: colors.border } },
        axisTick: { show: false },
        axisLabel: { color: colors.muted, formatter: (value: string) => shortDate(value) },
      },
      yAxis: {
        type: "value",
        scale: true,
        splitLine: { lineStyle: { color: colors.border, type: [3, 3] } },
        axisLabel: {
          color: colors.muted,
          formatter: (value: number) => privateText(compactMoney(value, currency), "••••"),
        },
      },
      tooltip: {
        trigger: "axis",
        confine: true,
        formatter: (params: unknown) => {
          const index = tooltipIndex(params);
          if (index == null) return "";
          const date = dates[index] ?? "";
          const heading = `<div style="font-weight:600;margin-bottom:4px">${shortDate(date)}</div>`;
          if (index < history.length) {
            const value = history[index]?.value;
            return value == null
              ? heading
              : `${heading}<div>${labels.observed}: ${privateText(formatMoney(value, currency))}</div>`;
          }
          const point = forecast[index - history.length];
          if (!point) return heading;
          return `${heading}<div>${labels.outerBand}: ${privateText(formatMoney(point.p10, currency))} – ${privateText(formatMoney(point.p90, currency))}</div><div>${labels.innerBand}: ${privateText(formatMoney(point.p25, currency))} – ${privateText(formatMoney(point.p75, currency))}</div><div>${labels.median}: ${privateText(formatMoney(point.p50, currency))}</div><div>${labels.mean}: ${privateText(formatMoney(point.mean, currency))}</div>`;
        },
      },
      series: buildForecastSeries(history, forecast, labels, colors),
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(mount);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [ariaLabel, currency, forecast, history, labels, privateText]);

  return (
    <div
      ref={mountRef}
      role="img"
      aria-label={ariaLabel}
      className={cn("h-[280px] w-full sm:h-[340px]", className)}
    />
  );
}
