"use client";

import { useRef, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Plus, UploadCloud } from "lucide-react";
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
import { todayISO, DIRECTION_LABELS, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// Shared shell: a scrollable field area + a pinned footer (Cancel + submit),
// matching the design drawer. Used by every form in the Add drawer.
function FormShell({
  children,
  onSubmit,
  onCancel,
  submitLabel,
  submitting,
  canSubmit = true,
}: {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  submitLabel: string;
  submitting: boolean;
  canSubmit?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">{children}</div>
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-card/95 px-6 py-4 backdrop-blur-sm">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// Which "add" variant to show:
// - "full"       Transactions: income, expense, plus a disabled "investment" option.
// - "cashflow"   Expenses & Cash Flow: income / expense only.
// - "investment" Assets & Investments: investment movement only — not active yet.
export type AddMode = "full" | "cashflow" | "investment";

const SHEET_META: Record<AddMode, { title: string; description: string }> = {
  full: { title: "New transaction", description: "Record an income or an expense." },
  cashflow: { title: "New transaction", description: "Record an income or an expense." },
  investment: {
    title: "New investment movement",
    description: "Record a buy or sell, or import several from a CSV.",
  },
};

// Shared "new transaction" drawer. Slides in from the right; the `mode` scopes
// which directions are offered. Pass a custom `trigger` or fall back to a
// default button. In investment mode, `onImportFile` receives a dropped CSV and
// hands it off to the import flow.
export function AddTransactionDialog({
  trigger,
  mode = "full",
  onImportFile,
}: {
  trigger?: ReactElement;
  mode?: AddMode;
  onImportFile?: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const categories = useCategories(direction);
  const create = useCreateTransaction();
  const meta = SHEET_META[mode];

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
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="font-display text-xl font-semibold tracking-tight">
            {meta.title}
          </SheetTitle>
          <SheetDescription>{meta.description}</SheetDescription>
        </SheetHeader>
        {mode === "investment" ? (
          <InvestmentCreate
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
            onImportFile={
              onImportFile
                ? (file) => {
                    setOpen(false);
                    onImportFile(file);
                  }
                : undefined
            }
          />
        ) : (
          <FormShell
            onSubmit={submit}
            onCancel={() => setOpen(false)}
            submitLabel="Save"
            submitting={create.isPending}
          >
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <Field>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </FormShell>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Create wrapper: the shared movement form wired to the create mutation, plus a
// CSV drag-and-drop that hands the file off to the import flow.
function InvestmentCreate({
  onDone,
  onCancel,
  onImportFile,
}: {
  onDone: () => void;
  onCancel?: () => void;
  onImportFile?: (file: File) => void;
}) {
  const create = useCreateInvestmentTx();
  return (
    <InvestmentMovementForm
      submitting={create.isPending}
      onCancel={onCancel}
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
    >
      {onImportFile ? <CsvDropzone onFile={onImportFile} /> : null}
    </InvestmentMovementForm>
  );
}

// Styled drag-and-drop affordance. On a CSV pick/drop it hands the file up; the
// parse → map → commit flow lives in ImportInvestmentTransactionsDialog.
function CsvDropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3.5">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-[#5b7d10]">
          <UploadCloud className="size-5" />
        </span>
        <span className="text-sm font-semibold">Import several movements via CSV</span>
        <span className="text-xs text-muted-foreground">
          Drop a file here or <span className="text-[#5b7d10] underline">browse</span>
        </span>
        <span className="mt-1.5 text-[11px] text-muted-foreground">
          CSV columns: ticker, side, qty, price, date, fee
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
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
  onCancel,
  children,
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
  onCancel?: () => void;
  children?: React.ReactNode;
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

  const qtyN = Number(quantity) || 0;
  const priceN = Number(price) || 0;
  const feeN = Number(fee) || 0;
  const total = qtyN > 0 && priceN > 0 ? qtyN * priceN + feeN : null;
  const priceCurrency = ticker?.currency ?? "EUR";

  return (
    <FormShell
      onSubmit={submit}
      onCancel={onCancel}
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
            className="mx-auto mt-1.5 text-xs font-semibold text-[#5b7d10] hover:underline"
          >
            + New account
          </button>
        )}
      </Field>

      <Field>
        <FieldLabel>Side</FieldLabel>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["BUY", "SELL"] as const).map((s) => {
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "BUY" ? "↗ Buy" : "↘ Sell"}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
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

      {children}
    </FormShell>
  );
}
