"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SnapshotPanel } from "@/components/snapshot-panel";
import type { SelectedTicker } from "@/components/ticker-search";
import { AddAccountDialog, type SnapshotNoteHistoryItem } from "@/components/add-account-dialog";
import { MoneyAmount } from "@/components/money-amount";
import { PrivateNumber } from "@/components/private-number";
import { PeriodPerformance } from "@/components/period-performance";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { RebalanceCard } from "@/components/rebalance-card";
import { PillarsCard } from "@/components/pillars-card";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import { useInvestmentHistory } from "@/hooks/use-investments";
import {
  useAccounts,
  useDeleteAccount,
  useCashSnapshots,
  useCreateCashSnapshot,
} from "@/hooks/use-accounts";
import {
  useDebts,
  useCreateDebt,
  useUpdateDebt,
  useDeleteDebt,
  useDebtSnapshots,
  useCreateDebtSnapshot,
  type Debt,
} from "@/hooks/use-debts";
import { usePrivacyMode } from "@/components/privacy-mode";
import { formatNumber, formatPercent, shortDate } from "@/lib/format";
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

/** Normalizes API Date/ISO values to the yyyy-mm-dd key used by date inputs. */
function snapshotDateKey(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

const CLASS_LABELS: Record<string, string> = { EQUITY: "Equity", ETF: "ETF", CRYPTO: "Crypto" };
const CLASS_COLOR: Record<string, string> = {
  EQUITY: "var(--chart-1)",
  ETF: "var(--chart-2)",
  CRYPTO: "var(--chart-4)",
};
type CashCategory = "LIQUIDITY" | "CREDIT" | "OTHER_ASSET";
type SnapshotSection = CashCategory | "DEBT";
const SNAPSHOT_SECTIONS: { value: SnapshotSection; label: string }[] = [
  { value: "LIQUIDITY", label: "Liquidity" },
  { value: "CREDIT", label: "Credits" },
  { value: "OTHER_ASSET", label: "Other assets" },
  { value: "DEBT", label: "Debts" },
];

/** Renders the investments page with portfolio, cash, debt, and benchmark views. */
export default function InvestmentsPage() {
  const { data, isLoading } = useDashboard();
  const [period, setPeriod] = useState<string>("YTD");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [snapshotSection, setSnapshotSection] = useState<SnapshotSection>("LIQUIDITY");
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

      <ActiveSnapshotPanel
        section={snapshotSection}
        currency={currency}
        headerAction={
          <SnapshotSectionMenu value={snapshotSection} onChange={setSnapshotSection} />
        }
      />

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
  "flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline";

/** Renders the compact menu that chooses which snapshot panel is visible. */
function SnapshotSectionMenu({
  value,
  onChange,
}: {
  value: SnapshotSection;
  onChange: (value: SnapshotSection) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Snapshot section"
      className="grid w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:flex sm:w-fit"
    >
      {SNAPSHOT_SECTIONS.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors sm:py-1.5 sm:text-xs",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Mounts only the selected snapshot panel, instead of a vertical stack. */
function ActiveSnapshotPanel({
  section,
  currency,
  headerAction,
}: {
  section: SnapshotSection;
  currency: string;
  headerAction: ReactNode;
}) {
  if (section === "DEBT") {
    return <DebtsCard currency={currency} headerAction={headerAction} />;
  }
  return <CashCategoryPanel category={section} currency={currency} headerAction={headerAction} />;
}

// Per-category copy for the three cash-account sections. They share one panel;
// only labels and the category filter differ.
const CASH_PANEL_COPY: Record<
  CashCategory,
  {
    title: string;
    subtitle: string;
    totalLabel: string;
    emptyText: string;
    historyTitle: string;
    historySubtitle: string;
    dialogTitle: string;
    dialogDescription: string;
  }
> = {
  LIQUIDITY: {
    title: "Liquidity · Cash accounts",
    subtitle: "Update balances and save a dated snapshot",
    totalLabel: "Total liquidity",
    emptyText: "No cash accounts yet — add one to start tracking liquidity.",
    historyTitle: "Snapshot history",
    historySubtitle: "Liquidity over time",
    dialogTitle: "New cash account",
    dialogDescription: "Add a cash or bank account.",
  },
  CREDIT: {
    title: "Credits · Receivables",
    subtitle: "Update amounts owed to you and save a dated snapshot",
    totalLabel: "Total credits",
    emptyText: "No credits yet — add one to track money owed to you.",
    historyTitle: "Snapshot history",
    historySubtitle: "Credits over time",
    dialogTitle: "New credit",
    dialogDescription: "Add a receivable (money owed to you).",
  },
  OTHER_ASSET: {
    title: "Other assets",
    subtitle: "Update values and save a dated snapshot",
    totalLabel: "Total other assets",
    emptyText: "No other assets yet — add anything outside the rest.",
    historyTitle: "Snapshot history",
    historySubtitle: "Other assets over time",
    dialogTitle: "New asset",
    dialogDescription: "Add any other asset tracked by value.",
  },
};

/**
 * Renders editable balances, dated snapshot capture, and history for one cash category.
 */
function CashCategoryPanel({
  category,
  currency,
  headerAction,
}: {
  category: CashCategory;
  currency: string;
  headerAction?: ReactNode;
}) {
  const accounts = useAccounts();
  const snapshots = useCashSnapshots();
  const createSnapshot = useCreateCashSnapshot();
  const del = useDeleteAccount();
  const copy = CASH_PANEL_COPY[category];

  const categoryAccounts = useMemo(
    () => (accounts.data ?? []).filter((a) => a.category === category && a.type !== "BROKER"),
    [accounts.data, category],
  );
  const accountIds = useMemo(() => new Set(categoryAccounts.map((a) => a.id)), [categoryAccounts]);
  const accountsById = useMemo(
    () => new Map(categoryAccounts.map((a) => [a.id, a])),
    [categoryAccounts],
  );

  // Aggregate this category's snapshots into a per-date total for the history card.
  const history = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of snapshots.data ?? []) {
      if (!accountIds.has(s.cashAccountId)) continue;
      const dateKey = snapshotDateKey(s.date);
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + s.balance);
    }
    return [...byDate.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots.data, accountIds]);

  const noteHistoryByAccount = useMemo(() => {
    const byAccount = new Map<string, SnapshotNoteHistoryItem[]>();
    for (const s of snapshots.data ?? []) {
      if (!accountIds.has(s.cashAccountId)) continue;
      const note = s.note?.trim();
      if (!note) continue;
      const items = byAccount.get(s.cashAccountId) ?? [];
      items.push({ date: snapshotDateKey(s.date), note });
      byAccount.set(s.cashAccountId, items);
    }
    for (const items of byAccount.values()) {
      items.sort((a, b) => b.date.localeCompare(a.date));
    }
    return byAccount;
  }, [snapshots.data, accountIds]);

  const latestNotesByAccount = useMemo(() => {
    const latest = new Map<string, string>();
    for (const [accountId, items] of noteHistoryByAccount) {
      const [item] = items;
      if (item) latest.set(accountId, item.note);
    }
    return latest;
  }, [noteHistoryByAccount]);

  const rows = useMemo(
    () =>
      categoryAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        note: a.note ?? latestNotesByAccount.get(a.id) ?? null,
        currency: a.currency,
        value: a.balance,
      })),
    [categoryAccounts, latestNotesByAccount],
  );

  return (
    <SnapshotPanel
      title={copy.title}
      subtitle={copy.subtitle}
      totalLabel={copy.totalLabel}
      rows={rows}
      isLoading={accounts.isLoading}
      emptyText={copy.emptyText}
      addAction={
        <AddAccountDialog
          category={category}
          labels={{ title: copy.dialogTitle, description: copy.dialogDescription }}
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
                noteHistory={noteHistoryByAccount.get(account.id) ?? []}
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
          {
            date,
            entries: entries.map((e) => ({ accountId: e.id, balance: e.value, note: e.note })),
          },
          {
            onSuccess: () => toast.success(`Snapshot saved for ${shortDate(date)}`),
            onError: (e) => toast.error(e.message),
          },
        )
      }
      history={history}
      historyTitle={copy.historyTitle}
      historySubtitle={copy.historySubtitle}
      currency={currency}
      headerAction={headerAction}
    />
  );
}

