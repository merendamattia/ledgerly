"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MoneyAmount } from "@/components/money-amount";
import { CategoryIcon, CategoryBadge } from "@/components/category-badge";
import { CronSection } from "@/components/cron-section";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { useDashboard, useNetWorthHistory, type DashboardData } from "@/hooks/use-dashboard";
import { formatMoney, formatPercent, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type RecentTx = DashboardData["recentTransactions"][number];

const PERIODS = [
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
  { value: "365", label: "1Y" },
  { value: "9999", label: "Max" },
] as const;

const SAVINGS_GOAL = 30;
const card = "border shadow-card ring-0";
const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export default function OverviewPage() {
  const { data, isLoading } = useDashboard();
  const [period, setPeriod] = useState<string>("365");

  const nw = data?.netWorth;
  const currency = nw?.baseCurrency ?? "EUR";
  const total = nw?.total ?? 0;
  const allocation = nw?.allocation ?? {};
  const liquidity = allocation["CASH"] ?? 0;
  const investments = total - liquidity;

  const cashFlow = data?.cashFlowMonth ?? { income: 0, expense: 0 };
  const netFlow = cashFlow.income - cashFlow.expense;
  const savingsRate = cashFlow.income > 0 ? Math.round((netFlow / cashFlow.income) * 100) : 0;

  const nwHistory = useNetWorthHistory();
  const sliced = useMemo(() => {
    const pts = (nwHistory.data ?? []).map((p) => ({ date: p.date, totalValue: p.totalValue }));
    return pts.slice(Math.max(0, pts.length - Number(period)));
  }, [nwHistory.data, period]);

  const nwDelta = useMemo(() => {
    if (sliced.length < 2) return null;
    const first = sliced[0].totalValue;
    const last = sliced[sliced.length - 1].totalValue;
    if (!first) return null;
    const pct = ((last - first) / first) * 100;
    return { abs: last - first, pct };
  }, [sliced]);

  const series = data?.cashFlowSeries ?? [];
  const expenseByCategory = useMemo(() => {
    const b = data?.categoryBreakdown ?? [];
    return b
      .filter((c) => c.expense > 0)
      .map((c) => ({ name: c.name, value: c.expense }))
      .sort((a, b) => b.value - a.value);
  }, [data?.categoryBreakdown]);
  const expenseTotal = expenseByCategory.reduce((s, c) => s + c.value, 0);
  const maxCategory = expenseByCategory[0]?.value || 1;

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Net worth hero */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu lg:col-span-8")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Net worth</p>
            <div className="mt-1.5 flex items-baseline gap-3.5">
              <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
                {isLoading ? "…" : formatMoney(total, currency)}
              </span>
              {nwDelta ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    nwDelta.pct >= 0
                      ? "bg-positive/10 text-positive"
                      : "bg-negative/10 text-negative",
                  )}
                >
                  <ArrowUpRight className="size-3.5" />
                  {formatPercent(nwDelta.pct)}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">over the selected period</p>
          </div>
          <div className="flex gap-1 rounded-[10px] bg-muted p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  period === p.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <NetWorthChart data={sliced} currency={currency} />
        </div>
      </Card>

      {/* Allocation */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu lg:col-span-4")}>
        <p className="font-display text-base font-semibold">Allocation</p>
        <div className="mt-2">
          <AllocationChart allocation={allocation} currency={currency} />
        </div>
      </Card>

      {/* KPI row */}
      <Card className={cn(card, "col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <p className="text-xs font-medium text-muted-foreground">Liquidity</p>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
          {formatMoney(liquidity, currency)}
        </p>
      </Card>
      <Card className={cn(card, "col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <p className="text-xs font-medium text-muted-foreground">Investments</p>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
          {formatMoney(investments, currency)}
        </p>
      </Card>
      <Card className={cn(card, "col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <p className="text-xs font-medium text-muted-foreground">Monthly cash flow</p>
        <p
          className={cn(
            "mt-2.5 font-mono text-2xl font-semibold tabular-nums",
            netFlow >= 0 ? "text-positive" : "text-negative",
          )}
        >
          {netFlow >= 0 ? "+" : ""}
          {formatMoney(netFlow, currency)}
        </p>
      </Card>
      {/* Savings rate: dark ink card */}
      <Card
        className={cn(
          "col-span-6 gap-0 border-0 bg-sidebar p-5 text-sidebar-accent-foreground shadow-card ring-0 animate-fu lg:col-span-3",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-sidebar-foreground">Savings rate</span>
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            Goal {SAVINGS_GOAL}%
          </span>
        </div>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums text-primary">
          {savingsRate}%
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#2c2d22]">
          <div
            className="h-full rounded-full bg-primary animate-grow"
            style={{ width: `${Math.min(100, (savingsRate / SAVINGS_GOAL) * 100)}%` }}
          />
        </div>
      </Card>

      {/* Income vs expenses */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu lg:col-span-7")}>
        <p className="font-display text-base font-semibold">Income vs expenses</p>
        <div className="mt-4">
          <CashFlowChart data={series} currency={currency} />
        </div>
      </Card>

      {/* Expenses by category */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu lg:col-span-5")}>
        <p className="font-display text-base font-semibold">Expenses by category</p>
        <div className="mt-4 flex flex-col gap-4">
          {expenseByCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No expenses yet.</p>
          ) : (
            expenseByCategory.slice(0, 5).map((c, i) => (
              <div key={c.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatMoney(c.value, currency)}
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
        </div>
        {expenseTotal > 0 ? (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-sm font-medium text-muted-foreground">Total expenses</span>
            <span className="font-mono text-base font-semibold">
              {formatMoney(expenseTotal, currency)}
            </span>
          </div>
        ) : null}
      </Card>

      {/* Recent movements */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu")}>
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold">Recent movements</p>
          <Link href="/transactions" className="text-sm font-semibold text-positive">
            View all →
          </Link>
        </div>
        <ul className="mt-2 divide-y">
          {isLoading ? (
            <li className="py-4 text-sm text-muted-foreground">Loading…</li>
          ) : (data?.recentTransactions ?? []).length === 0 ? (
            <li className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</li>
          ) : (
            data?.recentTransactions.slice(0, 5).map((t: RecentTx) => {
              const signed = t.direction === "EXPENSE" ? -t.amount : t.amount;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3.5">
                  <span className="w-14 font-mono text-xs text-muted-foreground">
                    {shortDate(t.date)}
                  </span>
                  <CategoryIcon name={t.category?.name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t.note || t.category?.name || "Transaction"}
                  </span>
                  <CategoryBadge name={t.category?.name} />
                  <MoneyAmount
                    value={signed}
                    currency={currency}
                    colored
                    signed
                    className="w-28 text-right font-mono text-sm font-semibold"
                  />
                </li>
              );
            })
          )}
        </ul>
      </Card>

      <div className="col-span-12">
        <CronSection />
      </div>
    </div>
  );
}
