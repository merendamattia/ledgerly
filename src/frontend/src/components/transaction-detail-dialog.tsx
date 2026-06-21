"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryBadge } from "@/components/category-badge";
import { MoneyAmount } from "@/components/money-amount";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCategories } from "@/hooks/use-categories";
import {
  useDeleteTransaction,
  useUpdateTransaction,
  type Transaction,
} from "@/hooks/use-expenses";
import { formatDate, DIRECTION_LABELS } from "@/lib/format";

// Controlled detail view for a single transaction. Shows the full record and,
// when "Edit" is chosen (or `defaultEditing` is set by a row's pencil action),
// switches to an inline edit form. Delete is confirmed in place.
export function TransactionDetailDialog({
  transaction,
  open,
  onOpenChange,
  currency,
  defaultEditing = false,
}: {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  defaultEditing?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {transaction ? (
          // Remount per transaction so the edit form re-seeds from props
          // without a state-syncing effect.
          <DetailContent
            key={transaction.id}
            tx={transaction}
            currency={currency}
            defaultEditing={defaultEditing}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailContent({
  tx,
  currency,
  defaultEditing,
  onClose,
}: {
  tx: Transaction;
  currency: string;
  defaultEditing: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(defaultEditing);
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">(tx.direction);
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? "");
  const [date, setDate] = useState(tx.date.slice(0, 10));
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note ?? "");
  const categories = useCategories(direction);
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();

  const signed = tx.direction === "EXPENSE" ? -tx.amount : tx.amount;

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      {
        id: tx.id,
        direction,
        categoryId: categoryId || null,
        date,
        amount: Number(amount),
        note: note || null,
      },
      {
        onSuccess: () => {
          toast.success("Transaction updated");
          setEditing(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit transaction" : "Transaction"}</DialogTitle>
        <DialogDescription>
          {editing ? "Update the details below." : "Review or change this record."}
        </DialogDescription>
      </DialogHeader>

      {editing ? (
        <form onSubmit={save}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="detail-direction">Direction</FieldLabel>
              <Select
                value={direction}
                items={DIRECTION_LABELS}
                onValueChange={(v) => {
                  setDirection((v ?? "EXPENSE") as typeof direction);
                  setCategoryId("");
                }}
              >
                <SelectTrigger id="detail-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-category">Category</FieldLabel>
              <Select
                value={categoryId}
                items={categories.data?.map((c) => ({ value: c.id, label: c.name })) ?? []}
                onValueChange={(v) => setCategoryId(v ?? "")}
              >
                <SelectTrigger id="detail-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-date">Date</FieldLabel>
              <Input
                id="detail-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-amount">Amount</FieldLabel>
              <Input
                id="detail-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-note">Note</FieldLabel>
              <Input id="detail-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                Save
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <MoneyAmount
              value={signed}
              currency={currency}
              colored
              signed
              className="text-2xl font-semibold"
            />
            <CategoryBadge name={tx.category?.name} emoji={tx.category?.emoji} />
          </div>
          <dl className="grid grid-cols-[5rem_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Direction</dt>
            <dd>{DIRECTION_LABELS[tx.direction]}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd>{formatDate(tx.date)}</dd>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{tx.category?.name ?? "—"}</dd>
            <dt className="text-muted-foreground">Note</dt>
            <dd className="break-words">{tx.note || "—"}</dd>
          </dl>
          <DialogFooter>
            <ConfirmDialog
              title="Delete transaction?"
              confirmLabel="Delete"
              onConfirm={() =>
                del.mutate(tx.id, {
                  onSuccess: () => {
                    toast.success("Deleted");
                    onClose();
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              trigger={
                <Button variant="outline">
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              }
            />
            <Button onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          </DialogFooter>
        </div>
      )}
    </>
  );
}
