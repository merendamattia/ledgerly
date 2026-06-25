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
import { TagInput } from "@/components/tag-input";
import { RecurringFields, validateRecurring } from "@/components/recurring-fields";
import { CategoryIcon } from "@/components/category-badge";
import { TickerSearch, type SelectedTicker } from "@/components/ticker-search";
import { useCategories, type Category } from "@/hooks/use-categories";
import { useCreateTransaction } from "@/hooks/use-expenses";
import { useCreateRecurringExpense } from "@/hooks/use-recurring";
import type { RecurEndMode, RecurInterval } from "@/lib/recurring";
import { useCreateInvestmentTx } from "@/hooks/use-investments";
import { useAccounts, useCreateAccount, type Account } from "@/hooks/use-accounts";
import { todayISO, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Kind = "INCOME" | "EXPENSE" | "INVESTMENT";

/**
 * Renders the shared add-drawer form shell with scrollable fields and pinned submit.
 */
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

/** Renders the pill-style segmented control used by transaction forms. */
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

/** Renders selectable category chips scoped to the current movement kind. */
export function CategoryPicker({
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

/** Renders broker-account cards plus inline account creation for investment movements. */
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

  /** Creates and selects a new broker account from the inline picker form. */
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

/**
 * Renders the shared add drawer for income, expense, and investment movements.
 */
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
  // Optional "make this recurring" path: off by default; when on, the movement
  // becomes a recurring rule (the date acts as the start date).
  const [recurring, setRecurring] = useState(false);
  const [intervalUnit, setIntervalUnit] = useState<RecurInterval>("MONTH");
  const [intervalCount, setIntervalCount] = useState("1");
  const [endMode, setEndMode] = useState<RecurEndMode>("NEVER");
  const [maxOccurrences, setMaxOccurrences] = useState("12");
  const [endDate, setEndDate] = useState("");
  const categories = useCategories(kind === "INVESTMENT" ? "EXPENSE" : kind);
  const create = useCreateTransaction();
  const createRecurring = useCreateRecurringExpense();
  const meta = SHEET_META[mode];
  const kindOptions = mode === "full" ? KIND_OPTIONS : KIND_OPTIONS.filter((o) => o.value !== "INVESTMENT");

  /** Creates either a one-off cashflow transaction or a recurring rule. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "INVESTMENT") return; // handled by the investment form

    if (recurring) {
      const err = validateRecurring(endMode, maxOccurrences, endDate);
      if (err) {
        toast.error(err);
        return;
      }
      createRecurring.mutate(
        {
          direction: kind,
          categoryId: categoryId || null,
          amount: Number(amount),
          note: note || null,
          intervalUnit,
          intervalCount: Number(intervalCount),
          startDate: date,
          endMode,
          maxOccurrences: endMode === "AFTER_OCCURRENCES" ? Number(maxOccurrences) : null,
          endDate: endMode === "ON_DATE" ? endDate : null,
        },
        {
          onSuccess: () => {
            toast.success("Recurring created");
            setOpen(false);
            setAmount("");
            setNote("");
            setRecurring(false);
          },
          onError: (err) => toast.error(err.message),
        },
      );
      return;
    }

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
              <FormShell
                onSubmit={submit}
                submitLabel={recurring ? "Create recurring" : "Save"}
                submitting={create.isPending || createRecurring.isPending}
              >
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
                <Field>
                  <FieldLabel>Tags</FieldLabel>
                  <TagInput note={note} onNoteChange={setNote} />
                </Field>
                <Field>
                  <FieldLabel>Recurring</FieldLabel>
                  <Segment
                    options={[
                      { value: "no", label: "One-off" },
                      { value: "yes", label: "Recurring" },
                    ]}
                    value={recurring ? "yes" : "no"}
                    onChange={(v) => setRecurring(v === "yes")}
                  />
                </Field>
                {recurring ? (
                  <RecurringFields
                    startDate={date}
                    intervalUnit={intervalUnit}
                    setIntervalUnit={setIntervalUnit}
                    intervalCount={intervalCount}
                    setIntervalCount={setIntervalCount}
                    endMode={endMode}
                    setEndMode={setEndMode}
                    maxOccurrences={maxOccurrences}
                    setMaxOccurrences={setMaxOccurrences}
                    endDate={endDate}
                    setEndDate={setEndDate}
                  />
                ) : null}
              </FormShell>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Renders a right-side drawer for adding a buy/sell movement to one position. */
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

/** Wires the shared investment movement form to the create mutation. */
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

/**
 * Renders the shared buy/sell movement form for creating or editing investments.
 */
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

  /** Validates the movement form and submits normalized numeric values. */
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
