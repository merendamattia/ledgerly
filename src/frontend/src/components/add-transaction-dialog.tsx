"use client";

import { useState, type ComponentType, type ReactElement } from "react";
import { toast } from "sonner";
import { Plus, Check, Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Field, FieldLabel } from "@/components/ui/field";
import { CategoryIcon } from "@/components/category-badge";
import { TickerSearch, type SelectedTicker } from "@/components/ticker-search";
import { useCategories, type Category } from "@/hooks/use-categories";
import { useCreateTransaction } from "@/hooks/use-expenses";
import { useCreateInvestmentTx } from "@/hooks/use-investments";
import { useAccounts, useCreateAccount, type Account } from "@/hooks/use-accounts";
import { todayISO, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Kind = "INCOME" | "EXPENSE" | "INVESTMENT";

// Shared shell: a scrollable field area + a pinned footer with one full-width
// submit, matching the design drawer. Used by every form in the Add drawer.
// (No Cancel — closing the drawer already discards the in-progress entry.)
function FormShell({
  children,
  onSubmit,
  submitLabel,
  submitting,
  canSubmit = true,
}: {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  submitting: boolean;
  canSubmit?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">{children}</div>
      <div className="sticky bottom-0 border-t bg-card/95 px-6 py-4 backdrop-blur-sm">
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// A segmented control (Buy/Sell, Expense/Income/Investment) styled like the
// design's pill switch — bigger and clearer than a two-option dropdown.
function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon ? <o.icon className="size-4" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const KIND_OPTIONS: { value: Kind; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "EXPENSE", label: "Expense", icon: ArrowUpRight },
  { value: "INCOME", label: "Income", icon: ArrowDownLeft },
  { value: "INVESTMENT", label: "Investment", icon: TrendingUp },
];

// Beige tappable category chips with the design's tinted icon. Selecting toggles;
// the list is already scoped to the chosen kind, so the other set never shows.
function CategoryPicker({
  categories,
  isLoading,
  value,
  onChange,
}: {
  categories: Category[];
  isLoading: boolean;
  value: string;
  onChange: (id: string) => void;
}) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading categories…</p>;
  if (categories.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No categories yet — add some in Settings.</p>
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      {categories.map((c) => {
        const selected = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(selected ? "" : c.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors",
              selected
                ? "border-foreground/30 bg-card shadow-sm"
                : "border-transparent bg-secondary/60 hover:bg-secondary",
            )}
          >
            <CategoryIcon name={c.name} emoji={c.emoji} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize">{c.name}</span>
            {selected ? <Check className="size-4 shrink-0 text-foreground" /> : null}
          </button>
        );
      })}
    </div>
  );
}

// Beige tappable account cards + an inline "New account" card. Adding one
// renders it as a new card (and selects it), no separate dialog.
function AccountPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const accounts = useAccounts();
  const createAccount = useCreateAccount();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");

  // Investment movements settle against a broker account only — never a liquid
  // wallet, a credit or another asset. Scope the picker to brokers.
  const rows = (accounts.data ?? []).filter((a: Account) => a.type === "BROKER");

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const acc = await createAccount.mutateAsync({
        name: trimmed,
        type: "BROKER",
        currency: currency.trim().toUpperCase() || "EUR",
        balance: 0,
      });
      onChange(acc.id);
      setName("");
      setCurrency("EUR");
      setShowNew(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((a: Account) => {
        const selected = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors",
              selected
                ? "border-foreground/30 bg-card shadow-sm"
                : "border-transparent bg-secondary/60 hover:bg-secondary",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
              <Wallet className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.currency}</span>
            </span>
            {selected ? <Check className="size-4 shrink-0 text-foreground" /> : null}
          </button>
        );
      })}

      {showNew ? (
        <div className="col-span-2 flex flex-col gap-2 rounded-xl border bg-card p-3">
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="Account name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <Input
              className="w-20 shrink-0 text-center uppercase"
              placeholder="EUR"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void add()}
              disabled={createAccount.isPending || !name.trim()}
            >
              {createAccount.isPending ? "Adding…" : "Add account"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/40 p-2.5 text-sm font-semibold text-[#5b7d10] transition-colors hover:bg-secondary"
        >
          <Plus className="size-4" />
          New account
        </button>
      )}
    </div>
  );
}

// Which "add" variant to show:
// - "full"       Transactions: income, expense, investment.
// - "cashflow"   Expenses & Cash Flow: income / expense only.
// - "investment" Assets & Investments: investment movement only.
export type AddMode = "full" | "cashflow" | "investment";

const SHEET_META: Record<AddMode, { title: string; description: string }> = {
  full: { title: "New transaction", description: "Record an income, expense or investment." },
  cashflow: { title: "New transaction", description: "Record an income or an expense." },
  investment: {
    title: "New investment movement",
    description: "Record a buy or sell.",
  },
};

