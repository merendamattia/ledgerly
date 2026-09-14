"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import type { ComposeOption } from "echarts/core";
import type { LineSeriesOption } from "echarts/charts";
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import * as echarts from "echarts/core";
import {
  buildForecastLineSeries,
  forecastLegendLabels,
} from "./forecast-fan-chart-config";
import {
  buildChartCss,
  resolveColors,
  withAlpha,
  type ChartConfig,
} from "@/components/evilcharts/ui/echarts-chart";
import {
  tooltipBaseOption,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipShell,
} from "@/components/evilcharts/ui/echarts-tooltip";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";
import type { ForecastChartRow } from "@/lib/analysis-view";
import { compactMoney, formatMoney, monthLabel } from "@/lib/format";

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent]);

type ForecastOption = ComposeOption<
  LineSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption
>;

const numberOrGap = (value: number) => (Number.isFinite(value) ? value : "-");

/** Ledgerly-native Monte Carlo fan: solid actuals, dashed P50 and nested percentile bands. */
export function ForecastFanChart({
  rows,
  currency,
  todayLabel,
  actualLabel,
  medianLabel,
  meanLabel,
  historicalOverlayLabel,
  rangeLabel,
  ariaLabel,
  color = "var(--chart-3)",
}: {
  rows: ForecastChartRow[];
  currency: string;
  todayLabel: string;
  actualLabel: string;
  medianLabel: string;
  meanLabel: string;
  historicalOverlayLabel?: string;
  rangeLabel: string;
  ariaLabel: string;
  color?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const { privateText } = usePrivateNumberFormatter();
  const chartId = `forecast-${useId().replace(/:/g, "")}`;
  const config = useMemo(
    () =>
      ({
        actual: { label: actualLabel, colors: { light: [color] } },
        forecast: { label: medianLabel, colors: { light: [color] } },
        mean: { label: meanLabel, colors: { light: [color] } },
        ...(historicalOverlayLabel
          ? {
              historicalOverlay: {
                label: historicalOverlayLabel,
                colors: { light: ["var(--chart-5)"] },
              },
            }
          : {}),
      }) satisfies ChartConfig,
    [actualLabel, color, historicalOverlayLabel, meanLabel, medianLabel],
  );
  const css = useMemo(() => buildChartCss(chartId, config), [chartId, config]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const chart = echarts.init(mount, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(mount);
    return () => {
      resize.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const mount = mountRef.current;
    if (!chart || !mount || rows.length === 0) return;
    const colorKeys = historicalOverlayLabel
      ? ["actual", "forecast", "mean", "historicalOverlay"]
      : ["actual", "forecast", "mean"];
    const resolved = resolveColors(mount.parentElement ?? mount, config, colorKeys);
    const actualColor = resolved.series.actual[0];
    const forecastColor = resolved.series.forecast[0];
    const historicalOverlayColor = resolved.series.historicalOverlay?.[0];
    const future = (row: ForecastChartRow) => row.today || row.actual == null;
    const gap = "-" as const;
    const option: ForecastOption = {
      animationDuration: 240,
      grid: { left: 8, right: 12, top: 42, bottom: 30, containLabel: true },
      legend: {
        top: 0,
        left: 8,
        data: forecastLegendLabels(
          actualLabel,
          medianLabel,
          meanLabel,
          historicalOverlayLabel,
        ),
        selectedMode: false,
        itemWidth: 18,
        itemHeight: 3,
        itemGap: 14,
        textStyle: { color: resolved.tokens.mutedForeground, fontSize: 11 },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: rows.map((row) => row.date),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: resolved.tokens.mutedForeground,
          formatter: (value: string) => monthLabel(value),
          hideOverlap: true,
          margin: 12,
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: resolved.tokens.mutedForeground,
          formatter: (value: number) =>
            privateText(compactMoney(value, currency), PRIVATE_COMPACT_PLACEHOLDER),
        },
        splitLine: {
          lineStyle: { color: resolved.tokens.border, type: [3, 3], width: 1 },
        },
      },
      tooltip: {
        ...tooltipBaseOption({
          present: true,
          cursor: true,
          tokens: resolved.tokens,
          position: "variable",
          axisPointerColor: resolved.tokens.border,
          strokeWidth: 1,
        }),
        formatter: (params) => {
          const first = Array.isArray(params) ? params[0] : params;
          const index = typeof first?.dataIndex === "number" ? first.dataIndex : 0;
          const row = rows[index];
          const money = (value: number) => privateText(formatMoney(value, currency));
          if (row.actual != null && !row.today) {
            const entries = [
              [actualLabel, row.actual, "actual"],
              ...(historicalOverlayLabel && row.historicalOverlay != null
                ? [[historicalOverlayLabel, row.historicalOverlay, "historicalOverlay"]]
                : []),
            ] as [string, number, string][];
            return tooltipShell({
              label: monthLabel(row.date),
              roundness: "xl",
              variant: "default",
              body: entries
                .map(([label, value, key]) =>
                  tooltipRow({
                    indicatorHtml: tooltipIndicatorHtml(key, 1),
                    labelText: label,
                    valueText: money(value),
                    dimmed: "",
                  }),
                )
                .join(""),
            });
          }
          const entries = [
            [medianLabel, row.p50, "forecast"],
            [meanLabel, row.mean, "mean"],
            [rangeLabel, `${money(row.p10)} – ${money(row.p90)}`, "actual"],
          ] as const;
          return tooltipShell({
            label: row.today ? todayLabel : monthLabel(row.date),
            roundness: "xl",
            variant: "default",
            body: entries
              .map(([label, value, key]) =>
                tooltipRow({
                  indicatorHtml: tooltipIndicatorHtml(key, 1),
                  labelText: label,
                  valueText: typeof value === "number" ? money(value) : value,
                  dimmed: "",
                }),
              )
              .join(""),
          });
        },
      },
      series: [
        {
          id: "outer-base",
          type: "line",
          stack: "outer",
          data: rows.map((row) => (future(row) ? row.p10 : gap)),
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          silent: true,
        },
        {
          id: "outer-band",
          type: "line",
          stack: "outer",
          data: rows.map((row) => (future(row) ? numberOrGap(row.p90 - row.p10) : gap)),
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { color: withAlpha(forecastColor, 0.12) },
          silent: true,
        },
        {
          id: "inner-base",
          type: "line",
          stack: "inner",
          data: rows.map((row) => (future(row) ? row.p25 : gap)),
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          silent: true,
        },
        {
          id: "inner-band",
          type: "line",
          stack: "inner",
          data: rows.map((row) => (future(row) ? numberOrGap(row.p75 - row.p25) : gap)),
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { color: withAlpha(forecastColor, 0.2) },
          silent: true,
        },
        ...buildForecastLineSeries({
          rows,
          actualLabel,
          medianLabel,
          meanLabel,
          historicalOverlayLabel,
          actualColor,
          forecastColor,
          historicalOverlayColor,
          mutedColor: resolved.tokens.mutedForeground,
          todayLabel,
        }),
      ],
    };
    chart.setOption(option, { notMerge: true });
  }, [
    actualLabel,
    config,
    currency,
    historicalOverlayLabel,
    meanLabel,
    medianLabel,
    privateText,
    rangeLabel,
    rows,
    todayLabel,
  ]);

  return (
    <div data-chart={chartId} className="h-[260px] w-full sm:h-[320px]" role="img" aria-label={ariaLabel}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
