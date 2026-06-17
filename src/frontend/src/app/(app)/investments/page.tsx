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
import { SnapshotPanel } from "@/components/snapshot-panel";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { MoneyAmount } from "@/components/money-amount";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { BenchmarkChart } from "@/components/charts/benchmark-chart";
import { GeoExposureCard } from "@/components/geo-exposure-card";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import { useInvestmentHistory, useBenchmark } from "@/hooks/use-investments";
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
import { formatMoney, formatPercent, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Holding = DashboardData["netWorth"]["holdings"][number];

const card = "border shadow-card ring-0";
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
  const [period, setPeriod] = useState<string>("1Y");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [openPosition, setOpenPosition] = useState<Holding | null>(null);

  const nw = data?.netWorth;
  const currency = nw?.baseCurrency ?? "EUR";
  const holdings = useMemo(() => nw?.holdings ?? [], [nw]);
  const invested = nw?.investments ?? 0;
  const totalCost = holdings.reduce((s, h) => s + h.cost, 0);
  const totalGain = holdings.reduce((s, h) => s + h.gain, 0);
  const returnPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

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

  const allocation = nw?.allocation ?? {};
  const investmentAllocation = Object.fromEntries(
    Object.entries(allocation).filter(([k]) => k !== "CASH"),
  );

  const filteredHoldings =
    classFilter === "ALL" ? holdings : holdings.filter((h) => h.type === classFilter);
  const classes = ["ALL", ...new Set(holdings.map((h) => h.type))];
  const maxAbsReturn = Math.max(1, ...holdings.map((h) => Math.abs(h.gainPct)));

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Portfolio hero */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu lg:col-span-8")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Portfolio value</p>
            <div className="mt-1.5 flex items-baseline gap-3.5">
              <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
                {isLoading ? "…" : formatMoney(invested, currency)}
              </span>
              {totalCost > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                    returnPct >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
                  )}
                >
                  {formatPercent(returnPct)} total
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Invested {formatMoney(totalCost, currency)} · Return{" "}
              <span className={totalGain >= 0 ? "text-positive" : "text-negative"}>
                {totalGain >= 0 ? "+" : ""}
                {formatMoney(totalGain, currency)}
              </span>
            </p>
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
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu lg:col-span-4")}>
        <p className="font-display text-base font-semibold">Allocation by class</p>
        <div className="mt-4">
          <AllocationChart allocation={investmentAllocation} currency={currency} />
        </div>
      </Card>

      {/* Row 2 — three charts */}
      {/* Return per position */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu lg:col-span-4")}>
        <p className="font-display text-base font-semibold">Return by position</p>
        <div className="mt-4 flex flex-col gap-3.5">
          {holdings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No positions yet.</p>
          ) : (
            [...holdings]
              .sort((a, b) => b.gainPct - a.gainPct)
              .slice(0, 6)
              .map((h, i) => (
                <div key={h.holdingId}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate">{h.name}</span>
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums",
                        h.gainPct >= 0 ? "text-positive" : "text-negative",
                      )}
                    >
                      {formatPercent(h.gainPct)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full animate-grow"
                      style={{
                        width: `${(Math.abs(h.gainPct) / maxAbsReturn) * 100}%`,
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
      <BenchmarkCard className="col-span-12 lg:col-span-4" />

      {/* Geographic exposure (placeholder until data lands) */}
      <GeoExposureCard className="col-span-12 lg:col-span-4" />

      {/* Liquidity panel + snapshot history */}
      <LiquidityPanel currency={currency} />

      {/* Debts */}
      <DebtsCard currency={currency} />

      {/* Positions table */}
      <Card className={cn(card, "col-span-12 gap-0 p-6 animate-fu")}>
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
        <div className="grid grid-cols-[minmax(0,1.5fr)_110px_120px_120px_110px] items-center border-b px-2 py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <span>Asset</span>
          <span>Class</span>
          <span className="text-right">Qty · Price</span>
          <span className="text-right">Value</span>
          <span className="text-right">Return</span>
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
              onClick={() => setOpenPosition(h)}
            />
          ))
        )}
      </Card>

      {openPosition ? (
        <PositionTransactionsDialog
          tickerId={openPosition.tickerId}
          symbol={openPosition.symbol}
          name={openPosition.name}
          open={openPosition !== null}
          onOpenChange={(o) => {
            if (!o) setOpenPosition(null);
          }}
        />
      ) : null}
    </div>
  );
}

// Portfolio vs MSCI World (IWDA.AS). Real data when the benchmark ticker is
// tracked; a placeholder otherwise.
function BenchmarkCard({ className }: { className?: string }) {
  const { data, isLoading } = useBenchmark();
  const available = data && data.available ? data : null;
  const outperf = available
    ? available.portfolioReturnPct - available.benchmarkReturnPct
    : 0;

  return (
    <Card className={cn(card, "gap-0 p-6 animate-fu", className)}>
      <div className="mb-1 flex items-start justify-between gap-3">
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
  onClick,
}: {
  h: Holding;
  currency: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[minmax(0,1.5fr)_110px_120px_120px_110px] items-center border-b border-background px-2 py-3.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/60">
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-8 items-center justify-center rounded-lg font-display text-[11px] font-semibold text-white"
          style={{ background: CLASS_COLOR[h.type] ?? "var(--chart-3)" }}
        >
          {h.symbol.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{h.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{h.symbol}</span>
        </span>
      </span>
      <span className="text-muted-foreground">{CLASS_LABELS[h.type] ?? h.type}</span>
      <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
        {h.quantity} · {formatMoney(h.price, h.currency)}
      </span>
      <MoneyAmount value={h.value} currency={currency} className="text-right font-mono font-semibold" />
      <span
        className={cn(
          "text-right font-mono font-semibold tabular-nums",
          h.gainPct >= 0 ? "text-positive" : "text-negative",
        )}
      >
        {formatPercent(h.gainPct)}
      </span>
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
