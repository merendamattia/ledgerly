"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CategoryBars,
  CategoryBreakdownCard,
  type CategorySlice,
} from "@/components/category-breakdown";
import { MoneyAmount } from "@/components/money-amount";
import { cn } from "@/lib/utils";

type Mode = "expense" | "income";
const MAX_ROWS = 6;

/** Renders the cashflow category breakdown with expense/income switching. */
export function CategoryBreakdown({
  expenses,
  income,
  expenseTotal,
  incomeTotal,
  currency,
  periodLabel,
}: {
  expenses: CategorySlice[];
  income: CategorySlice[];
  expenseTotal: number;
  incomeTotal: number;
  currency: string;
  periodLabel: string;
}) {
  const [mode, setMode] = useState<Mode>("expense");
  const isIncome = mode === "income";
  const items = isIncome ? income : expenses;
  const total = isIncome ? incomeTotal : expenseTotal;
  const title = isIncome ? "Where money comes from" : "Where money goes";
  const totalLabel = isIncome ? "Total income" : "Total expenses";
  const max = items.reduce((m, c) => Math.max(m, c.value), 0);

  const toggle = (
    <div className="flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
      {(["expense", "income"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            mode === m ? "bg-card text-foreground shadow-card" : "text-muted-foreground",
          )}
        >
          {m === "expense" ? "Expenses" : "Income"}
        </button>
      ))}
    </div>
  );

  const action =
    items.length > MAX_ROWS ? (
      <Dialog>
        <DialogTrigger
          render={
            <button type="button" className="text-sm font-semibold text-positive">
              View all →
            </button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              <MoneyAmount value={total} currency={currency} /> across {items.length} categories
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto pr-1">
            <CategoryBars items={items} currency={currency} max={max} />
          </div>
        </DialogContent>
      </Dialog>
    ) : null;

  return (
    <CategoryBreakdownCard
      title={title}
      subtitle={periodLabel}
      items={items}
      total={total}
      totalLabel={totalLabel}
      currency={currency}
      headerExtra={toggle}
      action={action}
      maxRows={MAX_ROWS}
      aggregateOther
      emptyText="No data in range."
      className="h-full"
    />
  );
}
