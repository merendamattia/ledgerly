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
import { formatMoney, monthLabel } from "@/lib/format";

const chartConfig = {
  income: { label: "Income", color: "var(--positive)" },
  expense: { label: "Expense", color: "var(--negative)" },
} satisfies ChartConfig;

function compactMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// Income vs expense as two distinct lines over the selected range.
export function CashFlowLineChart({
  data,
  currency,
}: {
  data: { month: string; income: number; expense: number }[];
  currency: string;
}) {
  const points = data.map((d) => ({
    month: monthLabel(`${d.month}-01`),
    income: d.income,
    expense: d.expense,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <LineChart data={points} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
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
        <Line
          dataKey="income"
          type="monotone"
          stroke="var(--color-income)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="expense"
          type="monotone"
          stroke="var(--color-expense)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
