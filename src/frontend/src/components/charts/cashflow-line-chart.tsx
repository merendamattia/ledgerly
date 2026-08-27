"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { compactMoney, formatMoney, monthLabel } from "@/lib/format";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";
import { useIsMobile } from "@/hooks/use-mobile";

const chartConfig = {
  income: { label: "Income", color: "var(--positive)" },
  expense: { label: "Expense", color: "var(--negative)" },
} satisfies ChartConfig;

/** Renders income and expense as separate lines over the selected range. */
export function CashFlowLineChart({
  data,
  currency,
}: {
  data: { month: string; income: number; expense: number }[];
  currency: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const isMobile = useIsMobile();
  const points = data.map((d) => ({
    month: monthLabel(`${d.month}-01`),
    income: d.income,
    expense: d.expense,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full sm:h-[260px]">
      <LineChart data={points} margin={{ left: 0, right: isMobile ? 4 : 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={isMobile ? 10 : 16}
          tick={{ fontSize: isMobile ? 10 : 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={isMobile ? 38 : 46}
          tickCount={4}
          tick={{ fontSize: isMobile ? 10 : 11 }}
          tickFormatter={(v) =>
            privateText(compactMoney(Number(v), currency), PRIVATE_COMPACT_PLACEHOLDER)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(v) => privateText(formatMoney(Number(v), currency))} />
          }
          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
        />
        <ChartLegend
          content={
            <ChartLegendContent className="flex-wrap gap-x-3 gap-y-1 text-[10.5px] sm:text-xs" />
          }
        />
        <Line
          dataKey="income"
          type="monotone"
          stroke="var(--color-income)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-income)", stroke: "var(--card)", strokeWidth: 2 }}
        />
        <Line
          dataKey="expense"
          type="monotone"
          stroke="var(--color-expense)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-expense)", stroke: "var(--card)", strokeWidth: 2 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
