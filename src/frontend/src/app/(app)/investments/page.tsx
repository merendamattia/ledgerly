"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PositionTransactionsDialog } from "@/components/position-transactions-dialog";
import { AddMovementSheet } from "@/components/add-transaction-dialog";
import { SnapshotPanel } from "@/components/snapshot-panel";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { MoneyAmount } from "@/components/money-amount";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { BenchmarkChart } from "@/components/charts/benchmark-chart";
import { GeoExposureCard } from "@/components/geo-exposure-card";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import { useInvestmentHistory, useBenchmark, useHoldingReturns } from "@/hooks/use-investments";
import {
  useAccounts,
  useDeleteAccount,
  useCashSnapshots,
  useCreateCashSnapshot,
} from "@/hooks/use-accounts";
import {
  useDebts,
  useCreateDebt,
  useDeleteDebt,
  useDebtSnapshots,
  useCreateDebtSnapshot,
} from "@/hooks/use-debts";
import { formatMoney, formatNumber, formatPercent, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Holding = DashboardData["netWorth"]["holdings"][number];

// Positions ledger column template — desktop only; below md rows stack.
const POS_COLS =
  "grid-cols-[minmax(0,1.4fr)_84px_90px_104px_104px_116px_116px_120px_92px]";
const PERIODS = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1Y" },
  { value: "Max", label: "Max" },
] as const;
const PERIOD_DAYS: Record<string, number> = { "1M": 30, "3M": 90, "1Y": 365 };

// Earliest ISO day (yyyy-mm-dd) to keep for a period; null = keep everything (Max).
function periodCutoff(period: string): string | null {
  if (period === "Max") return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (period === "YTD") return `${d.getUTCFullYear()}-01-01`;
  const days = PERIOD_DAYS[period] ?? 365;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Simple period-over-period returns (mirrors backend utils/stats.ts).
function seriesReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    out.push(prev !== 0 ? values[i] / prev - 1 : 0);
  }
  return out;
}

// Beta = cov(asset, bench) / var(bench), 0 if undefined.
function betaOf(asset: number[], bench: number[]): number {
  const n = Math.min(asset.length, bench.length);
  if (n < 2) return 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    sa += asset[i];
    sb += bench[i];
  }
  const ma = sa / n;
  const mb = sb / n;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (asset[i] - ma) * (bench[i] - mb);
    varB += (bench[i] - mb) ** 2;
  }
  return varB > 0 ? cov / varB : 0;
}

