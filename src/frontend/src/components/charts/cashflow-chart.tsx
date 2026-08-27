"use client";

import {
  EChartsBarChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-bar-chart";
import { compactMoney, formatMoney, monthLabel } from "@/lib/format";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";
import { useIsMobile } from "@/hooks/use-mobile";

const chartConfig = {
  income: { label: "Income", colors: { light: ["var(--positive)"] } },
  expense: { label: "Expense", colors: { light: ["var(--negative)"] } },
  investment: { label: "Investments", colors: { light: ["var(--accent-gold)"] } },
} satisfies ChartConfig;

/** Renders monthly income vs. a stacked expense+investment bar (red under orange). */
export function CashFlowChart({
  data,
  currency,
  className = "h-[240px] w-full sm:h-[260px]",
  isLoading = false,
}: {
  data: { month: string; income: number; expense: number; investment?: number }[];
  currency: string;
  className?: string;
  isLoading?: boolean;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const isMobile = useIsMobile();
  const visible = isMobile ? data.slice(-6) : data;
  const points = visible.map((d) => ({
    month: monthLabel(`${d.month}-01`),
    income: d.income,
    expense: d.expense,
    investment: d.investment ?? 0,
  }));

  return (
    <EChartsBarChart
      config={chartConfig}
      data={points}
      xDataKey="month"
      className={className}
      barRadius={4}
      barCategoryGap={isMobile ? 10 : 18}
      isLoading={isLoading}
    >
      <EChartsBarChart.Grid />
      <EChartsBarChart.XAxis dataKey="month" hideDots />
      <EChartsBarChart.YAxis
        hideDots
        tickFormatter={(v) =>
          privateText(compactMoney(Number(v), currency), PRIVATE_COMPACT_PLACEHOLDER)
        }
      />
      <EChartsBarChart.Tooltip
        roundness="xl"
        valueFormatter={(value) => privateText(formatMoney(value, currency))}
      />
      <EChartsBarChart.Legend
        align="center"
        verticalAlign="bottom"
        variant="rounded-square"
      />
      <EChartsBarChart.Bar dataKey="income" />
      <EChartsBarChart.Bar dataKey="expense" stackId="outflow" />
      <EChartsBarChart.Bar dataKey="investment" stackId="outflow" />
    </EChartsBarChart>
  );
}
