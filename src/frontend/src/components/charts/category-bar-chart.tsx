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
import { useIsMobile } from "@/hooks/use-mobile";

export type CategoryDatum = { name: string; value: number };

function truncateLabel(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

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
  const isMobile = useIsMobile();
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No data in range.
      </div>
    );
  }

  const chartConfig = { value: { label: "Amount", color: fallback } } satisfies ChartConfig;
  // ~34px per row keeps bars comfortable without a fixed aspect ratio.
  const rowHeight = isMobile ? 30 : 34;
  const height = Math.max(160, data.length * rowHeight + 24);

  return (
    <ChartContainer
      config={chartConfig}
      className="!aspect-auto w-full"
      style={{ height }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: isMobile ? 0 : 8, right: isMobile ? 6 : 16, top: 4, bottom: 4 }}
      >
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickCount={isMobile ? 3 : 5}
          tick={{ fontSize: isMobile ? 10 : 11 }}
          tickFormatter={(v) =>
            privateText(compactMoney(Number(v), currency), PRIVATE_COMPACT_PLACEHOLDER)
          }
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={isMobile ? 72 : 112}
          tickMargin={isMobile ? 4 : 6}
          tick={{ fontSize: isMobile ? 10 : 11 }}
          tickFormatter={(v) => truncateLabel(String(v), isMobile ? 10 : 18)}
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
