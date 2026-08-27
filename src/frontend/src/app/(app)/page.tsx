"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MoneyAmount } from "@/components/money-amount";
import { PrivateNumber } from "@/components/private-number";
import { CategoryIcon } from "@/components/category-badge";
import { CategoryBreakdownCard } from "@/components/category-breakdown";
import { DayGroupedList } from "@/components/day-grouped-list";
import { PeriodPerformance } from "@/components/period-performance";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { NetWorthCompositionChart } from "@/components/charts/net-worth-composition-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { useDashboard, useNetWorthHistory, type DashboardData } from "@/hooks/use-dashboard";
import { useInvestmentTransactions } from "@/hooks/use-investments";
import { useAccounts, useCashSnapshots } from "@/hooks/use-accounts";
import { usePrivacyMode } from "@/components/privacy-mode";
import {
  formatMoney,
  formatNumber,
  formatPercent,
  INVESTMENT_SIDE_LABELS,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type RecentTx = DashboardData["recentTransactions"][number];
type KpiDelta = {
  label?: string;
  prefix?: string;
  amountText?: string;
  suffix?: string;
  tone: "positive" | "negative" | "muted";
};
type TrendPoint = { date: string; total: number };
type ChartMode = "total" | "composition";

const PERIODS = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1Y" },
  { value: "Max", label: "Max" },
] as const;
const CHART_MODES: { value: ChartMode; label: string; mobileLabel: string }[] = [
  { value: "total", label: "Total", mobileLabel: "Total" },
  { value: "composition", label: "Composition", mobileLabel: "Assets" },
];
const PERIOD_DAYS: Record<string, number> = { "1M": 30, "3M": 90, "1Y": 365 };