/** Renders editable debt amounts, dated snapshot capture, and debt history. */
function DebtsCard({ currency, headerAction }: { currency: string; headerAction?: ReactNode }) {
  const debts = useDebts();
  const snapshots = useDebtSnapshots();
  const createSnapshot = useCreateDebtSnapshot();
  const del = useDeleteDebt();

  const debtsById = useMemo(() => new Map((debts.data ?? []).map((d) => [d.id, d])), [debts.data]);

  const history = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of snapshots.data ?? []) {
      const dateKey = snapshotDateKey(s.date);
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + s.amount);
    }
    return [...byDate.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots.data]);

  const noteHistoryByDebt = useMemo(() => {
    const byDebt = new Map<string, SnapshotNoteHistoryItem[]>();
    for (const s of snapshots.data ?? []) {
      const note = s.note?.trim();
      if (!note) continue;
      const items = byDebt.get(s.debtId) ?? [];
      items.push({ date: snapshotDateKey(s.date), note });
      byDebt.set(s.debtId, items);
    }
    for (const items of byDebt.values()) {
      items.sort((a, b) => b.date.localeCompare(a.date));
    }
    return byDebt;
  }, [snapshots.data]);

  const latestNotesByDebt = useMemo(() => {
    const latest = new Map<string, string>();
    for (const [debtId, items] of noteHistoryByDebt) {
      const [item] = items;
      if (item) latest.set(debtId, item.note);
    }
    return latest;
  }, [noteHistoryByDebt]);

  const rows = useMemo(
    () =>
      (debts.data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        note: d.note ?? latestNotesByDebt.get(d.id) ?? null,
        currency: d.currency,
        value: d.amount,
      })),
    [debts.data, latestNotesByDebt],
  );

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
      rowAction={(r) => {
        const debt = debtsById.get(r.id);
        return (
          <>
            {debt ? (
              <AddDebtDialog
                debt={debt}
                noteHistory={noteHistoryByDebt.get(debt.id) ?? []}
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Edit debt">
                    <Pencil />
                  </Button>
                }
              />
            ) : null}
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
                <Button variant="ghost" size="icon" aria-label="Delete debt">
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
          {
            date,
            entries: entries.map((e) => ({ debtId: e.id, amount: e.value, note: e.note })),
          },
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
      headerAction={headerAction}
    />
  );
}

