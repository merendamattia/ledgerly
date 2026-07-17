"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { compactMoney, formatMoney, shortDate } from "@/lib/format";
import {
  PRIVATE_COMPACT_PLACEHOLDER,
  usePrivateNumberFormatter,
} from "@/components/private-number";
import { useIsMobile } from "@/hooks/use-mobile";

const chartConfig = {
  investments: { label: "Investments", color: "var(--positive)" },
  cash: { label: "Liquidity", color: "var(--chart-3)" },
  credits: { label: "Credits", color: "var(--chart-4)" },
  otherAssets: { label: "Other assets", color: "var(--chart-5)" },
} satisfies ChartConfig;

type Point = {
  date: string;
  cash: number;
  credits: number;
  otherAssets: number;
  investments: number;
};

/** Stacked net-worth composition of tracked assets, excluding liabilities. */
export function NetWorthCompositionChart({
  data,
  currency,
  className = "h-[260px] w-full sm:h-[300px]",
}: {
  data: Point[];
  currency: string;
  className?: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const isMobile = useIsMobile();
  const points = data.map((p) => ({
    date: shortDate(p.date),
    cash: p.cash,
    credits: p.credits,
    otherAssets: p.otherAssets,
    investments: p.investments,
  }));

  return (
    <ChartContainer config={chartConfig} className={className}>
      <AreaChart data={points} margin={{ left: 0, right: isMobile ? 4 : 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={isMobile ? 20 : 32}
          tick={{ fontSize: isMobile ? 10 : 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={isMobile ? 38 : 46}
          tick={{ fontSize: isMobile ? 10 : 11 }}
          tickFormatter={(v) =>
            privateText(compactMoney(Number(v), currency), PRIVATE_COMPACT_PLACEHOLDER)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v) => privateText(formatMoney(Number(v), currency))}
            />
          }
        />
        <ChartLegend
          content={
            <ChartLegendContent className="flex-wrap gap-x-3 gap-y-1 text-[10.5px] sm:text-xs" />
          }
        />
        <Area
          dataKey="cash"
          stackId="assets"
          type="monotone"
          fill="var(--color-cash)"
          stroke="var(--color-cash)"
          fillOpacity={0.78}
          strokeWidth={1.5}
          dot={false}
        />
        <Area
          dataKey="credits"
          stackId="assets"
          type="monotone"
          fill="var(--color-credits)"
          stroke="var(--color-credits)"
          fillOpacity={0.68}
          strokeWidth={1.5}
          dot={false}
        />
        <Area
          dataKey="otherAssets"
          stackId="assets"
          type="monotone"
          fill="var(--color-otherAssets)"
          stroke="var(--color-otherAssets)"
          fillOpacity={0.66}
          strokeWidth={1.5}
          dot={false}
        />
        <Area
          dataKey="investments"
          stackId="assets"
          type="monotone"
          fill="var(--color-investments)"
          stroke="var(--color-investments)"
          fillOpacity={0.74}
          strokeWidth={1.8}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
