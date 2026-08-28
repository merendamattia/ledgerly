"use client";

import { useState } from "react";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { MoneyAmount } from "@/components/money-amount";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SEGMENTED_CONTROL_ACTIVE_CLASS,
  SEGMENTED_CONTROL_CLASS,
  SEGMENTED_CONTROL_INACTIVE_CLASS,
  SEGMENTED_CONTROL_ITEM_CLASS,
} from "@/components/segmented-control";
import {
  summarizeTransactionCategories,
  type TransactionCategoryRow,
} from "@/lib/transaction-period";
import { cn } from "@/lib/utils";

const INCOME_COLORS = ["#155e3b", "#1c7a4d", "#3d9668", "#69ad88", "#96c8ad", "#c0dfcf"];
const EXPENSE_COLORS = ["#8f3025", "#b94731", "#db5a3c", "#e8765b", "#ee9b87", "#f4c1b5"];
type CategoryMode = "expenses" | "income";

/** Shows bounded-period totals and category composition for Activity. */
export function ActivityPeriodInsights({
  summary,
  rows,
  currency,
  periodLabel,
  isLoading,
}: {
  summary?: { income: number; expenses: number; net: number };
  rows: readonly TransactionCategoryRow[];
  currency: string;
  periodLabel: string;
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<CategoryMode>("expenses");
  const categories = summarizeTransactionCategories(rows);
  const metrics = [
    { label: "Income", value: summary?.income, color: "#9fd356", signed: true },
    {
      label: "Expenses",
      value: summary ? -summary.expenses : undefined,
      color: "#e8765b",
      signed: false,
    },
    {
      label: "Net",
      value: summary?.net,
      color: summary && summary.net < 0 ? "#e8765b" : "var(--primary)",
      signed: true,
    },
  ];
  const showingExpenses = mode === "expenses";

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="gap-0 border-0 bg-sidebar py-0 text-sidebar-accent-foreground ring-0">
        <CardHeader className="gap-0 border-b border-sidebar-border py-5">
          <CardTitle className="text-sidebar-accent-foreground">Period summary</CardTitle>
          <CardDescription className="mt-1 text-xs text-sidebar-foreground">
            {periodLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 divide-x divide-sidebar-border px-0 py-5">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 px-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-sidebar-foreground sm:text-xs">
                <span className="size-2 shrink-0 rounded-[3px]" style={{ background: metric.color }} />
                <span className="truncate">{metric.label}</span>
              </div>
              <p
                className="mt-2 truncate font-mono text-[clamp(0.85rem,4.4vw,1.5rem)] font-semibold tracking-tight tabular-nums"
                style={{ color: metric.color }}
              >
                {metric.value !== undefined ? (
                  <MoneyAmount
                    value={metric.value}
                    currency={currency}
                    signed={metric.signed}
                  />
                ) : isLoading ? (
                  "…"
                ) : (
                  "—"
                )}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <CategoryInsightCard
        mode={mode}
        onModeChange={setMode}
        title={showingExpenses ? "Expenses by category" : "Income by category"}
        emptyText={showingExpenses ? "No expenses in this period." : "No income in this period."}
        allocation={showingExpenses ? categories.expenses : categories.income}
        labels={categories.labels}
        currency={currency}
        periodLabel={periodLabel}
        isLoading={isLoading}
        colors={showingExpenses ? EXPENSE_COLORS : INCOME_COLORS}
      />
    </div>
  );
}

function CategoryInsightCard({
  mode,
  onModeChange,
  title,
  emptyText,
  allocation,
  labels,
  currency,
  periodLabel,
  isLoading,
  colors,
}: {
  mode: CategoryMode;
  onModeChange: (mode: CategoryMode) => void;
  title: string;
  emptyText: string;
  allocation: Record<string, number>;
  labels: Record<string, string>;
  currency: string;
  periodLabel: string;
  isLoading: boolean;
  colors: readonly string[];
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-1">{periodLabel}</CardDescription>
        </div>
        <div className={cn(SEGMENTED_CONTROL_CLASS, "w-full shrink-0 sm:w-auto")}>
          {(["expenses", "income"] as CategoryMode[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => onModeChange(option)}
              className={cn(
                SEGMENTED_CONTROL_ITEM_CLASS,
                mode === option
                  ? SEGMENTED_CONTROL_ACTIVE_CLASS
                  : SEGMENTED_CONTROL_INACTIVE_CLASS,
              )}
            >
              {option === "expenses" ? "Expenses" : "Income"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <AllocationChart
          allocation={allocation}
          labels={labels}
          currency={currency}
          isLoading={isLoading}
          emptyText={emptyText}
          colors={colors}
          layout="responsive"
        />
      </CardContent>
    </Card>
  );
}