/** Renders the dialog used to create or edit a tracked debt. */
function AddDebtDialog({
  debt,
  trigger,
  noteHistory = [],
}: {
  debt?: Debt;
  trigger?: ReactElement;
  noteHistory?: SnapshotNoteHistoryItem[];
}) {
  const editing = debt != null;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(debt?.name ?? "");
  const [currency, setCurrency] = useState(debt?.currency ?? "EUR");
  const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const create = useCreateDebt();
  const update = useUpdateDebt();
  const pending = create.isPending || update.isPending;

  /** Resets dialog fields from the current debt/default values when opened. */
  function resetFields() {
    setName(debt?.name ?? "");
    setCurrency(debt?.currency ?? "EUR");
    setAmount(debt ? String(debt.amount) : "");
    setNote(debt?.note ?? "");
  }

  /** Opens/closes the dialog and refreshes stale draft values before editing. */
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) resetFields();
    setOpen(nextOpen);
  }

  /** Creates or updates the debt from the dialog form fields. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, currency, amount: Number(amount), note: note || null };
    const opts = {
      onSuccess: () => {
        toast.success(editing ? "Debt updated" : "Debt added");
        setOpen(false);
        if (!editing) {
          setName("");
          setAmount("");
          setNote("");
        }
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (editing) update.mutate({ id: debt.id, ...payload }, opts);
    else create.mutate(payload, opts);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <button type="button" className={addActionClass}>
              <Plus className="size-4" />
              Add debt
            </button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit debt" : "New debt"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update this liability." : "Record a loan, mortgage or credit balance."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="debt-name">Name</FieldLabel>
              <Input id="debt-name" value={name} onChange={(e) => setName(e.target.value)} required />
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
              <Textarea
                id="debt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                rows={3}
              />
            </Field>
            {editing ? (
              <Field>
                <FieldLabel>Note history</FieldLabel>
                {noteHistory.length > 0 ? (
                  <div className="flex max-h-44 flex-col overflow-auto rounded-lg border">
                    {noteHistory.map((item) => (
                      <div
                        key={`${item.date}:${item.note}`}
                        className="flex flex-col gap-1 border-b px-3 py-2.5 last:border-b-0"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortDate(item.date)}
                        </span>
                        <span className="break-words text-sm">{item.note}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <FieldDescription>No saved snapshot notes yet.</FieldDescription>
                )}
              </Field>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {editing ? "Save changes" : "Add debt"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
