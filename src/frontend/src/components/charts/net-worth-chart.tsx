"use client";

import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { compactMoney, formatMoney, shortDate } from "@/lib/format";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";

const chartConfig = {
  totalValue: { label: "Net worth", colors: { light: ["var(--chart-1)"] } },
  invested: { label: "Invested", colors: { light: ["var(--muted-foreground)"] } },
  performance: { label: "Return", colors: { light: ["var(--chart-1)"] } },
} satisfies ChartConfig;

/**
 * Renders historical net worth as an area chart. When points carry an
 * `invested` amount, a flat grey line tracks contributed capital so the gap
 * to the value area reads as gain/loss.
 */
export function NetWorthChart({
  data,
  currency,
  className = "h-[240px] w-full sm:h-[280px]",
  valueLabel = "Net worth",
  isLoading = false,
}: {
  data: { date: string; totalValue: number; invested?: number }[];
  currency: string;
  className?: string;
  valueLabel?: string;
  isLoading?: boolean;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const hasInvested = data.some((d) => d.invested != null);
  const points = data.map((d) => ({
    date: shortDate(d.date),
    totalValue: d.totalValue,
    invested: d.invested ?? 0,
    performance: d.totalValue - (d.invested ?? 0),
  }));

  return (
    <EChartsAreaChart
      config={{
        ...chartConfig,
        totalValue: { ...chartConfig.totalValue, label: valueLabel },
      }}
      data={points}
      className={className}
      xDataKey="date"
      curveType="monotone"
      stackType="stacked"
      enableHoverHighlight
      isLoading={isLoading}
    >
      <EChartsAreaChart.Grid />
      <EChartsAreaChart.XAxis dataKey="date" hideDots />
      <EChartsAreaChart.YAxis
        hideDots
        tickFormatter={(v) =>
          privateText(compactMoney(Number(v), currency), PRIVATE_COMPACT_PLACEHOLDER)
        }
      />
      <EChartsAreaChart.Tooltip
        roundness="xl"
        valueFormatter={(value) => privateText(formatMoney(value, currency))}
      />
      {hasInvested ? (
        <EChartsAreaChart.Area
          dataKey="invested"
          variant="dotted"
          strokeVariant="solid"
          strokeWidth={1.5}
        >
          <EChartsAreaChart.ActiveDot variant="border" />
        </EChartsAreaChart.Area>
      ) : null}
      {hasInvested ? (
        <EChartsAreaChart.Area
          dataKey="performance"
          variant="dotted"
          strokeVariant="solid"
          strokeWidth={2.5}
        >
          <EChartsAreaChart.ActiveDot variant="border" />
        </EChartsAreaChart.Area>
      ) : (
        <EChartsAreaChart.Area
          dataKey="totalValue"
          variant="dotted"
          strokeVariant="solid"
          strokeWidth={2.5}
        >
          <EChartsAreaChart.ActiveDot variant="border" />
        </EChartsAreaChart.Area>
      )}
    </EChartsAreaChart>
  );
}
