"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { compactMoney, formatMoney, shortDate } from "@/lib/format";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";

const chartConfig = {
  totalValue: { label: "Net worth", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Renders historical net worth as an area chart. */
export function NetWorthChart({
  data,
  currency,
  className = "h-[280px] w-full",
}: {
  data: { date: string; totalValue: number }[];
  currency: string;
  className?: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const points = data.map((d) => ({
    date: shortDate(d.date),
    totalValue: d.totalValue,
  }));

  return (
    <ChartContainer config={chartConfig} className={className}>
      <AreaChart data={points} margin={{ left: 0, right: 8 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-totalValue)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-totalValue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
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