/** Resolves the oldest date included by the selected overview period. */
function periodCutoff(period: string): string | null {
  if (period === "Max") return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (period === "YTD") return `${d.getUTCFullYear()}-01-01`;
  const days = PERIOD_DAYS[period] ?? 365;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Returns the first day of the current UTC month as an ISO date string. */
function currentMonthStartISO(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Formats a monetary delta with an explicit plus or minus sign. */
function signedMoney(value: number, currency: string): string {
  if (value === 0) return formatMoney(0, currency);
  return `${value > 0 ? "+" : "−"}${formatMoney(Math.abs(value), currency)}`;
}

/** Builds the last ten trend points, appending the current value if missing. */
function trendValues(values: number[], current: number): number[] {
  const finite = values.filter((v) => Number.isFinite(v));
  const withCurrent = finite.at(-1) === current ? finite : [...finite, current];
  return withCurrent.slice(-10);
}

/** Extracts the last ten finite totals from snapshot trend points. */
function snapshotTrendValues(points: TrendPoint[]): number[] {
  return points
    .map((p) => p.total)
    .filter((v) => Number.isFinite(v))
    .slice(-10);
}

/** Renders the small inline sparkline used inside KPI tiles. */
function MiniSparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 120;
      const y = 30 - ((value - min) / span) * 24 + 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 120 36"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="hidden h-7 w-20 shrink-0 sm:block"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Renders a KPI delta line, hiding private amounts when privacy mode is active. */
function KpiDeltaLine({ delta }: { delta: KpiDelta }) {
  return (
    <span
      className={cn(
        "mt-1 block text-xs font-semibold",
        delta.tone === "positive" && "text-positive",
        delta.tone === "negative" && "text-negative-ink",
        delta.tone === "muted" && "text-muted-foreground",
      )}
    >
      {delta.label ?? (
        <>
          {delta.prefix}
          {delta.amountText ? <PrivateNumber text={delta.amountText} /> : null}
          {delta.suffix}
        </>
      )}
    </span>
  );
}

/** Renders the overview dashboard for net worth, cashflow, and recent activity. */
export default function OverviewPage() {
  const { data, isLoading } = useDashboard(12);
  const investmentTx = useInvestmentTransactions({ limit: 5 });
  const accounts = useAccounts();
  const cashSnapshots = useCashSnapshots();
  const [period, setPeriod] = useState<string>("YTD");
  const [chartMode, setChartMode] = useState<ChartMode>("total");
  const { shouldHidePrivateNumbers, togglePrivacyMode } = usePrivacyMode();
  const PrivacyIcon = shouldHidePrivateNumbers ? EyeOff : Eye;

  const nw = data?.netWorth;
  const currency = nw?.baseCurrency ?? "EUR";
  const total = nw?.total ?? 0;
  const allocation = nw?.allocation ?? {};
  const liquidity = allocation["CASH"] ?? 0;
  const investments = nw?.investments ?? 0;
  const debts = nw?.debts ?? 0;

  const cashFlow = data?.cashFlowMonth ?? { income: 0, expense: 0, investment: 0 };
  const monthlyLiquidNet = cashFlow.income - cashFlow.expense - cashFlow.investment;
  const monthlySavings = monthlyLiquidNet + cashFlow.investment;
  const savingsRate =
    cashFlow.income > 0 ? Math.round((monthlySavings / cashFlow.income) * 100) : 0;

  const nwHistory = useNetWorthHistory();
  const historyWindow = useMemo(() => {
    const pts = nwHistory.data ?? [];
    const cutoff = periodCutoff(period);
    if (!cutoff) return pts;
    const window = pts.filter((p) => p.date >= cutoff);
    return window.length >= 2 ? window : pts;
  }, [nwHistory.data, period]);
  const sliced = useMemo(
    () => historyWindow.map((p) => ({ date: p.date, totalValue: p.totalValue })),
    [historyWindow],
  );

  const nwDelta = useMemo(() => {
    if (sliced.length < 2) return null;
    const first = sliced[0].totalValue;
    const last = sliced[sliced.length - 1].totalValue;
    if (!first) return null;
    const pct = ((last - first) / first) * 100;
    return { abs: last - first, pct };
  }, [sliced]);

  const kpiDeltas = useMemo(() => {
    const previous = [...(nwHistory.data ?? [])]
      .reverse()
      .find((p) => p.date < currentMonthStartISO());
    const missing: KpiDelta = { label: "No previous month data", tone: "muted" };
    if (!previous) {
      return {
        investments: missing,
        debts: missing,
      };
    }

    const investmentsDelta = investments - previous.investments;
    const investmentsPct =
      previous.investments > 0 ? (investmentsDelta / previous.investments) * 100 : null;
    const debtsDelta = debts - previous.debts;

    return {
      investments: {
        prefix: investmentsPct == null ? "" : `${formatPercent(investmentsPct)} · `,
        amountText: signedMoney(investmentsDelta, currency),
        suffix: " this month",
        tone: investmentsDelta >= 0 ? "positive" : "negative",
      },
      debts: {
        amountText: signedMoney(debtsDelta, currency),
        suffix: " this month",
        tone: debtsDelta <= 0 ? "positive" : "negative",
      },
    } satisfies Record<"investments" | "debts", KpiDelta>;
  }, [nwHistory.data, investments, debts, currency]);

  const liquiditySnapshotHistory = useMemo<TrendPoint[]>(() => {
    const liquidityAccountIds = new Set(
      (accounts.data ?? [])
        .filter((a) => a.category === "LIQUIDITY" && a.type !== "BROKER")
        .map((a) => a.id),
    );
    const byDate = new Map<string, number>();
    for (const snapshot of cashSnapshots.data ?? []) {
      if (!liquidityAccountIds.has(snapshot.cashAccountId)) continue;
      byDate.set(String(snapshot.date), (byDate.get(String(snapshot.date)) ?? 0) + snapshot.balance);
    }
    return [...byDate.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [accounts.data, cashSnapshots.data]);

  const liquiditySnapshotDelta = useMemo<KpiDelta>(() => {
    const latest = liquiditySnapshotHistory.at(-1);
    const previous = [...liquiditySnapshotHistory]
      .reverse()
      .find((point) => point.date < currentMonthStartISO());
    if (!latest || !previous) {
      return { label: "No previous month data", tone: "muted" };
    }
    if (latest.date < currentMonthStartISO()) {
      return { label: "No current month snapshot", tone: "muted" };
    }
    const delta = latest.total - previous.total;
    return {
      amountText: signedMoney(delta, currency),
      suffix: " this month",
      tone: delta >= 0 ? "positive" : "negative",
    };
  }, [liquiditySnapshotHistory, currency]);

  const kpiSparklines = useMemo(() => {
    const points = nwHistory.data ?? [];
    return {
      investments: trendValues(
        points.map((p) => p.investments),
        investments,
      ),
      debts: trendValues(
        points.map((p) => p.debts),
        debts,
      ),
    };
  }, [nwHistory.data, investments, debts]);

  const series = data?.cashFlowSeries ?? [];
  const expenseByCategory = useMemo(() => {
    const b = data?.categoryBreakdownMonth ?? [];
    return b
      .filter((c) => c.expense > 0)
      .map((c) => ({ name: c.name, value: c.expense }))
      .sort((a, b) => b.value - a.value);
  }, [data?.categoryBreakdownMonth]);
  const expenseTotal = expenseByCategory.reduce((s, c) => s + c.value, 0);

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-5">
      {/* Net worth hero */}
      <Card className={cn("col-span-12 flex flex-col gap-0 p-5 animate-fu lg:col-span-8")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Net worth</p>
            <div className="mt-1.5 flex items-start gap-2.5">
              {isLoading ? (
                <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
                  …
                </span>
              ) : (
                <MoneyAmount
                  value={total}
                  currency={currency}
                  className="font-mono text-4xl font-semibold tracking-tight"
                />
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={togglePrivacyMode}
                      className="mt-1 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      aria-label={shouldHidePrivateNumbers ? "Show amounts" : "Hide amounts"}
                    >
                      <PrivacyIcon className="size-4.5" />
                    </button>
                  }
                />
                <TooltipContent>
                  {shouldHidePrivateNumbers ? "Show amounts" : "Hide amounts"}
                </TooltipContent>
              </Tooltip>
            </div>
            {nwDelta ? (
              <PeriodPerformance
                pct={nwDelta.pct}
                amount={nwDelta.abs}
                currency={currency}
                period={period}
                label="Change"
                className="mt-2"
              />
            ) : null}
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5 sm:flex">
              {CHART_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={chartMode === m.value}
                  onClick={() => setChartMode(m.value)}
                  className={cn(
                    "min-w-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    chartMode === m.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="sm:hidden">{m.mobileLabel}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-0.5 rounded-lg bg-muted p-0.5 sm:flex">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={period === p.value}
                  onClick={() => setPeriod(p.value)}
                  className={cn(
                    "min-w-0 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors sm:px-2",
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
        </div>
        {/* Chart is absolutely positioned so it adds no intrinsic height; the
            row height is driven by the Allocation card on the right, which
            grows as new assets are added. */}
        <div className="relative mt-4 min-h-[240px] flex-1 sm:min-h-[280px]">
          <div className="absolute inset-0">
            {chartMode === "composition" ? (
              <NetWorthCompositionChart
                data={historyWindow}
                currency={currency}
                className="aspect-auto h-full w-full"
                isLoading={nwHistory.isLoading}
              />
            ) : (
              <NetWorthChart
                data={sliced}
                currency={currency}
                className="aspect-auto h-full w-full"
                isLoading={nwHistory.isLoading}
              />
            )}
          </div>
        </div>
      </Card>

      {/* Allocation */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-4")}>
        <p className="font-display text-base font-semibold">Allocation</p>
        <div className="mt-2">
          <AllocationChart allocation={allocation} currency={currency} isLoading={isLoading} />
        </div>
      </Card>

      {/* KPI row — Investments · Liquidity · Debts · Cash flow + Savings */}
      <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">Investments</p>
          <MiniSparkline values={kpiSparklines.investments} color="var(--positive)" />
        </div>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
          <MoneyAmount value={investments} currency={currency} />
        </p>
        <KpiDeltaLine delta={kpiDeltas.investments} />
      </Card>
      <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">Liquidity</p>
          <MiniSparkline
            values={snapshotTrendValues(liquiditySnapshotHistory)}
            color="var(--chart-3)"
          />
        </div>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
          <MoneyAmount value={liquidity} currency={currency} />
        </p>
        <KpiDeltaLine delta={liquiditySnapshotDelta} />
      </Card>
      <Card className={cn("col-span-6 gap-0 p-5 animate-fu lg:col-span-3")}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">Debts</p>
          <MiniSparkline values={kpiSparklines.debts} color="var(--negative)" />
        </div>
        <p
          className={cn(
            "mt-2.5 font-mono text-2xl font-semibold tabular-nums",
            debts > 0 && "text-negative-ink",
          )}
        >
          {debts > 0 ? "−" : ""}
          <MoneyAmount value={debts} currency={currency} />
        </p>
        <KpiDeltaLine delta={kpiDeltas.debts} />
      </Card>
      {/* Monthly cash flow + savings rate: dark ink card (they're related) */}
      <Card
        className={cn(
          "col-span-6 gap-0 border-0 bg-sidebar p-5 text-sidebar-accent-foreground shadow-card ring-0 animate-fu lg:col-span-3",
        )}
      >
        <span className="text-xs font-medium text-sidebar-foreground">Monthly cash flow</span>
        <p className="mt-2.5 font-mono text-2xl font-semibold tabular-nums text-primary">
          {monthlySavings >= 0 ? "+" : ""}
          <MoneyAmount value={monthlySavings} currency={currency} />
        </p>
        <span className="mt-1 text-xs text-sidebar-foreground">Savings rate {savingsRate}%</span>
      </Card>

      {/* Income vs expenses — the row height is driven by the category card on
          the right; the chart is absolutely positioned so it adds no intrinsic
          height and simply fills whatever height that gives. */}
      <Card className={cn("col-span-12 flex flex-col gap-0 p-5 animate-fu lg:col-span-7")}>
        <p className="font-display text-base font-semibold">Income vs expenses</p>
        <div className="relative mt-4 min-h-[240px] flex-1 sm:min-h-[260px]">
          <div className="absolute inset-0">
            <CashFlowChart
              data={series}
              currency={currency}
              className="aspect-auto h-full w-full"
              isLoading={isLoading}
            />
          </div>
        </div>
      </Card>

      {/* Expenses by category */}
      <CategoryBreakdownCard
        className="col-span-12 p-5 animate-fu lg:col-span-5"
        title="Expenses by category"
        subtitle="This month"
        items={expenseByCategory}
        total={expenseTotal}
        totalLabel="Total expenses"
        currency={currency}
        emptyText="No expenses yet."
        action={
          expenseByCategory.length > 6 ? (
            <Link href="/cashflow" className="text-sm font-semibold text-positive">
              View all →
            </Link>
          ) : null
        }
      />

      {/* Recent expenses & income */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-6")}>
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold">Recent movements</p>
          <Link href="/transactions" className="text-sm font-semibold text-positive">
            View all →
          </Link>
        </div>
        <div className="mt-2">
          {isLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Loading…</p>
          ) : (data?.recentTransactions ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <DayGroupedList
              items={data?.recentTransactions.slice(0, 5) ?? []}
              getKey={(t) => t.id}
              getDate={(t) => t.date}
              renderItem={(t: RecentTx) => (
                <>
                  <CategoryIcon name={t.category?.name} emoji={t.category?.emoji} className="size-9 rounded-full text-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium capitalize">
                      {t.category?.name || "Transaction"}
                    </p>
                    {t.note ? (
                      <p className="truncate text-xs text-muted-foreground">{t.note}</p>
                    ) : null}
                  </div>
                  <MoneyAmount
                    value={t.direction === "EXPENSE" ? -t.amount : t.amount}
                    currency={currency}
                    colored
                    signed
                    className="shrink-0 font-mono font-semibold"
                  />
                </>
              )}
            />
          )}
        </div>
      </Card>

      {/* Recent investment movements */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-6")}>
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold">Recent investments</p>
          <Link href="/investments" className="text-sm font-semibold text-positive">
            View all →
          </Link>
        </div>
        <div className="mt-2">
          {investmentTx.isLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Loading…</p>
          ) : (investmentTx.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No investment movements yet.
            </p>
          ) : (
            <DayGroupedList
              items={investmentTx.data?.slice(0, 4) ?? []}
              getKey={(t) => t.id}
              getDate={(t) => t.date}
              renderItem={(t) => {
                const gross = t.quantity * t.price;
                const signed = t.side === "BUY" ? -(gross + t.fee) : gross - t.fee;
                const txCurrency = t.ticker?.currency ?? currency;
                return (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <TrendingUp className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {INVESTMENT_SIDE_LABELS[t.side]} {t.ticker?.symbol ?? ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.ticker?.name ? `${t.ticker.name} · ` : ""}
                        <span className="font-mono">
                          Qty <PrivateNumber text={formatNumber(t.quantity, 4)} /> @{" "}
                          <MoneyAmount value={t.price} currency={txCurrency} />
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 text-right font-mono font-semibold tabular-nums">
                      <span className={signed >= 0 ? "text-positive" : "text-negative-ink"}>
                        {signed >= 0 ? "+" : ""}
                        <MoneyAmount value={signed} currency={txCurrency} />
                      </span>
                    </span>
                  </>
                );
              }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
