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
  investments: { label: "Investments", colors: { light: ["var(--positive)"] } },
  cash: { label: "Liquidity", colors: { light: ["var(--chart-3)"] } },
  credits: { label: "Credits", colors: { light: ["var(--chart-4)"] } },
  otherAssets: { label: "Other assets", colors: { light: ["var(--chart-5)"] } },
} satisfies ChartConfig;

type Point = {
  date: string;
  cash: number;
  credits: number;
  otherAssets: number;
  investments: number;
};

/** Stacked net-worth composition of tracked assets, excluding liabilities. */
export function NetWorthCompositionChart({
  data,
  currency,
  className = "h-[260px] w-full sm:h-[300px]",
  isLoading = false,
}: {
  data: Point[];
  currency: string;
  className?: string;
  isLoading?: boolean;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const points = data.map((p) => ({
    date: shortDate(p.date),
    cash: p.cash,
    credits: p.credits,
    otherAssets: p.otherAssets,
    investments: p.investments,
  }));

  return (
    <EChartsAreaChart
      config={chartConfig}
      data={points}
      xDataKey="date"
      className={className}
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
      <EChartsAreaChart.Legend
        align="center"
        verticalAlign="bottom"
        variant="rounded-square"
      />
      <EChartsAreaChart.Area
        dataKey="cash"
        variant="dotted"
        strokeVariant="solid"
        strokeWidth={1.5}
      />
      <EChartsAreaChart.Area
        dataKey="credits"
        variant="dotted"
        strokeVariant="solid"
        strokeWidth={1.5}
      />
      <EChartsAreaChart.Area
        dataKey="otherAssets"
        variant="dotted"
        strokeVariant="solid"
        strokeWidth={1.5}
      />
      <EChartsAreaChart.Area
        dataKey="investments"
        variant="dotted"
        strokeVariant="solid"
        strokeWidth={1.8}
      />
    </EChartsAreaChart>
  );
}
