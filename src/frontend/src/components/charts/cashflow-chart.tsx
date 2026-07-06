"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

const chartConfig = {
  income: { label: "Income", color: "var(--positive)" },
  expense: { label: "Expense", color: "var(--negative)" },
  investment: { label: "Investments", color: "var(--accent-gold)" },
} satisfies ChartConfig;

/** Renders monthly income, expense and investment totals as a grouped bar chart. */
export function CashFlowChart({
  data,
  currency,
  className = "h-[260px] w-full",
}: {
  data: { month: string; income: number; expense: number; investment?: number }[];
  currency: string;
  className?: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const points = data.map((d) => ({
    month: monthLabel(`${d.month}-01`),
    income: d.income,
    expense: d.expense,
    investment: d.investment ?? 0,
  }));

  return (
    <ChartContainer config={chartConfig} className={className}>
      <BarChart data={points} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={46}
          tickCount={4}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) =>
            privateText(compactMoney(Number(v), currency), PRIVATE_COMPACT_PLACEHOLDER)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(v) => privateText(formatMoney(Number(v), currency))} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
        <Bar dataKey="investment" fill="var(--color-investment)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
