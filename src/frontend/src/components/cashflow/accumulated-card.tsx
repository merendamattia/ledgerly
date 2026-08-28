import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { MoneyAmount } from "@/components/money-amount";

/**
 * Renders year-to-date cumulative savings with current-month delta and sparkline.
 */
export function AccumulatedCard({
  total,
  monthDelta,
  series,
  currency,
}: {
  total: number;
  monthDelta: number;
  series: number[];
  currency: string;
}) {
  const positive = monthDelta >= 0;
  return (
    <Card className="h-full gap-0 p-6">
      <CardHeader className="px-0">
        <CardTitle className="font-display text-sm font-semibold">Accumulated savings</CardTitle>
      </CardHeader>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            <MoneyAmount value={total} currency={currency} />
          </span>
          <span className="text-xs font-medium text-muted-foreground">YTD</span>
        </span>
        <span
          className={
            positive
              ? "inline-flex w-fit items-center rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground"
              : "inline-flex w-fit items-center rounded-full bg-negative/10 px-2.5 py-1 text-xs font-semibold text-negative-ink"
          }
        >
          {positive ? "+" : ""}
          <MoneyAmount value={Math.abs(monthDelta)} currency={currency} /> this month
        </span>
      </div>
      <div className="mt-auto pt-4">
        {series.length >= 2 ? (
          <Sparkline values={series} width={240} height={48} className="h-12 w-full" stroke="var(--positive)" />
        ) : null}
      </div>
    </Card>
  );
}
