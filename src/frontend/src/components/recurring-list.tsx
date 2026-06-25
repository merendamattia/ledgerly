"use client";

import { Plus, Repeat } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/category-badge";
import { MoneyAmount } from "@/components/money-amount";
import { RecurringExpenseDialog } from "@/components/recurring-expense-dialog";
import { useRecurringExpenses, type RecurringExpense } from "@/hooks/use-recurring";
import { cadenceLabel } from "@/lib/recurring";
import { formatDate } from "@/lib/format";

/**
 * Renders recurring rule management: creation and editable rule rows.
 */
export function RecurringList({ currency }: { currency: string }) {
  const { data, isLoading } = useRecurringExpenses();

  return (
    <Card className="gap-0 overflow-hidden p-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-0">
        <CardTitle className="flex items-center gap-2 font-display font-semibold">
          <Repeat className="size-4 text-muted-foreground" />
          Recurring
        </CardTitle>
        <RecurringExpenseDialog
          trigger={
            <Button size="sm">
              <Plus data-icon="inline-start" />
              Add
            </Button>
          }
        />
      </CardHeader>

      {isLoading ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No recurring movements yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y">
          {data.map((rule) => (
            <li key={rule.id}>
              <RecurringExpenseDialog
                rule={rule}
                trigger={
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <RuleRow rule={rule} currency={currency} />
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

/** Renders one recurring rule row for the recurring management list. */
function RuleRow({ rule, currency }: { rule: RecurringExpense; currency: string }) {
  const signed = rule.direction === "EXPENSE" ? -rule.amount : rule.amount;
  return (
    <>
      <CategoryIcon
        name={rule.category?.name}
        emoji={rule.category?.emoji}
        className="size-8 rounded-full"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium capitalize">
          {rule.category?.name || "Recurring"}
          {!rule.enabled ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
              Paused
            </span>
          ) : null}
        </span>
        {rule.note ? (
          <span className="truncate text-xs text-foreground/70">{rule.note}</span>
        ) : null}
        <span className="truncate text-xs text-muted-foreground">
          {cadenceLabel(rule.intervalUnit, rule.intervalCount)}
          {rule.enabled ? ` · next ${formatDate(rule.nextRunDate)}` : ""}
        </span>
      </div>
      <MoneyAmount
        value={signed}
        currency={currency}
        colored
        signed
        className="shrink-0 font-mono text-sm font-semibold"
      />
    </>
  );
}
