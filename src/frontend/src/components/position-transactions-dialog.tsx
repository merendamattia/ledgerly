"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MoneyAmount } from "@/components/money-amount";
import { PrivateNumber } from "@/components/private-number";
import { usePrivacyMode } from "@/components/privacy-mode";
import {
  InvestmentMovementForm,
  type MovementValues,
} from "@/components/add-transaction-dialog";
import type { SelectedTicker } from "@/components/ticker-search";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import {
  useInvestmentTransactions,
  useUpdateInvestmentTx,
  useDeleteInvestmentTx,
  useSetManualPrice,
  type InvestmentTransaction,
} from "@/hooks/use-investments";

type Holding = DashboardData["netWorth"]["holdings"][number];
import {
  formatNumber,
  formatPercent,
  formatDate,
  INVESTMENT_SIDE_LABELS,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Renders the drill-down dialog for one investment position and its movements.
 *
 * The holding metrics are recomputed server-side after any movement change.
 */
export function PositionTransactionsDialog({
  holding,
  open,
  onOpenChange,
  onAddMovement,
}: {
  holding: Holding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMovement: () => void;
}) {
  const { data: dashboard } = useDashboard();
  const baseCurrency = dashboard?.netWorth.baseCurrency ?? "EUR";
  const txs = useInvestmentTransactions({ tickerId: holding.tickerId });
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = txs.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{holding.name}</DialogTitle>
          <DialogDescription>
            {holding.symbol} · {rows.length} {rows.length === 1 ? "movement" : "movements"}
          </DialogDescription>
        </DialogHeader>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          <Stat label="Quantity" value={<PrivateNumber text={formatNumber(holding.quantity, 4)} />} />
          <Stat
            label="Avg cost"
            value={<MoneyAmount value={holding.avgCost} currency={holding.currency} />}
          />
          <Stat
            label="Last price"
            value={<MoneyAmount value={holding.price} currency={holding.currency} />}
          />
          <Stat label="Invested" value={<MoneyAmount value={holding.cost} currency={baseCurrency} />} />
          <Stat
            label="Market value"
            value={<MoneyAmount value={holding.value} currency={baseCurrency} />}
          />
          <Stat
            label="P/L"
            value={
              <span className="flex items-baseline gap-2">
                <MoneyAmount value={holding.gain} currency={baseCurrency} colored signed />
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    holding.gainPct >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {formatPercent(holding.gainPct)}
                </span>
              </span>
            }
          />
        </div>

        {/* Manually-valued assets (bonds/commodities) have no provider feed, so
            the price is set by hand here. */}
        {holding.provider === "manual" ? (
          <ManualPriceEditor
            tickerId={holding.tickerId}
            currency={holding.currency}
            current={holding.price}
          />
        ) : null}

        {/* Add movement — opens the right-side drawer (closes this dialog first) */}
        <Button className="w-fit" onClick={onAddMovement}>
          <Plus data-icon="inline-start" />
          Add movement
        </Button>

        <div className="flex max-h-[50vh] flex-col overflow-auto">
          {txs.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <>
              <div className="sticky top-0 z-10 grid grid-cols-[64px_1fr_auto_auto] items-center gap-3 border-b bg-card py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span>Side</span>
                <span>Quantity · Price</span>
                <span className="text-right">Cash flow</span>
                <span className="w-[72px]" aria-hidden />
              </div>
              {rows.map((tx) => (
                <MovementRow
                  key={tx.id}
                  tx={tx}
                  editing={editingId === tx.id}
                  onEdit={() => setEditingId(tx.id)}
                  onCancel={() => setEditingId(null)}
                  onDone={() => setEditingId(null)}
                />
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Renders an inline current-price editor for a manually valued asset. */
function ManualPriceEditor({
  tickerId,
  currency,
  current,
}: {
  tickerId: string;
  currency: string;
  current: number;
}) {
  const setPrice = useSetManualPrice();
  const [value, setValue] = useState(String(current));
  const { shouldHidePrivateNumbers } = usePrivacyMode();

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-accent/30 px-3 py-2.5">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Current price ({currency})
        </span>
        <Input
          type={shouldHidePrivateNumbers ? "password" : "number"}
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-32 font-mono"
        />
      </div>
      <Button
        size="sm"
        disabled={setPrice.isPending || !value}
        onClick={() =>
          setPrice.mutate(
            { id: tickerId, price: Number(value) },
            {
              onSuccess: () => toast.success("Price updated"),
              onError: (e) => toast.error(e.message),
            },
          )
        }
      >
        Update price
      </Button>
    </div>
  );
}

/** Renders one compact metric cell in the position summary grid. */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card px-3.5 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Renders one investment movement row with inline edit and delete controls. */
function MovementRow({
  tx,
  editing,
  onEdit,
  onCancel,
  onDone,
}: {
  tx: InvestmentTransaction;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const update = useUpdateInvestmentTx();
  const del = useDeleteInvestmentTx();

  if (editing) {
    const lockedTicker: SelectedTicker = {
      tickerId: tx.tickerId,
      symbol: tx.ticker?.symbol ?? "",
      name: tx.ticker?.name ?? "",
      type: (tx.ticker?.type ?? "EQUITY") as SelectedTicker["type"],
      currency: tx.ticker?.currency,
    };
    return (
      <div className="border-b py-3 last:border-b-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Edit movement</p>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel edit">
            <X />
          </Button>
        </div>
        <InvestmentMovementForm
          lockedTicker={lockedTicker}
          submitLabel="Save changes"
          submitting={update.isPending}
          initial={{
            side: tx.side,
            date: String(tx.date).slice(0, 10),
            quantity: String(tx.quantity),
            price: String(tx.price),
            fee: tx.fee ? String(tx.fee) : "",
            note: tx.note ?? "",
            cashAccountId: tx.cashAccountId ?? "",
          }}
          onSubmit={(_tickerId, values: MovementValues) =>
            update.mutate(
              { id: tx.id, ...values },
              {
                onSuccess: () => {
                  toast.success("Movement updated");
                  onDone();
                },
                onError: (err) => toast.error(err.message),
              },
            )
          }
        />
      </div>
    );
  }

  const currency = tx.ticker?.currency ?? "USD";
  const isBuy = tx.side === "BUY";
  // Cash impact: a buy spends qty*price plus the fee; a sell brings in qty*price net of the fee.
  const total = tx.quantity * tx.price + (isBuy ? tx.fee : -tx.fee);

  return (
    <div className="grid grid-cols-[64px_1fr_auto_auto] items-center gap-3 border-b py-3 text-sm last:border-b-0">
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
          isBuy ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
        )}
      >
        {INVESTMENT_SIDE_LABELS[tx.side] ?? tx.side}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xs tabular-nums">
          <PrivateNumber text={formatNumber(tx.quantity, 4)} /> ·{" "}
          <MoneyAmount value={tx.price} currency={currency} />
          {tx.fee ? (
            <>
              {" "}
              · fee <MoneyAmount value={tx.fee} currency={currency} />
            </>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatDate(tx.date)} · {tx.cashAccount?.name ?? "No account"}
          {tx.note ? ` · ${tx.note}` : ""}
        </span>
      </span>
      <span
        className={cn(
          "text-right font-mono text-sm font-semibold tabular-nums",
          isBuy ? "text-negative" : "text-positive",
        )}
      >
        {isBuy ? "−" : "+"}
        <MoneyAmount value={Math.abs(total)} currency={currency} />
      </span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit movement">
          <Pencil />
        </Button>
        <ConfirmDialog
          title="Delete movement?"
          description="This removes the buy/sell and recomputes the position."
          confirmLabel="Delete"
          onConfirm={() =>
            del.mutate(tx.id, {
              onSuccess: () => toast.success("Movement deleted"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon" aria-label="Delete movement">
              <Trash2 />
            </Button>
          }
        />
      </span>
    </div>
  );
}
