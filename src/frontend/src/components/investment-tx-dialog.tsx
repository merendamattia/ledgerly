"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
  useUpdateInvestmentTx,
  useDeleteInvestmentTx,
  type InvestmentTransaction,
} from "@/hooks/use-investments";
import { useLocaleLabels } from "@/hooks/use-locale-labels";

/** Renders the view/edit/delete dialog for a single investment movement. */
export function InvestmentTxDialog({
  tx,
  open,
  onOpenChange,
}: {
  tx: InvestmentTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateInvestmentTx();
  const del = useDeleteInvestmentTx();
  const { investmentSides } = useLocaleLabels();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {tx ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {investmentSides[tx.side]} {tx.ticker?.symbol ?? ""}
              </DialogTitle>
              <DialogDescription>Edit or delete this movement.</DialogDescription>
            </DialogHeader>
            <InvestmentMovementForm
              lockedTicker={tickerOf(tx)}
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
                      onOpenChange(false);
                    },
                    onError: (err) => toast.error(err.message),
                  },
                )
              }
            />
            <ConfirmDialog
              title="Delete movement?"
              description="This removes the buy/sell and recomputes the position."
              confirmLabel="Delete"
              onConfirm={() =>
                del.mutate(tx.id, {
                  onSuccess: () => {
                    toast.success("Movement deleted");
                    onOpenChange(false);
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              trigger={
                <Button variant="ghost" className="text-negative-ink">
                  <Trash2 data-icon="inline-start" />
                  Delete movement
                </Button>
              }
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Converts an investment transaction's ticker relation into the picker shape. */
function tickerOf(tx: InvestmentTransaction): SelectedTicker {
  return {
    tickerId: tx.tickerId,
    symbol: tx.ticker?.symbol ?? "",
    name: tx.ticker?.name ?? "",
    type: (tx.ticker?.type ?? "EQUITY") as SelectedTicker["type"],
    currency: tx.ticker?.currency,
  };
}
