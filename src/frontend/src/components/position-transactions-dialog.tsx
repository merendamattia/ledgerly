"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  InvestmentMovementForm,
  type MovementValues,
} from "@/components/add-transaction-dialog";
import type { SelectedTicker } from "@/components/ticker-search";
import {
  useInvestmentTransactions,
  useUpdateInvestmentTx,
  useDeleteInvestmentTx,
  type InvestmentTransaction,
} from "@/hooks/use-investments";
import { formatMoney, formatDate, INVESTMENT_SIDE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

// Drill-down for a single position: lists its buy/sell movements with inline
// edit + delete. The holding (qty + avg cost) is recomputed by the backend.
export function PositionTransactionsDialog({
  tickerId,
  symbol,
  name,
  open,
  onOpenChange,
}: {
  tickerId: string;
  symbol: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const txs = useInvestmentTransactions({ tickerId });
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = txs.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            {symbol} · {rows.length} {rows.length === 1 ? "movement" : "movements"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col overflow-auto">
          {txs.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            rows.map((tx) => (
              <MovementRow
                key={tx.id}
                tx={tx}
                editing={editingId === tx.id}
                onEdit={() => setEditingId(tx.id)}
                onCancel={() => setEditingId(null)}
                onDone={() => setEditingId(null)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  return (
    <div className="grid grid-cols-[80px_56px_1fr_auto] items-center gap-3 border-b py-3 text-sm last:border-b-0">
      <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
      <span
        className={cn(
          "text-xs font-semibold",
          tx.side === "BUY" ? "text-positive" : "text-negative",
        )}
      >
        {INVESTMENT_SIDE_LABELS[tx.side] ?? tx.side}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xs tabular-nums">
          {tx.quantity} · {formatMoney(tx.price, tx.ticker?.currency ?? "USD")}
          {tx.fee ? ` · fee ${formatMoney(tx.fee, tx.ticker?.currency ?? "USD")}` : ""}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {tx.cashAccount?.name ?? "No account"}
          {tx.note ? ` · ${tx.note}` : ""}
        </span>
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
