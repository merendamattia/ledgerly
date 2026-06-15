"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { useCreateTransaction } from "@/hooks/use-expenses";
import { todayISO, DIRECTION_LABELS } from "@/lib/format";

// Which "add" variant to show:
// - "full"       Transactions: income, expense, plus a disabled "investment" option.
// - "cashflow"   Expenses & Cash Flow: income / expense only.
// - "investment" Assets & Investments: investment movement only — not active yet.
export type AddMode = "full" | "cashflow" | "investment";

// Shared "new transaction" dialog. The `mode` scopes which directions are
// offered; pass a custom `trigger` or fall back to a default button.
export function AddTransactionDialog({
  trigger,
  mode = "full",
}: {
  trigger?: ReactElement;
  mode?: AddMode;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const categories = useCategories(direction);
  const create = useCreateTransaction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        direction,
        categoryId: categoryId || null,
        date,
        amount: Number(amount),
        note: note || null,
      },
      {
        onSuccess: () => {
          toast.success("Transaction saved");
          setOpen(false);
          setAmount("");
          setNote("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <Plus data-icon="inline-start" />
              Add transaction
            </Button>
          )
        }
      />
      <DialogContent>
        {mode === "investment" ? (
          <>
            <DialogHeader>
              <DialogTitle>New investment movement</DialogTitle>
              <DialogDescription>Record a buy or sell on your portfolio.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                Coming soon
              </span>
              <p className="max-w-xs text-sm text-muted-foreground">
                Investment movements aren&apos;t recorded yet. They&apos;ll land here once the
                Assets & Investments section goes live.
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New transaction</DialogTitle>
              <DialogDescription>Record an income or an expense.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="direction">Direction</FieldLabel>
                  <Select
                    value={direction}
                    items={{ ...DIRECTION_LABELS, INVESTMENT: "Investment · soon" }}
                    onValueChange={(v) => {
                      if ((v as string) === "INVESTMENT") return;
                      setDirection((v ?? "EXPENSE") as typeof direction);
                      setCategoryId("");
                    }}
                  >
                    <SelectTrigger id="direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                      <SelectItem value="INCOME">Income</SelectItem>
                      {mode === "full" ? (
                        <SelectItem value="INVESTMENT" disabled>
                          Investment · soon
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </Field>
            <Field>
              <FieldLabel htmlFor="category">Category</FieldLabel>
              <Select
                value={categoryId}
                items={categories.data?.map((c) => ({ value: c.id, label: c.name })) ?? []}
                onValueChange={(v) => setCategoryId(v ?? "")}
              >
                <SelectTrigger id="category">
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
              <FieldLabel htmlFor="date">Date</FieldLabel>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    Save
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
