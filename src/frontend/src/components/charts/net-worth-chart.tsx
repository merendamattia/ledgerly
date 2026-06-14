"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

const chartConfig = {
  totalValue: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function NetWorthChart({
  data,
  currency,
}: {
  data: { date: string; totalValue: number }[];
  currency: string;
}) {
  const points = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    totalValue: d.totalValue,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <AreaChart data={points} margin={{ left: 12, right: 12 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-totalValue)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-totalValue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatMoney(Number(v), currency)}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v), currency)} />}
        />
        <Area
          dataKey="totalValue"
          type="monotone"
          fill="url(#netWorthFill)"
          stroke="var(--color-totalValue)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
