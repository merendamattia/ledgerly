import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyAmount } from "@/components/money-amount";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export interface ComparisonRow {
  label: string;
  prev: number;
  curr: number;
  /** When true an increase is good (income/savings); false inverts (expenses). */
  goodWhenUp: boolean;
}

/** Renders one comparison metric over a center-origin diverging delta bar. */
function MetricRow({ row, currency }: { row: ComparisonRow; currency: string }) {
  const delta = row.prev !== 0 ? ((row.curr - row.prev) / Math.abs(row.prev)) * 100 : 0;
  const up = delta >= 0;
  const good = row.goodWhenUp ? up : !up;
  const tone = good ? "text-positive" : "text-negative-ink";
  const fill = good ? "bg-positive" : "bg-negative";
  // Diverging bar: grows from the center, right for an increase, left for a drop.
  const magnitude = Math.min(46, Math.abs(delta) * 1.2);
  const Arrow = up ? ArrowUp : ArrowDown;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{row.label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-semibold tabular-nums">
            <MoneyAmount value={row.curr} currency={currency} />
          </span>
          <span className={cn("inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums", tone)}>
            <Arrow className="size-3" />
            {row.prev !== 0 ? `${Math.abs(delta).toFixed(0)}%` : "—"}
          </span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted">
        <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-border" />
        <span
          className={cn("absolute top-0 h-full rounded-full", fill)}
          style={up ? { left: "50%", width: `${magnitude}%` } : { right: "50%", width: `${magnitude}%` }}
        />
      </div>
    </div>
  );
}

/** Renders current-period metrics against the previous selected cashflow period. */
export function ComparisonCard({
  prevLabel,
  rows,
  currency,
}: {
  prevLabel: string;
  rows: ComparisonRow[];
  currency: string;
}) {
  const t = useTranslations("cashflow");
  return (
    <Card className="h-full gap-0 p-5">
      <CardHeader className="flex flex-row items-baseline justify-between px-0">
        <CardTitle className="font-display font-semibold">{t("comparisonTitle")}</CardTitle>
        <span className="text-xs text-muted-foreground">{prevLabel}</span>
      </CardHeader>
      <div className="mt-4 flex flex-col gap-4">
        {rows.map((row) => (
          <MetricRow key={row.label} row={row} currency={currency} />
        ))}
      </div>
    </Card>
  );
}
