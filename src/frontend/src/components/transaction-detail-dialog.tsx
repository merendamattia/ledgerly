"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CircleAlert, Pencil, Repeat, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { TagInput, TagChips } from "@/components/tag-input";
import { MoneyAmount } from "@/components/money-amount";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCategories } from "@/hooks/use-categories";
import { useLocaleLabels } from "@/hooks/use-locale-labels";
import {
  useDeleteTransaction,
  useMarkTransactionReviewed,
  useUpdateTransaction,
  type Transaction,
} from "@/hooks/use-expenses";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";

/**
 * Renders a controlled detail dialog for viewing, editing, or deleting a transaction.
 */
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

/** Renders the transaction detail body and inline edit form. */
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
  const [reviewed, setReviewed] = useState(!tx.reviewRequired);
  const categories = useCategories(direction);
  const { directions } = useLocaleLabels();
  const t = useTranslations("transactionDetail");
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();
  const review = useMarkTransactionReviewed();

  const signed = tx.direction === "EXPENSE" ? -tx.amount : tx.amount;

  /** Saves the edited transaction fields and returns to read-only detail view. */
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
          toast.success(t("updated"));
          setReviewed(true);
          setEditing(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function markReviewed() {
    review.mutate(tx.id, {
      onSuccess: () => {
        setReviewed(true);
        toast.success(t("reviewed"));
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? t("editTitle") : t("title")}</DialogTitle>
        <DialogDescription>
          {editing ? t("editDescription") : t("description")}
        </DialogDescription>
      </DialogHeader>

      {tx.reviewRequired && !reviewed ? (
        <Alert className="border-accent-gold/60 bg-accent-gold/10">
          <Sparkles />
          <AlertTitle>{t("aiReviewTitle")}</AlertTitle>
          <AlertDescription>{t("aiReviewDescription")}</AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-start-2 mt-1 w-fit"
            onClick={markReviewed}
            disabled={review.isPending}
          >
            {review.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t("markReviewed")}
          </Button>
        </Alert>
      ) : null}

      {!tx.category ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{t("categoryMissing")}</AlertTitle>
          <AlertDescription>
            {editing
              ? t("categoryMissingEditing")
              : t("categoryMissingViewing")}
          </AlertDescription>
        </Alert>
      ) : null}

      {editing ? (
        <form onSubmit={save}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="detail-direction">{t("direction")}</FieldLabel>
              <Select
                value={direction}
                items={directions}
                onValueChange={(v) => {
                  setDirection((v ?? "EXPENSE") as typeof direction);
                  setCategoryId("");
                }}
              >
                <SelectTrigger id="detail-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">{directions.EXPENSE}</SelectItem>
                  <SelectItem value="INCOME">{directions.INCOME}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-category">{t("category")}</FieldLabel>
              <Select
                value={categoryId}
                items={categories.data?.map((c) => ({ value: c.id, label: c.name })) ?? []}
                onValueChange={(v) => setCategoryId(v ?? "")}
              >
                <SelectTrigger id="detail-category">
                  <SelectValue placeholder={t("selectCategory")} />
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
              <FieldLabel htmlFor="detail-date">{t("date")}</FieldLabel>
              <Input
                id="detail-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="detail-amount">{t("amount")}</FieldLabel>
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
              <FieldLabel htmlFor="detail-note">{t("note")}</FieldLabel>
              <Input id="detail-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t("tags")}</FieldLabel>
              <TagInput note={note} onNoteChange={setNote} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {t("save")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MoneyAmount
                value={signed}
                currency={currency}
                colored
                signed
                className="text-2xl font-semibold"
              />
              {tx.recurringExpenseId ? (
                <span
                  title={t("recurring")}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
                >
                  <Repeat className="size-3" />
                  {t("recurring")}
                </span>
              ) : null}
            </div>
            <CategoryBadge name={tx.category?.name} emoji={tx.category?.emoji} />
          </div>
          <TagChips note={tx.note} />
          <dl className="grid grid-cols-[5rem_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">{t("direction")}</dt>
            <dd>{directions[tx.direction]}</dd>
            <dt className="text-muted-foreground">{t("date")}</dt>
            <dd>{formatDate(tx.date)}</dd>
            <dt className="text-muted-foreground">{t("category")}</dt>
            <dd>{tx.category?.name ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("note")}</dt>
            <dd className="break-words">{tx.note || "—"}</dd>
          </dl>
          <DialogFooter>
            <ConfirmDialog
              title={t("deleteTitle")}
              confirmLabel={t("delete")}
              onConfirm={() =>
                del.mutate(tx.id, {
                  onSuccess: () => {
                    toast.success(t("deleted"));
                    onClose();
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              trigger={
                <Button variant="outline">
                  <Trash2 data-icon="inline-start" />
                  {t("delete")}
                </Button>
              }
            />
            <Button onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              {t("edit")}
            </Button>
          </DialogFooter>
        </div>
      )}
    </>
  );
}
