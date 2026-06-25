import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { MoneyAmount } from "@/components/money-amount";
import { cn } from "@/lib/utils";

// Categorical ramp from the "modern ledger" design.
export const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export interface CategorySlice {
  name: string;
  value: number;
}

// A list of labelled bars: name + amount on top, a track-backed bar below whose
// width is relative to `max` so categories compare at a glance.
export function CategoryBars({
  items,
  currency,
  max,
}: {
  items: CategorySlice[];
  currency: string;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((c, i) => (
        <div key={c.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="capitalize">{c.name}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              <MoneyAmount value={c.value} currency={currency} />
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full animate-grow rounded-full"
              style={{
                width: max > 0 ? `${(c.value / max) * 100}%` : "0%",
                background: c.name === "Other" ? "var(--muted-foreground)" : BAR_COLORS[i % BAR_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Reusable "X by category" card: title (+ optional subtitle), an action slot
// (View all link/dialog) and an optional header extra (e.g. a toggle) on the
// right, the top `maxRows` bars, and the running total at the foot.
export function CategoryBreakdownCard({
  title,
  subtitle,
  items,
  total,
  totalLabel,
  currency,
  action,
  headerExtra,
  maxRows = 6,
  aggregateOther = false,
  emptyText = "No data yet.",
  className,
}: {
  title: string;
  subtitle?: string;
  items: CategorySlice[];
  total: number;
  totalLabel: string;
  currency: string;
  action?: ReactNode;
  headerExtra?: ReactNode;
  maxRows?: number;
  /** When true, anything past `maxRows` collapses into a final "Other" row. */
  aggregateOther?: boolean;
  emptyText?: string;
  className?: string;
}) {
  // With aggregateOther, the last visible row sums every remaining category so
  // the bars always add up to the total.
  const shown =
    aggregateOther && items.length > maxRows
      ? [
          ...items.slice(0, maxRows - 1),
          {
            name: "Other",
            value: items.slice(maxRows - 1).reduce((s, c) => s + c.value, 0),
          },
        ]
      : items.slice(0, maxRows);
  const max = shown.reduce((m, c) => Math.max(m, c.value), 0);

  return (
    <Card className={cn("gap-0 p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {headerExtra || action ? (
          <div className="flex shrink-0 items-center gap-3">
            {headerExtra}
            {action}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <CategoryBars items={shown} currency={currency} max={max} />
        )}
      </div>

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-sm font-medium text-muted-foreground">{totalLabel}</span>
          <span className="font-mono text-base font-semibold tabular-nums">
            <MoneyAmount value={total} currency={currency} />
          </span>
        </div>
      ) : null}
    </Card>
  );
}
