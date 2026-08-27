"use client";

import {
  EChartsPieChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-pie-chart";
import { formatMoney, truncate } from "@/lib/format";
import { MoneyAmount } from "@/components/money-amount";
import { usePrivateNumberFormatter } from "@/components/private-number";
import { useIsMobile } from "@/hooks/use-mobile";

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

/** Renders a donut chart and legend for asset allocation totals. */
export function AllocationChart({
  allocation,
  currency,
  labels,
  isLoading = false,
}: {
  allocation: Record<string, number>;
  currency: string;
  labels?: Record<string, string>;
  isLoading?: boolean;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const isMobile = useIsMobile();
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
    data.map((d) => [d.key, { label: d.name, colors: { light: [d.fill] } }]),
  ) satisfies ChartConfig;

  if (data.length === 0 && !isLoading) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No assets yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <EChartsPieChart
          config={chartConfig}
          data={data}
          dataKey="value"
          nameKey="key"
          isLoading={isLoading}
          className="aspect-square h-[176px] bg-transparent p-0 sm:h-[200px] sm:p-0"
        >
          <EChartsPieChart.Tooltip
            roundness="xl"
            valueFormatter={(value) => privateText(formatMoney(value, currency))}
          />
          <EChartsPieChart.Pie
            innerRadius={isMobile ? 48 : 56}
            outerRadius={isMobile ? 76 : 86}
            paddingAngle={1.5}
            cornerRadius={6}
          />
        </EChartsPieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <MoneyAmount
            value={total}
            currency={currency}
            className="block max-w-[8.5rem] truncate text-center text-base font-semibold sm:text-lg"
          />
        </div>
      </div>

      <ul className="grid w-full gap-2.5">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: d.fill }} />
            <span className="min-w-0 flex-1 truncate" title={d.name}>
              {truncate(d.name, 20)}
            </span>
            <span className="shrink-0 font-mono font-semibold tabular-nums">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
            <span className="min-w-[56px] shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums sm:min-w-[64px]">
              <MoneyAmount value={d.value} currency={currency} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
