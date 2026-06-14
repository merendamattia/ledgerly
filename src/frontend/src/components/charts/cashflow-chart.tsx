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
import { formatMoney } from "@/lib/format";

const chartConfig = {
  income: { label: "Income", color: "var(--chart-2)" },
  expense: { label: "Expense", color: "var(--chart-3)" },
} satisfies ChartConfig;

// Compact money for the Y axis (e.g. "€2.0k") to keep ticks narrow.
function compactMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function CashFlowChart({
  data,
  currency,
}: {
  data: { month: string; income: number; expense: number }[];
  currency: string;
}) {
  const withYear = data.length > 12;
  const points = data.map((d) => ({
    month: new Date(`${d.month}-01`).toLocaleDateString("en-GB", {
      month: "short",
      ...(withYear ? { year: "2-digit" } : {}),
    }),
    income: d.income,
    expense: d.expense,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <BarChart data={points} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v) => compactMoney(Number(v), currency)}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v), currency)} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
