"use client";

import { Calendar, Repeat } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-badge";
import { MoneyAmount } from "@/components/money-amount";
import { RecurringExpenseDialog } from "@/components/recurring-expense-dialog";
import { useExpenses, type Transaction } from "@/hooks/use-expenses";
import { useRecurringExpenses, type RecurringExpense } from "@/hooks/use-recurring";
import { occurrencesBetween, type OccurrenceRule } from "@/lib/recurring";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type RecurringUpcoming = {
  kind: "recurring";
  key: string;
  date: Date;
  rule: RecurringExpense;
  signed: number;
};

type TransactionUpcoming = {
  kind: "transaction";
  key: string;
  date: Date;
  transaction: Transaction;
  signed: number;
};

type Upcoming = RecurringUpcoming | TransactionUpcoming;

/** Formats a local calendar day for date-only API filters. */
function isoDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Converts serialized dates to the intended local calendar day. */
function localDay(value: string | Date): Date {
  if (typeof value === "string") {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Returns the next 10 future calendar days, excluding movements dated today. */
function upcomingWindow() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
  return { start: tomorrow, end, from: isoDay(tomorrow), to: isoDay(end) };
}

/**
 * Builds the remaining recurring forecast from nextRunDate so generated
 * recurring transactions are not shown twice.
 */
function forecastRule(rule: RecurringExpense): OccurrenceRule | null {
  let maxOccurrences = rule.maxOccurrences;
  if (rule.endMode === "AFTER_OCCURRENCES" && rule.maxOccurrences != null) {
    const remaining = rule.maxOccurrences - rule.occurrencesCount;
    if (remaining <= 0) return null;
    maxOccurrences = remaining;
  }

  return {
    startDate: rule.nextRunDate,
    intervalUnit: rule.intervalUnit,
    intervalCount: rule.intervalCount,
    endMode: rule.endMode,
    maxOccurrences,
    endDate: rule.endDate,
  };
}

/**
 * Renders upcoming real movements and recurring forecasts for the next 10 days.
 */
export function UpcomingMovement({
  currency,
  className,
  alwaysShow = false,
  onTransactionClick,
}: {
  currency: string;
  className?: string;
  // When true, render an empty-state card instead of collapsing (so it can hold
  // a fixed grid column). When false, the card hides entirely if nothing is due.
  alwaysShow?: boolean;
  onTransactionClick?: (transaction: Transaction) => void;
}) {
  const upcomingRange = upcomingWindow();
  const recurring = useRecurringExpenses();
  const futureTransactions = useExpenses({
    from: upcomingRange.from,
    to: upcomingRange.to,
    limit: 5000,
  });

  const { items, net } = (() => {
    const out: Upcoming[] = [];

    for (const transaction of futureTransactions.data ?? []) {
      out.push({
        kind: "transaction",
        key: `transaction-${transaction.id}`,
        date: localDay(transaction.date),
        transaction,
        signed: transaction.direction === "EXPENSE" ? -transaction.amount : transaction.amount,
      });
    }

    for (const rule of recurring.data ?? []) {
      if (!rule.enabled) continue;
      const forecast = forecastRule(rule);
      if (!forecast) continue;

      for (const date of occurrencesBetween(forecast, upcomingRange.start, upcomingRange.end)) {
        out.push({
          kind: "recurring",
          key: `recurring-${rule.id}-${date.toISOString()}`,
          date,
          rule,
          signed: rule.direction === "EXPENSE" ? -rule.amount : rule.amount,
        });
      }
    }

    out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
    const total = out.reduce((s, i) => s + i.signed, 0);
    return { items: out, net: total };
  })();

  if (items.length === 0 && !alwaysShow) return null;

  return (
    <Card className={cn("gap-0 overflow-hidden p-6", className)}>
      <CardHeader className="flex flex-col gap-2 px-0">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <CardTitle className="font-display font-semibold">Upcoming movement</CardTitle>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            Next 10 days
          </span>
          {items.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Net
              <MoneyAmount
                value={net}
                currency={currency}
                colored
                signed
                className="font-mono text-sm font-semibold"
              />
            </span>
          ) : null}
        </div>
      </CardHeader>

      {items.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No upcoming movements.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y">
          {items.map((it) => (
            <li key={it.key}>
              {it.kind === "recurring" ? (
                <RecurringRow item={it} currency={currency} />
              ) : (
                <TransactionRow
                  item={it}
                  currency={currency}
                  onClick={onTransactionClick}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecurringRow({ item, currency }: { item: RecurringUpcoming; currency: string }) {
  return (
    <RecurringExpenseDialog
      rule={item.rule}
      trigger={
        <button
          type="button"
          className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40"
        >
          <CategoryIcon
            name={item.rule.category?.name}
            emoji={item.rule.category?.emoji}
            className="size-8 rounded-full"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 truncate text-sm font-medium capitalize">
              {item.rule.category?.name || "Recurring"}
              <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Recurring" />
            </span>
            {item.rule.note ? (
              <span className="truncate text-xs text-foreground/70">{item.rule.note}</span>
            ) : null}
            <span className="truncate text-xs text-muted-foreground">
              {formatDate(item.date)}
            </span>
          </div>
          <MoneyAmount
            value={item.signed}
            currency={currency}
            colored
            signed
            className="shrink-0 font-mono text-sm font-semibold"
          />
        </button>
      }
    />
  );
}

function TransactionRow({
  item,
  currency,
  onClick,
}: {
  item: TransactionUpcoming;
  currency: string;
  onClick?: (transaction: Transaction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(item.transaction)}
      className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40"
    >
      <CategoryIcon
        name={item.transaction.category?.name}
        emoji={item.transaction.category?.emoji}
        className="size-8 rounded-full"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium capitalize">
          {item.transaction.category?.name || "Transaction"}
        </span>
        {item.transaction.note ? (
          <span className="truncate text-xs text-foreground/70">{item.transaction.note}</span>
        ) : null}
        <span className="truncate text-xs text-muted-foreground">
          {formatDate(item.date)}
        </span>
      </div>
      <MoneyAmount
        value={item.signed}
        currency={currency}
        colored
        signed
        className="shrink-0 font-mono text-sm font-semibold"
      />
    </button>
  );
}
