"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { compactMoney, formatMoney } from "@/lib/format";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";

export type CategoryDatum = { name: string; value: number };

/**
 * Renders horizontal category bars sorted for readable top-to-bottom scanning.
 */
export function CategoryBarChart({
  data,
  currency,
  fallback,
}: {
  data: CategoryDatum[];
  currency: string;
  fallback: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No data in range.
      </div>
    );
  }

  const chartConfig = { value: { label: "Amount", color: fallback } } satisfies ChartConfig;
  // ~34px per row keeps bars comfortable without a fixed aspect ratio.
  const height = Math.max(160, data.length * 34 + 24);

  return (
    <ChartContainer
      config={chartConfig}
      className="!aspect-auto w-full"
      style={{ height }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
      >
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            privateText(compactMoney(Number(v), currency), PRIVATE_COMPACT_PLACEHOLDER)
          }
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={112}
          tickMargin={6}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(v) => privateText(formatMoney(Number(v), currency))} />
          }
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar dataKey="value" radius={4} fill="var(--color-value)" />
      </BarChart>
    </ChartContainer>
  );
}
