"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import type { ComposeOption } from "echarts/core";
import type { LineSeriesOption } from "echarts/charts";
import type { GridComponentOption, TooltipComponentOption } from "echarts/components";
import * as echarts from "echarts/core";
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

echarts.use([LineChart, GridComponent, TooltipComponent]);

type ForecastOption = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>;

const numberOrGap = (value: number) => (Number.isFinite(value) ? value : "-");

/** Ledgerly-native Monte Carlo fan: solid actuals, dashed P50 and nested percentile bands. */
export function ForecastFanChart({
  rows,
  currency,
  todayLabel,
  actualLabel,
  medianLabel,
  meanLabel,
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
      }) satisfies ChartConfig,
    [actualLabel, color, medianLabel],
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
    const resolved = resolveColors(mount.parentElement ?? mount, config, ["actual", "forecast"]);
    const actualColor = resolved.series.actual[0];
    const forecastColor = resolved.series.forecast[0];
    const boundaryIndex = rows.findIndex((row) => row.today);
    const future = (row: ForecastChartRow) => row.today || row.actual == null;
    const gap = "-" as const;
    const option: ForecastOption = {
      animationDuration: 240,
      grid: { left: 8, right: 12, top: 18, bottom: 30, containLabel: true },
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
            return tooltipShell({
              label: monthLabel(row.date),
              roundness: "xl",
              variant: "default",
              body: tooltipRow({
                indicatorHtml: tooltipIndicatorHtml("actual", 1),
                labelText: actualLabel,
                valueText: money(row.actual),
                dimmed: "",
              }),
            });
          }
          const entries = [
            [medianLabel, row.p50],
            [meanLabel, row.mean],
            [rangeLabel, `${money(row.p10)} – ${money(row.p90)}`],
          ] as const;
          return tooltipShell({
            label: row.today ? todayLabel : monthLabel(row.date),
            roundness: "xl",
            variant: "default",
            body: entries
              .map(([label, value], index) =>
                tooltipRow({
                  indicatorHtml: tooltipIndicatorHtml(index === 2 ? "actual" : "forecast", 1),
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
        {
          id: "actual",
          name: actualLabel,
          type: "line",
          data: rows.map((row) => (row.actual == null ? gap : row.actual)),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: actualColor, width: 2.5, type: "solid" },
          itemStyle: { color: actualColor },
          markLine:
            boundaryIndex >= 0
              ? {
                  silent: true,
                  symbol: ["none", "none"],
                  label: {
                    show: true,
                    formatter: todayLabel,
                    color: resolved.tokens.mutedForeground,
                    fontSize: 11,
                  },
                  lineStyle: { color: resolved.tokens.mutedForeground, type: [3, 3], width: 1 },
                  data: [{ xAxis: boundaryIndex }],
                }
              : undefined,
        },
        {
          id: "forecast",
          name: medianLabel,
          type: "line",
          data: rows.map((row) => (future(row) ? row.p50 : gap)),
          showSymbol: false,
          lineStyle: { color: forecastColor, width: 2.5, type: [6, 4] },
          itemStyle: { color: forecastColor },
        },
      ],
    };
    chart.setOption(option, { notMerge: true });
  }, [actualLabel, config, currency, meanLabel, medianLabel, privateText, rangeLabel, rows, todayLabel]);

  return (
    <div data-chart={chartId} className="h-[260px] w-full sm:h-[320px]" role="img" aria-label={ariaLabel}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
