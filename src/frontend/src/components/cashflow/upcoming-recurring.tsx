"use client";

import { useMemo } from "react";
import { Repeat } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-badge";
import { MoneyAmount } from "@/components/money-amount";
import { RecurringExpenseDialog } from "@/components/recurring-expense-dialog";
import { useRecurringExpenses, type RecurringExpense } from "@/hooks/use-recurring";
import { occurrencesBetween } from "@/lib/recurring";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Upcoming = {
  key: string;
  date: Date;
  rule: RecurringExpense;
  signed: number;
};

// Recurring occurrences still due between today and the end of this month — a
// forecast (these movements are booked by the nightly cron on their date).
// Clicking a row opens the rule's edit/delete popup.
export function UpcomingRecurring({
  currency,
  className,
  alwaysShow = false,
}: {
  currency: string;
  className?: string;
  // When true, render an empty-state card instead of collapsing (so it can hold
  // a fixed grid column). When false, the card hides entirely if nothing is due.
  alwaysShow?: boolean;
}) {
  const { data } = useRecurringExpenses();

  const { items, net } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const out: Upcoming[] = [];

    for (const rule of data ?? []) {
      if (!rule.enabled) continue;
      for (const date of occurrencesBetween(rule, today, monthEnd)) {
        out.push({
          key: `${rule.id}-${date.toISOString()}`,
          date,
          rule,
          signed: rule.direction === "EXPENSE" ? -rule.amount : rule.amount,
        });
      }
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    const total = out.reduce((s, i) => s + i.signed, 0);
    return { items: out, net: total };
  }, [data]);

  // Nothing due this month — collapse entirely unless the host needs a card to
  // fill a fixed grid column.
  if (items.length === 0 && !alwaysShow) return null;

  return (
    <Card className={cn("gap-0 overflow-hidden p-6", className)}>
      <CardHeader className="flex flex-col gap-2 px-0">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 shrink-0 text-muted-foreground" />
          <CardTitle className="font-display font-semibold">Upcoming recurring</CardTitle>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            Until month end
          </span>
          {items.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Net
              <MoneyAmount value={net} currency={currency} colored signed className="font-mono text-sm font-semibold" />
            </span>
          ) : null}
        </div>
      </CardHeader>

      {items.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          Nothing recurring left this month.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y">
          {items.map((it) => (
            <li key={it.key}>
              <RecurringExpenseDialog
                rule={it.rule}
                trigger={
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <CategoryIcon
                      name={it.rule.category?.name}
                      emoji={it.rule.category?.emoji}
                      className="size-8 rounded-full"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium capitalize">
                        {it.rule.category?.name || "Recurring"}
                      </span>
                      {it.rule.note ? (
                        <span className="truncate text-xs text-foreground/70">{it.rule.note}</span>
                      ) : null}
                      <span className="truncate text-xs text-muted-foreground">
                        {formatDate(it.date)}
                      </span>
                    </div>
                    <MoneyAmount
                      value={it.signed}
                      currency={currency}
                      colored
                      signed
                      className="shrink-0 font-mono text-sm font-semibold"
                    />
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