const CLASS_LABELS: Record<string, string> = { EQUITY: "Equity", ETF: "ETF", CRYPTO: "Crypto" };
const CLASS_COLOR: Record<string, string> = {
  EQUITY: "var(--chart-1)",
  ETF: "var(--chart-2)",
  CRYPTO: "var(--chart-4)",
};
const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export default function InvestmentsPage() {
  const { data, isLoading } = useDashboard();
  const [period, setPeriod] = useState<string>("YTD");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [openPosition, setOpenPosition] = useState<Holding | null>(null);
  const [addPosition, setAddPosition] = useState<Holding | null>(null);

  const nw = data?.netWorth;
  const currency = nw?.baseCurrency ?? "EUR";
  const holdings = useMemo(() => nw?.holdings ?? [], [nw]);

  // Portfolio area series: real daily portfolio value (from the first buy),
  // computed server-side from price history. The period pill slices a date window.
  const history = useInvestmentHistory();
  const periodWindow = useMemo(() => {
    const points = history.data ?? [];
    const cutoff = periodCutoff(period);
    if (!cutoff) return points;
    const sliced = points.filter((p) => p.date >= cutoff);
    return sliced.length >= 2 ? sliced : points; // fall back if window predates first point
  }, [history.data, period]);
  const series = useMemo(
    () => periodWindow.map((p) => ({ date: p.date, totalValue: p.value })),
    [periodWindow],
  );

  // Header stats scoped to the selected window. Value is the current portfolio
  // value; the return is contribution-neutral (value/invested ratio, the same
  // method the benchmark uses) so new buys inside the window don't inflate it.
  const stats = useMemo(() => {
    const s = periodWindow[0];
    const e = periodWindow.at(-1);
    const value = e?.value ?? nw?.investments ?? 0;
    const invested = e?.invested ?? holdings.reduce((sum, h) => sum + h.cost, 0);
    if (!s || !e || periodWindow.length < 2 || s.invested <= 0 || s.value <= 0) {
      // Not enough history in the window — fall back to lifetime totals.
      const cost = holdings.reduce((sum, h) => sum + h.cost, 0);
      const gain = holdings.reduce((sum, h) => sum + h.gain, 0);
      return { value, invested: cost, gain, pct: cost > 0 ? (gain / cost) * 100 : 0 };
    }
    const pct = ((e.value / e.invested) / (s.value / s.invested) - 1) * 100;
    const gain = e.value - s.value - (e.invested - s.invested);
    return { value, invested, gain, pct };
  }, [periodWindow, nw, holdings]);

  // Allocation by position: one slice per holding (every ETF, every crypto, …).
  const investmentAllocation = useMemo(
    () => Object.fromEntries(holdings.filter((h) => h.value > 0).map((h) => [h.holdingId, h.value])),
    [holdings],
  );
  const allocationLabels = useMemo(
    () => Object.fromEntries(holdings.map((h) => [h.holdingId, h.name])),
    [holdings],
  );

  // Per-position market returns for the selected window — synced with the
  // portfolio timeframe pills (omit `from` for Max → since-inception price).
  const positionReturns = useHoldingReturns(periodCutoff(period) ?? undefined);
  const returnRows = useMemo(
    () => [...(positionReturns.data ?? [])].sort((a, b) => b.returnPct - a.returnPct).slice(0, 6),
    [positionReturns.data],
  );
  const maxAbsReturn = useMemo(
    () => Math.max(1, ...returnRows.map((r) => Math.abs(r.returnPct))),
    [returnRows],
  );

  const filteredHoldings =
    classFilter === "ALL" ? holdings : holdings.filter((h) => h.type === classFilter);
  const classes = ["ALL", ...new Set(holdings.map((h) => h.type))];
  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.value, 0), [holdings]);

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-5">
      {/* Portfolio hero */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-8")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Portfolio value</p>
            <div className="mt-1.5 flex items-baseline gap-3.5">
              <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
                {isLoading ? "…" : formatMoney(stats.value, currency)}
              </span>
              {stats.invested > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                    stats.pct >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
                  )}
                >
                  {formatPercent(stats.pct)} {period === "Max" ? "total" : period}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Invested {formatMoney(stats.invested, currency)} · Return{" "}
              <span className={stats.gain >= 0 ? "text-positive" : "text-negative"}>
                {stats.gain >= 0 ? "+" : ""}
                {formatMoney(stats.gain, currency)}
              </span>
            </p>
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
        <div className="mt-4">
          {series.length >= 2 ? (
            <NetWorthChart data={series} currency={currency} />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Not enough history yet — snapshots build the portfolio curve over time.
            </div>
          )}
        </div>
      </Card>

      {/* Allocation by class — beside the chart */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-4")}>
        <p className="font-display text-base font-semibold">Allocation by position</p>
        <div className="mt-4">
          <AllocationChart
            allocation={investmentAllocation}
            labels={allocationLabels}
            currency={currency}
          />
        </div>
      </Card>

      {/* Row 2 — three charts */}
      {/* Return per position */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-4")}>
        <p className="font-display text-base font-semibold">Return by position</p>
        <div className="mt-4 flex flex-col gap-3.5">
          {returnRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No positions yet.</p>
          ) : (
            returnRows.map((r, i) => (
              <div key={r.holdingId}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="truncate">{r.name}</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      r.returnPct >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {formatPercent(r.returnPct)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full animate-grow"
                    style={{
                      width: `${(Math.abs(r.returnPct) / maxAbsReturn) * 100}%`,
                      background: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Portfolio vs benchmark */}
      <BenchmarkCard className="col-span-12 lg:col-span-4" period={period} />

      {/* Geographic exposure (placeholder until data lands) */}
      <GeoExposureCard className="col-span-12 lg:col-span-4" />

      {/* Liquidity panel + snapshot history */}
      <LiquidityPanel currency={currency} />

      {/* Debts */}
      <DebtsCard currency={currency} />

      {/* Positions table */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu")}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-base font-semibold">Positions</p>
          <div className="flex flex-wrap items-center gap-2">
            {classes.map((cls) => {
              const active = classFilter === cls;
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassFilter(cls)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {cls === "ALL" ? "All" : (CLASS_LABELS[cls] ?? cls)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="md:overflow-x-auto">
          <div className="md:min-w-[860px]">
            <div
              className={cn(
                "hidden items-center border-b px-2 py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:grid",
                POS_COLS,
              )}
            >
              <span>Asset</span>
              <span>Class</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Avg cost</span>
              <span className="text-right">Price</span>
              <span className="text-right">Invested</span>
              <span className="text-right">Value</span>
              <span className="text-right">P/L</span>
              <span className="text-right">Weight</span>
            </div>
            {isLoading ? (
              <div className="px-2 py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filteredHoldings.length === 0 ? (
              <div className="px-2 py-12 text-center text-sm text-muted-foreground">
                No positions — record a buy with the + Add button.
              </div>
            ) : (
              filteredHoldings.map((h) => (
                <PositionRow
                  key={h.holdingId}
                  h={h}
                  currency={currency}
                  weight={totalValue > 0 ? (h.value / totalValue) * 100 : 0}
                  onClick={() => setOpenPosition(h)}
                />
              ))
            )}
          </div>
        </div>
      </Card>

      {openPosition ? (
        <PositionTransactionsDialog
          holding={openPosition}
          open={openPosition !== null}
          onOpenChange={(o) => {
            if (!o) setOpenPosition(null);
          }}
          onAddMovement={() => {
            setAddPosition(openPosition);
            setOpenPosition(null);
          }}
        />
      ) : null}

      {addPosition ? (
        <AddMovementSheet
          ticker={{
            tickerId: addPosition.tickerId,
            symbol: addPosition.symbol,
            name: addPosition.name,
            type: addPosition.type as "EQUITY" | "ETF" | "CRYPTO",
            currency: addPosition.currency,
          }}
          open={addPosition !== null}
          onOpenChange={(o) => {
            if (!o) setAddPosition(null);
          }}
        />
      ) : null}
    </div>
  );
}

// Portfolio vs MSCI World (IWDA.AS). Real data when the benchmark ticker is
// tracked; a placeholder otherwise.
function BenchmarkCard({ className, period }: { className?: string; period: string }) {
  const { data, isLoading } = useBenchmark();
  const full = data && data.available ? data : null;

  // Slice the full (lifetime) series to the selected window and recompute the
  // stats client-side: rebase both lines to 100 at the window start, derive
  // returns and beta from the windowed indices.
  const available = useMemo(() => {
    if (!full) return null;
    const cutoff = periodCutoff(period);
    let slice = cutoff ? full.series.filter((p) => p.date >= cutoff) : full.series;
    if (slice.length < 2) slice = full.series; // fall back if window predates first point
    const p0 = slice[0].portfolio;
    const b0 = slice[0].benchmark;
    const series = slice.map((p) => ({
      date: p.date,
      portfolio: (p.portfolio / p0) * 100,
      benchmark: (p.benchmark / b0) * 100,
    }));
    const portfolioReturnPct = (slice.at(-1)!.portfolio / p0 - 1) * 100;
    const benchmarkReturnPct = (slice.at(-1)!.benchmark / b0 - 1) * 100;
    const beta = betaOf(
      seriesReturns(slice.map((p) => p.portfolio)),
      seriesReturns(slice.map((p) => p.benchmark)),
    );
    return { benchmarkName: full.benchmarkName, series, portfolioReturnPct, benchmarkReturnPct, beta };
  }, [full, period]);

  const outperf = available
    ? available.portfolioReturnPct - available.benchmarkReturnPct
    : 0;

  return (
    <Card className={cn("gap-0 p-5 animate-fu", className)}>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <p className="font-display text-base font-semibold">Portfolio vs benchmark</p>
        {available ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              outperf >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
            )}
          >
            {outperf >= 0 ? "+" : ""}
            {outperf.toFixed(1)} pp
          </span>
        ) : null}
      </div>


      {isLoading ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : available ? (
        <>
          <div className="mb-2 flex gap-3.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[var(--chart-1)]" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[var(--chart-3)]" />
              {available.benchmarkName}
            </span>
          </div>
          <BenchmarkChart data={available.series} />
          <div className="mt-3.5 grid grid-cols-3 border-t pt-3.5 text-xs">
            <div>
              <p className="text-muted-foreground">Your return</p>
              <p
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  available.portfolioReturnPct >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {formatPercent(available.portfolioReturnPct)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Benchmark</p>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {formatPercent(available.benchmarkReturnPct)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Beta</p>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {available.beta.toFixed(2)}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-[200px] flex-col items-center justify-center gap-1.5 text-center">
          <p className="text-sm font-medium text-muted-foreground">No benchmark yet</p>
          <p className="max-w-[240px] text-xs text-muted-foreground">
            Track the MSCI World ETF (IWDA.AS) to compare your portfolio against the market.
          </p>
        </div>
      )}
    </Card>
  );
}

function PositionRow({
  h,
  currency,
  weight,
  onClick,
}: {
  h: Holding;
  currency: string;
  weight: number;
  onClick: () => void;
}) {
  const tile = (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-semibold text-white"
      style={{ background: CLASS_COLOR[h.type] ?? "var(--chart-3)" }}
    >
      {h.symbol.slice(0, 2).toUpperCase()}
    </span>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full border-b border-background text-left transition-colors last:border-b-0 hover:bg-muted/60"
    >
      {/* Desktop: full ledger grid */}
      <div className={cn("hidden items-center px-2 py-3.5 text-sm md:grid", POS_COLS)}>
        <span className="flex min-w-0 items-center gap-3">
          {tile}
          <span className="min-w-0">
            <span className="block truncate font-medium">{h.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{h.symbol}</span>
          </span>
        </span>
        <span className="text-muted-foreground">{CLASS_LABELS[h.type] ?? h.type}</span>
        <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
          {formatNumber(h.quantity, 4)}
        </span>
        <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
          {formatMoney(h.avgCost, h.currency)}
        </span>
        <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
          {formatMoney(h.price, h.currency)}
        </span>
        <MoneyAmount
          value={h.cost}
          currency={currency}
          className="text-right font-mono text-muted-foreground"
        />
        <MoneyAmount value={h.value} currency={currency} className="text-right font-mono font-semibold" />
        <span className="text-right">
          <MoneyAmount
            value={h.gain}
            currency={currency}
            colored
            signed
            className="block font-mono text-[13px] font-semibold"
          />
          <span
            className={cn(
              "block font-mono text-[11px] tabular-nums",
              h.gainPct >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {formatPercent(h.gainPct)}
          </span>
        </span>
        <span className="pl-3">
          <span className="block text-right font-mono text-xs tabular-nums">{weight.toFixed(1)}%</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full animate-grow bg-foreground/70"
              style={{ width: `${Math.min(100, weight)}%` }}
            />
          </span>
        </span>
      </div>

      {/* Mobile: stacked — name + value on top, class/symbol + P/L beneath */}
      <div className="flex items-center gap-3 px-1 py-3 md:hidden">
        {tile}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{h.name}</span>
            <MoneyAmount
              value={h.value}
              currency={currency}
              className="font-mono text-sm font-semibold"
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {CLASS_LABELS[h.type] ?? h.type} · {h.symbol} · {weight.toFixed(1)}%
            </span>
            <span
              className={cn(
                "shrink-0 font-mono tabular-nums",
                h.gainPct >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {formatPercent(h.gainPct)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

const addActionClass =
  "flex w-fit items-center gap-1.5 text-sm font-semibold text-[#5b7d10] hover:underline";

// Liquidity: editable cash balances + dated snapshot + history chart.
// Broker accounts are excluded — they hold investments, not liquidity.
function LiquidityPanel({ currency }: { currency: string }) {
  const accounts = useAccounts();
  const snapshots = useCashSnapshots();
  const createSnapshot = useCreateCashSnapshot();
  const del = useDeleteAccount();

  const cashAccounts = (accounts.data ?? []).filter((a) => a.type !== "BROKER");
  const accountsById = new Map(cashAccounts.map((a) => [a.id, a]));
  const rows = cashAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    value: a.balance,
  }));

  // Aggregate snapshots into a per-date liquidity total for the history card.
  const history = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of snapshots.data ?? []) {
      byDate.set(String(s.date), (byDate.get(String(s.date)) ?? 0) + s.balance);
    }
    return [...byDate.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots.data]);

  return (
    <SnapshotPanel
      title="Liquidity · Cash accounts"
      subtitle="Update balances and save a dated snapshot"
      totalLabel="Total liquidity"
      rows={rows}
      isLoading={accounts.isLoading}
      emptyText="No cash accounts yet — add one to start tracking liquidity."
      addAction={
        <AddAccountDialog
          trigger={
            <button type="button" className={addActionClass}>
              <Plus className="size-4" />
              Add account
            </button>
          }
        />
      }
      rowAction={(r) => {
        const account = accountsById.get(r.id);
        return (
          <>
            {account ? (
              <AddAccountDialog
                account={account}
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Edit account">
                    <Pencil />
                  </Button>
                }
              />
            ) : null}
            <ConfirmDialog
              title="Delete account?"
              description={`This removes "${r.name}" and its snapshots.`}
              confirmLabel="Delete"
              onConfirm={() =>
                del.mutate(r.id, {
                  onSuccess: () => toast.success("Account deleted"),
                  onError: (e) => toast.error(e.message),
                })
              }
              trigger={
                <Button variant="ghost" size="icon" aria-label="Delete account">
                  <Trash2 />
                </Button>
              }
            />
          </>
        );
      }}
      submitting={createSnapshot.isPending}
      onCreate={(date, entries) =>
        createSnapshot.mutate(
          { date, entries: entries.map((e) => ({ accountId: e.id, balance: e.value })) },
          {
            onSuccess: () => toast.success(`Snapshot saved for ${shortDate(date)}`),
            onError: (e) => toast.error(e.message),
          },
        )
      }
      history={history}
      historyTitle="Snapshot history"
      historySubtitle="Liquidity over time"
      currency={currency}
    />
  );
}

// Debts: editable amounts + dated snapshot + history chart (mirrors Liquidity).
function DebtsCard({ currency }: { currency: string }) {
  const debts = useDebts();
  const snapshots = useDebtSnapshots();
  const createSnapshot = useCreateDebtSnapshot();
  const del = useDeleteDebt();

  const rows = (debts.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    note: d.note,
    currency: d.currency,
    value: d.amount,
  }));

  const history = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of snapshots.data ?? []) {
      byDate.set(String(s.date), (byDate.get(String(s.date)) ?? 0) + s.amount);
    }
    return [...byDate.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots.data]);

  return (
    <SnapshotPanel
      title="Debts"
      subtitle="Update amounts and save a dated snapshot"
      totalLabel="Total debt"
      rows={rows}
      isLoading={debts.isLoading}
      emptyText="No debts. Use + Add debt to record a loan or credit balance."
      negative
      addAction={<AddDebtDialog />}
      rowAction={(r) => (
        <ConfirmDialog
          title="Delete debt?"
          description={`This removes "${r.name}".`}
          confirmLabel="Delete"
          onConfirm={() =>
            del.mutate(r.id, {
              onSuccess: () => toast.success("Debt deleted"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon">
              <Trash2 />
            </Button>
          }
        />
      )}
      submitting={createSnapshot.isPending}
      onCreate={(date, entries) =>
        createSnapshot.mutate(
          { date, entries: entries.map((e) => ({ debtId: e.id, amount: e.value })) },
          {
            onSuccess: () => toast.success(`Snapshot saved for ${shortDate(date)}`),
            onError: (e) => toast.error(e.message),
          },
        )
      }
      history={history}
      historyTitle="Debt history"
      historySubtitle="Liabilities over time"
      currency={currency}
    />
  );
}

function AddDebtDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("LOAN");
  const [currency, setCurrency] = useState("EUR");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const create = useCreateDebt();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, type, currency, amount: Number(amount), note: note || null },
      {
        onSuccess: () => {
          toast.success("Debt added");
          setOpen(false);
          setName("");
          setAmount("");
          setNote("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className={addActionClass} />}>
        <Plus className="size-4" />
        Add debt
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New debt</DialogTitle>
          <DialogDescription>Record a loan, mortgage or credit balance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="debt-name">Name</FieldLabel>
              <Input id="debt-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="debt-type">Type</FieldLabel>
              <Input id="debt-type" value={type} onChange={(e) => setType(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="debt-currency">Currency</FieldLabel>
              <Input
                id="debt-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="debt-amount">Amount</FieldLabel>
              <Input
                id="debt-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="debt-note">Note</FieldLabel>
              <Input id="debt-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Add debt
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