// Shared "new transaction" drawer. Slides in from the right; the `mode` scopes
// which directions are offered. Pass a custom `trigger` or fall back to a
// default button. Bulk CSV import lives on the dedicated /imports page.
export function AddTransactionDialog({
  trigger,
  mode = "full",
}: {
  trigger?: ReactElement;
  mode?: AddMode;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const categories = useCategories(kind === "INVESTMENT" ? "EXPENSE" : kind);
  const create = useCreateTransaction();
  const meta = SHEET_META[mode];
  const kindOptions = mode === "full" ? KIND_OPTIONS : KIND_OPTIONS.filter((o) => o.value !== "INVESTMENT");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "INVESTMENT") return; // handled by the investment form
    create.mutate(
      {
        direction: kind,
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button>
              <Plus data-icon="inline-start" />
              Add transaction
            </Button>
          )
        }
      />
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-[88%] sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="font-display text-xl font-semibold tracking-tight">
            {meta.title}
          </SheetTitle>
          <SheetDescription>{meta.description}</SheetDescription>
        </SheetHeader>
        {mode === "investment" ? (
          <InvestmentCreate onDone={() => setOpen(false)} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-6 py-4">
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Segment
                  options={kindOptions}
                  value={kind}
                  onChange={(v) => {
                    setKind(v);
                    setCategoryId("");
                  }}
                />
              </Field>
            </div>
            {kind === "INVESTMENT" ? (
              <InvestmentCreate onDone={() => setOpen(false)} />
            ) : (
              <FormShell onSubmit={submit} submitLabel="Save" submitting={create.isPending}>
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <CategoryPicker
                    categories={categories.data ?? []}
                    isLoading={categories.isLoading}
                    value={categoryId}
                    onChange={setCategoryId}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="note">Note</FieldLabel>
                  <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </FormShell>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Right-side drawer to add a buy/sell locked to one position. Opened from the
// position drill-down (which closes first, so the two modals never overlap).
export function AddMovementSheet({
  ticker,
  open,
  onOpenChange,
}: {
  ticker: SelectedTicker;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateInvestmentTx();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-[88%] sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="font-display text-xl font-semibold tracking-tight">
            New investment movement
          </SheetTitle>
          <SheetDescription>Record a buy or sell for {ticker.symbol}.</SheetDescription>
        </SheetHeader>
        <InvestmentMovementForm
          lockedTicker={ticker}
          submitting={create.isPending}
          submitLabel="Save movement"
          onSubmit={(tickerId, values) =>
            create.mutate(
              { tickerId, ...values },
              {
                onSuccess: () => {
                  toast.success("Movement recorded");
                  onOpenChange(false);
                },
                onError: (err) => toast.error(err.message),
              },
            )
          }
        />
      </SheetContent>
    </Sheet>
  );
}

// Create wrapper: the shared movement form wired to the create mutation.
function InvestmentCreate({ onDone }: { onDone: () => void }) {
  const create = useCreateInvestmentTx();
  return (
    <InvestmentMovementForm
      submitting={create.isPending}
      submitLabel="Save movement"
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
  const [ticker, setTicker] = useState<SelectedTicker | null>(lockedTicker ?? null);
  const [side, setSide] = useState<"BUY" | "SELL">(initial?.side ?? "BUY");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [quantity, setQuantity] = useState(initial?.quantity ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [fee, setFee] = useState(initial?.fee ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [cashAccountId, setCashAccountId] = useState(initial?.cashAccountId ?? "");

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

  const qtyN = Number(quantity) || 0;
  const priceN = Number(price) || 0;
  const feeN = Number(fee) || 0;
  const total = qtyN > 0 && priceN > 0 ? qtyN * priceN + feeN : null;
  const priceCurrency = ticker?.currency ?? "EUR";

  return (
    <FormShell
      onSubmit={submit}
      submitLabel={submitLabel}
      submitting={submitting}
      canSubmit={!!ticker}
    >
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
        <FieldLabel>Account</FieldLabel>
        <AccountPicker value={cashAccountId} onChange={setCashAccountId} />
      </Field>

      <Field>
        <FieldLabel>Side</FieldLabel>
        <Segment
          options={[
            { value: "BUY", label: "↗ Buy" },
            { value: "SELL", label: "↘ Sell" },
          ]}
          value={side}
          onChange={setSide}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
          <Input
            id="quantity"
            type="number"
            step="any"
            placeholder="0.00"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="price">Price</FieldLabel>
          <Input
            id="price"
            type="number"
            step="any"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </Field>
      </div>

      {total !== null ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Total operation</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatMoney(total, priceCurrency)}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <FieldLabel htmlFor="fee">
            Fee <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="fee"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="inv-note">Note</FieldLabel>
        <Textarea id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormShell>
  );
}
