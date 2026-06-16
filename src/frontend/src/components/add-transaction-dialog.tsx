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
import { TickerSearch, type SelectedTicker } from "@/components/ticker-search";
import { useCategories } from "@/hooks/use-categories";
import { useCreateTransaction } from "@/hooks/use-expenses";
import { useCreateInvestmentTx } from "@/hooks/use-investments";
import { useAccounts, useCreateAccount } from "@/hooks/use-accounts";
import { todayISO, DIRECTION_LABELS, INVESTMENT_SIDE_LABELS } from "@/lib/format";

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
          <InvestmentCreate onDone={() => setOpen(false)} />
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

// Create wrapper: header + the shared movement form wired to the create mutation.
function InvestmentCreate({ onDone }: { onDone: () => void }) {
  const create = useCreateInvestmentTx();
  return (
    <>
      <DialogHeader>
        <DialogTitle>New investment movement</DialogTitle>
        <DialogDescription>Record a buy or sell on your portfolio.</DialogDescription>
      </DialogHeader>
      <InvestmentMovementForm
        submitting={create.isPending}
        onSubmit={(tickerId, values) =>
          create.mutate(
            { tickerId, ...values },
            {
              onSuccess: () => {
                toast.success("Movement recorded");
                onDone();
              },
              onError: (err) => toast.error(err.message),
            },
          )
        }
      />
    </>
  );
}

export interface MovementValues {
  cashAccountId: string;
  side: "BUY" | "SELL";
  date: string;
  quantity: number;
  price: number;
  fee?: number;
  note: string | null;
}

// Shared buy/sell form. Used to create a movement (asset picked via search) and
// to edit one (asset locked to the position). The backend derives the holding's
// quantity + average cost from the full ledger; every movement needs an account.
export function InvestmentMovementForm({
  lockedTicker,
  initial,
  onSubmit,
  submitting,
  submitLabel = "Save",
}: {
  lockedTicker?: SelectedTicker;
  initial?: {
    side?: "BUY" | "SELL";
    date?: string;
    quantity?: string;
    price?: string;
    fee?: string;
    note?: string;
    cashAccountId?: string;
  };
  onSubmit: (tickerId: string, values: MovementValues) => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  const accounts = useAccounts();
  const createAccount = useCreateAccount();
  const [ticker, setTicker] = useState<SelectedTicker | null>(lockedTicker ?? null);
  const [side, setSide] = useState<"BUY" | "SELL">(initial?.side ?? "BUY");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [quantity, setQuantity] = useState(initial?.quantity ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [fee, setFee] = useState(initial?.fee ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [cashAccountId, setCashAccountId] = useState(initial?.cashAccountId ?? "");
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  const accountRows = accounts.data ?? [];
  const accountItems = Object.fromEntries(accountRows.map((a) => [a.id, a.name]));

  async function addAccount() {
    const name = newAccountName.trim();
    if (!name) return;
    try {
      const acc = await createAccount.mutateAsync({
        name,
        type: "BROKER",
        currency: "EUR",
        balance: 0,
      });
      setCashAccountId(acc.id);
      setNewAccountName("");
      setShowNewAccount(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker) {
      toast.error("Pick an asset first");
      return;
    }
    if (!cashAccountId) {
      toast.error("Pick an account");
      return;
    }
    onSubmit(ticker.tickerId, {
      cashAccountId,
      side,
      date,
      quantity: Number(quantity),
      price: Number(price),
      fee: fee ? Number(fee) : undefined,
      note: note || null,
    });
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel>Asset</FieldLabel>
          {lockedTicker ? (
            <div className="flex items-center gap-3 rounded-lg border bg-accent/40 px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary font-display text-xs font-semibold text-primary-foreground">
                {lockedTicker.symbol.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{lockedTicker.name}</p>
                <p className="truncate text-xs text-muted-foreground">{lockedTicker.symbol}</p>
              </div>
            </div>
          ) : (
            <TickerSearch
              selected={ticker}
              onSelect={(t) => {
                setTicker(t);
                if (t.price != null && !price) setPrice(String(t.price));
              }}
              onClear={() => setTicker(null)}
            />
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="account">Account</FieldLabel>
          <Select
            value={cashAccountId}
            items={accountItems}
            onValueChange={(v) => setCashAccountId(v ?? "")}
          >
            <SelectTrigger id="account">
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              {accountRows.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showNewAccount ? (
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="New account name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addAccount();
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => void addAccount()}
                disabled={createAccount.isPending || !newAccountName.trim()}
              >
                Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowNewAccount(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewAccount(true)}
              className="mt-1.5 w-fit text-xs font-medium text-primary hover:underline"
            >
              + New account
            </button>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="side">Side</FieldLabel>
          <Select
            value={side}
            items={INVESTMENT_SIDE_LABELS}
            onValueChange={(v) => setSide((v ?? "BUY") as typeof side)}
          >
            <SelectTrigger id="side">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUY">Buy</SelectItem>
              <SelectItem value="SELL">Sell</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
          <Input
            id="quantity"
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="price">
            Price{ticker?.currency ? ` (${ticker.currency})` : ""}
          </FieldLabel>
          <Input
            id="price"
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
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
          <FieldLabel htmlFor="fee">Fee (optional)</FieldLabel>
          <Input
            id="fee"
            type="number"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="inv-note">Note</FieldLabel>
          <Input id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !ticker}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
