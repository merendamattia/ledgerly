"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { axisBounds, compactMoney, formatMoney, shortDate } from "@/lib/format";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";

const chartConfig = {
  totalValue: { label: "Net worth", color: "var(--chart-1)" },
  invested: { label: "Invested", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/**
 * Renders historical net worth as an area chart. When points carry an
 * `invested` amount, a flat grey line tracks contributed capital so the gap
 * to the value area reads as gain/loss.
 */
export function NetWorthChart({
  data,
  currency,
  className = "h-[280px] w-full",
  valueLabel = "Net worth",
}: {
  data: { date: string; totalValue: number; invested?: number }[];
  currency: string;
  className?: string;
  valueLabel?: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const hasInvested = data.some((d) => d.invested != null);
  const points = data.map((d) => ({
    date: shortDate(d.date),
    totalValue: d.totalValue,
    ...(hasInvested ? { invested: d.invested ?? null } : {}),
  }));
  // Bounds span every rendered series so no line clips off the top or bottom.
  const seriesValues = data.flatMap((d) =>
    hasInvested && d.invested != null ? [d.totalValue, d.invested] : [d.totalValue],
  );
  const { min: yMin, max: yMax, ticks: yTicks } = axisBounds(seriesValues);

  return (
    <ChartContainer
      config={{ ...chartConfig, totalValue: { ...chartConfig.totalValue, label: valueLabel } }}
      className={className}
    >
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
          domain={[yMin, yMax]}
          ticks={yTicks}
          tickLine={false}
          axisLine={false}
          width={46}
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
        {hasInvested ? (
          <Area
            dataKey="invested"
            type="monotone"
            fill="none"
            stroke="var(--color-invested)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3 }}
          />
        ) : null}
      </AreaChart>
    </ChartContainer>
  );
}
