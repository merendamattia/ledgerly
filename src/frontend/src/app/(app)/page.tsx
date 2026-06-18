"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MoneyAmount } from "@/components/money-amount";
import { CategoryIcon } from "@/components/category-badge";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { useDashboard, useNetWorthHistory, type DashboardData } from "@/hooks/use-dashboard";
import { useInvestmentTransactions } from "@/hooks/use-investments";
import { formatMoney, formatPercent, numericDate, INVESTMENT_SIDE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

type RecentTx = DashboardData["recentTransactions"][number];

const PERIODS = [
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
  { value: "365", label: "1Y" },
  { value: "9999", label: "Max" },
] as const;

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
  const investmentTx = useInvestmentTransactions({ limit: 5 });
  const [period, setPeriod] = useState<string>("365");

  const nw = data?.netWorth;
  const currency = nw?.baseCurrency ?? "EUR";
  const total = nw?.total ?? 0;
  const allocation = nw?.allocation ?? {};
  const liquidity = allocation["CASH"] ?? 0;
  const credits = nw?.credits ?? 0;
  const otherAssets = nw?.otherAssets ?? 0;
  const investments = nw?.investments ?? 0;
  const debts = nw?.debts ?? 0;

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
    const b = data?.categoryBreakdownMonth ?? [];
    return b
      .filter((c) => c.expense > 0)
      .map((c) => ({ name: c.name, value: c.expense }))
      .sort((a, b) => b.value - a.value);
  }, [data?.categoryBreakdownMonth]);
  const expenseTotal = expenseByCategory.reduce((s, c) => s + c.value, 0);
  const maxCategory = expenseByCategory[0]?.value || 1;

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-5">
      {/* Net worth hero */}
      <Card className={cn("col-span-12 flex flex-col gap-0 p-5 animate-fu lg:col-span-8")}>
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
          <div className="flex gap-0.5 self-start rounded-lg bg-muted p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
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
        {/* Chart is absolutely positioned so it adds no intrinsic height; the
            row height is driven by the Allocation card on the right, which
            grows as new assets are added. */}
        <div className="relative mt-4 min-h-[280px] flex-1">
          <div className="absolute inset-0">
            <NetWorthChart data={sliced} currency={currency} className="aspect-auto h-full w-full" />
          </div>
        </div>
      </Card>

      {/* Allocation */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-4")}>
        <p className="font-display text-base font-semibold">Allocation</p>
        <div className="mt-2">
          <AllocationChart allocation={allocation} currency={currency} />
        </div>
      </Card>

      {/* KPI row — Investments · Liquidity · Debts · Cash flow + Savings */}
      <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <p className="text-xs font-medium text-muted-foreground">Investments</p>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
          {formatMoney(investments, currency)}
        </p>
      </Card>
      <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <p className="text-xs font-medium text-muted-foreground">Liquidity</p>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
          {formatMoney(liquidity, currency)}
        </p>
      </Card>
      {credits > 0 ? (
        <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
          <p className="text-xs font-medium text-muted-foreground">Credits</p>
          <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
            {formatMoney(credits, currency)}
          </p>
        </Card>
      ) : null}
      {otherAssets > 0 ? (
        <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
          <p className="text-xs font-medium text-muted-foreground">Other assets</p>
          <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
            {formatMoney(otherAssets, currency)}
          </p>
        </Card>
      ) : null}
      <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <p className="text-xs font-medium text-muted-foreground">Debts</p>
        <p
          className={cn(
            "mt-2.5 font-mono text-2xl font-semibold tabular-nums",
            debts > 0 && "text-negative",
          )}
        >
          {debts > 0 ? "−" : ""}
          {formatMoney(debts, currency)}
        </p>
      </Card>
      {/* Monthly cash flow + savings rate: dark ink card (they're related) */}
      <Card
        className={cn(
          "col-span-6 gap-0 border-0 bg-sidebar p-5 text-sidebar-accent-foreground shadow-card ring-0 animate-fu lg:col-span-3",
        )}
      >
        <span className="text-xs font-medium text-sidebar-foreground">Monthly cash flow</span>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums text-primary">
          {netFlow >= 0 ? "+" : ""}
          {formatMoney(netFlow, currency)}
        </p>
        <span className="mt-1 text-xs text-sidebar-foreground">Savings rate {savingsRate}%</span>
      </Card>

      {/* Income vs expenses — the row height is driven by the category card on
          the right; the chart is absolutely positioned so it adds no intrinsic
          height and simply fills whatever height that gives. */}
      <Card className={cn("col-span-12 flex flex-col gap-0 p-5 animate-fu lg:col-span-7")}>
        <p className="font-display text-base font-semibold">Income vs expenses</p>
        <div className="relative mt-4 min-h-[260px] flex-1">
          <div className="absolute inset-0">
            <CashFlowChart
              data={series}
              currency={currency}
              className="aspect-auto h-full w-full"
            />
          </div>
        </div>
      </Card>

      {/* Expenses by category */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-5")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-base font-semibold">Expenses by category</p>
            <p className="mt-0.5 text-xs text-muted-foreground">This month</p>
          </div>
          {expenseByCategory.length > 6 ? (
            <Link href="/cashflow" className="text-sm font-semibold text-positive">
              View all →
            </Link>
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {expenseByCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No expenses yet.</p>
          ) : (
            expenseByCategory.slice(0, 6).map((c, i) => (
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

      {/* Recent expenses & income */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-6")}>
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold">Recent expenses</p>
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
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <CategoryIcon name={t.category?.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.note || t.category?.name || "Transaction"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{numericDate(t.date)}</p>
                  </div>
                  <MoneyAmount
                    value={signed}
                    currency={currency}
                    colored
                    signed
                    className="shrink-0 font-mono text-sm font-semibold"
                  />
                </li>
              );
            })
          )}
        </ul>
      </Card>

      {/* Recent investment movements */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-6")}>
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold">Recent investments</p>
          <Link href="/investments" className="text-sm font-semibold text-positive">
            View all →
          </Link>
        </div>
        <ul className="mt-2 divide-y">
          {investmentTx.isLoading ? (
            <li className="py-4 text-sm text-muted-foreground">Loading…</li>
          ) : (investmentTx.data ?? []).length === 0 ? (
            <li className="py-8 text-center text-sm text-muted-foreground">
              No investment movements yet.
            </li>
          ) : (
            investmentTx.data?.slice(0, 5).map((t) => {
              const gross = t.quantity * t.price;
              const signed = t.side === "BUY" ? -(gross + t.fee) : gross - t.fee;
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <TrendingUp className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {INVESTMENT_SIDE_LABELS[t.side]} {t.ticker?.symbol ?? ""}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{numericDate(t.date)}</p>
                  </div>
                  <MoneyAmount
                    value={signed}
                    currency={t.ticker?.currency ?? currency}
                    colored
                    signed
                    className="shrink-0 font-mono text-sm font-semibold"
                  />
                </li>
              );
            })
          )}
        </ul>
      </Card>
    </div>
  );
}
