"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { MoneyAmount } from "@/components/money-amount";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { useExpenses } from "@/hooks/use-expenses";
import { useSettings } from "@/hooks/use-settings";
import { formatMoney } from "@/lib/format";

// Period presets: month-precise quick filters first, then trailing ranges. All
// resolve to a from/to bound so figures are exact for the chosen window.
type Period =
  | "this-month"
  | "last-month"
  | "this-year"
  | "12m"
  | "24m"
  | "36m";

const PERIOD_LABELS: Record<Period, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  "12m": "Last 12 months",
  "24m": "Last 2 years",
  "36m": "Last 3 years",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function rangeFor(period: Period): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "this-month":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "last-month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "this-year":
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    case "12m":
      return { from: iso(new Date(y, m - 11, 1)), to: iso(now) };
    case "24m":
      return { from: iso(new Date(y, m - 23, 1)), to: iso(now) };
    case "36m":
      return { from: iso(new Date(y, m - 35, 1)), to: iso(now) };
  }
}

const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const cardClass = "border shadow-card ring-0 p-6 gap-0";

export default function CashFlowPage() {
  const [period, setPeriod] = useState<Period>("this-month");
  const settings = useSettings();
  const currency = settings.data?.baseCurrency ?? "EUR";

  const range = useMemo(() => rangeFor(period), [period]);
  const { data } = useExpenses({ from: range.from, to: range.to, limit: 5000 });
  const tx = useMemo(() => data ?? [], [data]);

  const income = tx.filter((t) => t.direction === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter((t) => t.direction === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const net = income - expense;
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;

  // Per-month income/expense buckets for the trend chart + cumulative line.
  const series = useMemo(() => {
    const buckets = new Map<string, { month: string; income: number; expense: number }>();
    for (const t of tx) {
      const month = t.date.slice(0, 7);
      const b = buckets.get(month) ?? { month, income: 0, expense: 0 };
      if (t.direction === "INCOME") b.income += t.amount;
      else b.expense += t.amount;
      buckets.set(month, b);
    }
    return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [tx]);

  const cumulative = useMemo(
    () =>
      series.reduce<{ date: string; totalValue: number }[]>((acc, d) => {
        const prev = acc.length ? acc[acc.length - 1].totalValue : 0;
        acc.push({ date: `${d.month}-01`, totalValue: prev + d.income - d.expense });
        return acc;
      }, []),
    [series],
  );

  // Expense totals by category for the "where money goes" breakdown.
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tx) {
      if (t.direction !== "EXPENSE") continue;
      const name = t.category?.name ?? "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + t.amount);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tx]);
  const expenseTotal = expenseByCategory.reduce((s, c) => s + c.value, 0) || 1;
  const maxCategory = expenseByCategory[0]?.value || 1;

  return (
    <div className="flex flex-col gap-5 animate-fu">
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <ImportTransactionsDialog />
        <Select
          value={period}
          items={PERIOD_LABELS}
          onValueChange={(v) => setPeriod((v ?? "this-month") as Period)}
        >
          <SelectTrigger className="h-10 w-[170px] rounded-xl border bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PERIOD_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label={`Income · ${PERIOD_LABELS[period]}`}
          value={formatMoney(income, currency)}
          icon={ArrowDownLeft}
          accent="positive"
        />
        <StatCard
          label={`Expenses · ${PERIOD_LABELS[period]}`}
          value={formatMoney(expense, currency)}
          icon={ArrowUpRight}
          accent="negative"
        />
        <Card className="gap-0 border-0 bg-sidebar p-5 text-sidebar-accent-foreground shadow-card ring-0">
          <span className="text-xs font-medium tracking-wide text-sidebar-foreground uppercase">
            Net flow · {PERIOD_LABELS[period]}
          </span>
          <span className="mt-3 font-mono text-3xl font-semibold tabular-nums text-primary">
            {net >= 0 ? "+" : ""}
            {formatMoney(net, currency)}
          </span>
          <span className="mt-1 text-xs text-sidebar-foreground">Savings rate {savingsRate}%</span>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className={`${cardClass} lg:col-span-7`}>
          <CardHeader className="px-0">
            <CardTitle className="font-display font-semibold">Monthly cash flow</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pt-4">
            {series.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data in range.</p>
            ) : (
              <CashFlowChart data={series} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card className={`${cardClass} lg:col-span-5`}>
          <CardHeader className="px-0">
            <CardTitle className="font-display font-semibold">Where money goes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0 pt-4">
            {expenseByCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No expenses in range.</p>
            ) : (
              expenseByCategory.slice(0, 6).map((c, i) => (
                <div key={c.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize">
                      <span
                        className="size-2.5 rounded-[3px]"
                        style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                      />
                      {c.name}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatMoney(c.value, currency)} · {Math.round((c.value / expenseTotal) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full animate-grow"
                      style={{
                        width: `${(c.value / maxCategory) * 100}%`,
                        background: BAR_COLORS[i % BAR_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={cardClass}>
        <CardHeader className="px-0">
          <CardTitle className="font-display font-semibold">Cumulative savings</CardTitle>
          <CardAction>
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              <MoneyAmount value={net} currency={currency} signed /> in range
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 pt-4">
          {cumulative.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Not enough data yet.</p>
          ) : (
            <NetWorthChart data={cumulative} currency={currency} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
