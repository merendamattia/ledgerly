"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

// Default labels for the asset-class view (Overview). Per-position callers pass
// their own `labels` map (holdingId → name).
const LABELS: Record<string, string> = {
  CASH: "Cash",
  CREDIT: "Credits",
  OTHER_ASSET: "Other assets",
  EQUITY: "Equity",
  ETF: "ETF",
  CRYPTO: "Crypto",
  BOND: "Bonds",
  COMMODITY: "Commodities",
};

export function AllocationChart({
  allocation,
  currency,
  labels,
}: {
  allocation: Record<string, number>;
  currency: string;
  labels?: Record<string, string>;
}) {
  const data = Object.entries(allocation)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value], i) => ({
      key,
      name: labels?.[key] ?? LABELS[key] ?? key,
      value,
      fill: PALETTE[i % PALETTE.length],
    }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  const chartConfig = Object.fromEntries(
    data.map((d) => [d.key, { label: d.name, color: d.fill }]),
  ) satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No assets yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <ChartContainer config={chartConfig} className="aspect-square h-[200px]">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v), currency)} />}
            />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} strokeWidth={2}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(total, currency)}</span>
        </div>
      </div>

      <ul className="grid w-full gap-2.5">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: d.fill }} />
            <span>{d.name}</span>
            <span className="ml-auto font-mono font-semibold tabular-nums">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
            <span className="min-w-[64px] text-right font-mono text-xs text-muted-foreground tabular-nums">
              {formatMoney(d.value, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
