"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountSnapshotWorkbench } from "@/components/account-snapshot-workbench";
import type { SelectedTicker } from "@/components/ticker-search";
import { MoneyAmount } from "@/components/money-amount";
import { PrivateNumber } from "@/components/private-number";
import { PeriodPerformance } from "@/components/period-performance";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { RebalanceCard } from "@/components/rebalance-card";
import { PillarsCard } from "@/components/pillars-card";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import { useInvestmentHistory } from "@/hooks/use-investments";
import { usePrivacyMode } from "@/components/privacy-mode";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const PositionTransactionsDialog = dynamic(
  () => import("@/components/position-transactions-dialog").then((mod) => mod.PositionTransactionsDialog),
  { ssr: false },
);
const AddMovementSheet = dynamic(
  () => import("@/components/add-transaction-dialog").then((mod) => mod.AddMovementSheet),
  { ssr: false },
);

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

/** Returns the earliest ISO day to include for a period, or `null` for Max. */
function periodCutoff(period: string): string | null {
  if (period === "Max") return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (period === "YTD") return `${d.getUTCFullYear()}-01-01`;
  const days = PERIOD_DAYS[period] ?? 365;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const CLASS_LABELS: Record<string, string> = { EQUITY: "Equity", ETF: "ETF", CRYPTO: "Crypto" };
const CLASS_COLOR: Record<string, string> = {
  EQUITY: "var(--chart-1)",
  ETF: "var(--chart-2)",
  CRYPTO: "var(--chart-4)",
};

/** Renders portfolio analysis and account snapshot tracking in one wealth workspace. */
export default function InvestmentsPage() {
  const searchParams = useSearchParams();
  const { data, isLoading } = useDashboard();
  const [period, setPeriod] = useState<string>("YTD");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  // Track the open position by id (not a snapshot) so the dialog re-renders with
  // fresh query data after a rename / price edit / new movement.
  const [openPositionId, setOpenPositionId] = useState<string | null>(null);
  const [addPosition, setAddPosition] = useState<Holding | null>(null);
  const { shouldHidePrivateNumbers, togglePrivacyMode } = usePrivacyMode();
  const PrivacyIcon = shouldHidePrivateNumbers ? EyeOff : Eye;

  const nw = data?.netWorth;
  const currency = nw?.baseCurrency ?? "EUR";
  const holdings = useMemo(() => nw?.holdings ?? [], [nw]);
  const openPosition = useMemo(
    () => holdings.find((h) => h.holdingId === openPositionId) ?? null,
    [holdings, openPositionId],
  );

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
    () => periodWindow.map((p) => ({ date: p.date, totalValue: p.value, invested: p.invested })),
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

  const filteredHoldings = useMemo(
    () =>
      (classFilter === "ALL" ? [...holdings] : holdings.filter((h) => h.type === classFilter)).sort(
        (a, b) => b.value - a.value,
      ),
    [classFilter, holdings],
  );
  const classes = ["ALL", ...new Set(holdings.map((h) => h.type))];
  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.value, 0), [holdings]);

  if (searchParams.get("view") === "accounts") {
    return (
      <div className="grid grid-cols-12 gap-4 md:gap-5">
        <AccountSnapshotWorkbench currency={currency} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-5">
      {/* Portfolio hero */}
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-8")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Portfolio value</p>
            <div className="mt-1.5 flex items-start gap-2.5">
              {isLoading ? (
                <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
                  …
                </span>
              ) : (
                <MoneyAmount
                  value={stats.value}
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
            {stats.invested > 0 ? (
              <PeriodPerformance
                pct={stats.pct}
                amount={stats.gain}
                currency={currency}
                period={period}
                className="mt-2"
              />
            ) : null}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Invested <MoneyAmount value={stats.invested} currency={currency} />
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
            <NetWorthChart data={series} currency={currency} valueLabel="Portfolio value" />
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

      {/* Row 2 — rebalancing + the 4 pillars */}
      <RebalanceCard holdings={holdings} currency={currency} className="col-span-12 lg:col-span-6" />
      <PillarsCard holdings={holdings} currency={currency} className="col-span-12 lg:col-span-6" />

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
                  onClick={() => setOpenPositionId(h.holdingId)}
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
            if (!o) setOpenPositionId(null);
          }}
          onAddMovement={() => {
            setAddPosition(openPosition);
            setOpenPositionId(null);
          }}
        />
      ) : null}

      {addPosition ? (
        <AddMovementSheet
          ticker={{
            tickerId: addPosition.tickerId,
            symbol: addPosition.symbol,
            name: addPosition.name,
            type: addPosition.type as SelectedTicker["type"],
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

/** Renders one responsive holding row in the positions ledger. */
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
          <PrivateNumber text={formatNumber(h.quantity, 4)} />
        </span>
        <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
          <MoneyAmount value={h.avgCost} currency={h.currency} />
        </span>
        <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
          <MoneyAmount value={h.price} currency={h.currency} />
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
              h.gainPct >= 0 ? "text-positive" : "text-negative-ink",
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
                h.gainPct >= 0 ? "text-positive" : "text-negative-ink",
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
