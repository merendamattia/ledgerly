"use client";

import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Coins,
  Landmark,
  Layers3,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SnapshotPanel } from "@/components/snapshot-panel";
import { AddAccountDialog, type SnapshotNoteHistoryItem } from "@/components/add-account-dialog";
import {
  useAccounts,
  useCashSnapshots,
  useCreateCashSnapshot,
  useDeleteAccount,
} from "@/hooks/use-accounts";
import {
  useCreateDebt,
  useCreateDebtSnapshot,
  useDebts,
  useDebtSnapshots,
  useDeleteDebt,
  useUpdateDebt,
  type Debt,
} from "@/hooks/use-debts";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SEGMENTED_CONTROL_ACTIVE_CLASS,
  SEGMENTED_CONTROL_CLASS,
  SEGMENTED_CONTROL_INACTIVE_CLASS,
  SEGMENTED_CONTROL_ITEM_CLASS,
} from "@/components/segmented-control";

type CashCategory = "LIQUIDITY" | "CREDIT" | "OTHER_ASSET";
type SnapshotSection = CashCategory | "DEBT";

const SNAPSHOT_SECTIONS: { value: SnapshotSection; label: string }[] = [
  { value: "LIQUIDITY", label: "Liquidity" },
  { value: "CREDIT", label: "Credits" },
  { value: "OTHER_ASSET", label: "Other assets" },
  { value: "DEBT", label: "Debts" },
];

const SNAPSHOT_SECTION_STYLE: Record<SnapshotSection, { icon: LucideIcon; accent: string }> = {
  LIQUIDITY: { icon: WalletCards, accent: "bg-positive/10 text-positive" },
  CREDIT: { icon: Coins, accent: "bg-chart-3/10 text-chart-3" },
  OTHER_ASSET: { icon: Layers3, accent: "bg-chart-4/10 text-chart-4" },
  DEBT: { icon: Landmark, accent: "bg-negative/10 text-negative-ink" },
};

const addActionClass =
  "w-fit px-0 text-positive hover:bg-transparent hover:text-positive hover:underline";

/** Normalizes API Date/ISO values to the yyyy-mm-dd key used by date inputs. */
function snapshotDateKey(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/** Account/debt snapshot workspace for dated balance tracking. */
export function AccountSnapshotWorkbench({ currency }: { currency: string }) {
  const [section, setSection] = useState<SnapshotSection>("LIQUIDITY");

  return (
    <ActiveSnapshotPanel
      section={section}
      currency={currency}
      headerAction={<SnapshotSectionMenu value={section} onChange={setSection} />}
    />
  );
}

/** Renders the compact menu that chooses which snapshot panel is visible. */
function SnapshotSectionMenu({
  value,
  onChange,
}: {
  value: SnapshotSection;
  onChange: (value: SnapshotSection) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Snapshot section"
      className={cn(SEGMENTED_CONTROL_CLASS, "w-full sm:w-fit")}
    >
      {SNAPSHOT_SECTIONS.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              SEGMENTED_CONTROL_ITEM_CLASS,
              active ? SEGMENTED_CONTROL_ACTIVE_CLASS : SEGMENTED_CONTROL_INACTIVE_CLASS,
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Mounts only the selected snapshot panel, instead of a vertical stack. */
function ActiveSnapshotPanel({
  section,
  currency,
  headerAction,
}: {
  section: SnapshotSection;
  currency: string;
  headerAction: ReactNode;
}) {
  const style = SNAPSHOT_SECTION_STYLE[section];
  if (section === "DEBT") {
    return <DebtsCard currency={currency} headerAction={headerAction} {...style} />;
  }
  return <CashCategoryPanel category={section} currency={currency} headerAction={headerAction} {...style} />;
}

const CASH_PANEL_COPY: Record<
  CashCategory,
  {
    title: string;
    subtitle: string;
    totalLabel: string;
    emptyText: string;
    historyTitle: string;
    historySubtitle: string;
    dialogTitle: string;
    dialogDescription: string;
  }
> = {
  LIQUIDITY: {
    title: "Liquidity · Cash accounts",
    subtitle: "Update balances and save a dated snapshot",
    totalLabel: "Total liquidity",
    emptyText: "No cash accounts yet — add one to start tracking liquidity.",
    historyTitle: "Snapshot history",
    historySubtitle: "Liquidity over time",
    dialogTitle: "New cash account",
    dialogDescription: "Add a cash or bank account.",
  },
  CREDIT: {
    title: "Credits · Receivables",
    subtitle: "Update amounts owed to you and save a dated snapshot",
    totalLabel: "Total credits",
    emptyText: "No credits yet — add one to track money owed to you.",
    historyTitle: "Snapshot history",
    historySubtitle: "Credits over time",
    dialogTitle: "New credit",
    dialogDescription: "Add a receivable (money owed to you).",
  },
  OTHER_ASSET: {
    title: "Other assets",
    subtitle: "Update values and save a dated snapshot",
    totalLabel: "Total other assets",
    emptyText: "No other assets yet — add anything outside the rest.",
    historyTitle: "Snapshot history",
    historySubtitle: "Other assets over time",
    dialogTitle: "New asset",
    dialogDescription: "Add any other asset tracked by value.",
  },
};

/** Renders editable balances, dated snapshot capture, and history for one cash category. */
function CashCategoryPanel({
  category,
  currency,
  headerAction,
  icon,
  accent,
}: {
  category: CashCategory;
  currency: string;
  headerAction?: ReactNode;
  icon: LucideIcon;
  accent: string;
}) {
  const accounts = useAccounts();
  const snapshots = useCashSnapshots();
  const createSnapshot = useCreateCashSnapshot();
  const del = useDeleteAccount();
  const copy = CASH_PANEL_COPY[category];

  const categoryAccounts = useMemo(
    () => (accounts.data ?? []).filter((a) => a.category === category && a.type !== "BROKER"),
    [accounts.data, category],
  );
  const accountIds = useMemo(() => new Set(categoryAccounts.map((a) => a.id)), [categoryAccounts]);
  const accountsById = useMemo(
    () => new Map(categoryAccounts.map((a) => [a.id, a])),
    [categoryAccounts],
  );

  const history = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of snapshots.data ?? []) {
      if (!accountIds.has(s.cashAccountId)) continue;
      const dateKey = snapshotDateKey(s.date);
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + s.balance);
    }
    return [...byDate.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots.data, accountIds]);

  const noteHistoryByAccount = useMemo(() => {
    const byAccount = new Map<string, SnapshotNoteHistoryItem[]>();
    for (const s of snapshots.data ?? []) {
      if (!accountIds.has(s.cashAccountId)) continue;
      const note = s.note?.trim();
      if (!note) continue;
      const items = byAccount.get(s.cashAccountId) ?? [];
      items.push({ date: snapshotDateKey(s.date), note });
      byAccount.set(s.cashAccountId, items);
    }
    for (const items of byAccount.values()) {
      items.sort((a, b) => b.date.localeCompare(a.date));
    }
    return byAccount;
  }, [snapshots.data, accountIds]);

  const latestNotesByAccount = useMemo(() => {
    const latest = new Map<string, string>();
    for (const [accountId, items] of noteHistoryByAccount) {
      const [item] = items;
      if (item) latest.set(accountId, item.note);
    }
    return latest;
  }, [noteHistoryByAccount]);

  const rows = useMemo(
    () =>
      categoryAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        note: a.note ?? latestNotesByAccount.get(a.id) ?? null,
        currency: a.currency,
        value: a.balance,
      })),
    [categoryAccounts, latestNotesByAccount],
  );

  return (
    <SnapshotPanel
      title={copy.title}
      subtitle={copy.subtitle}
      totalLabel={copy.totalLabel}
      rows={rows}
      isLoading={accounts.isLoading}
      emptyText={copy.emptyText}
      addAction={
        <AddAccountDialog
          category={category}
          labels={{ title: copy.dialogTitle, description: copy.dialogDescription }}
          trigger={
            <Button type="button" variant="ghost" size="sm" className={addActionClass}>
              <Plus data-icon="inline-start" />
              Add account
            </Button>
          }
        />
      }
      rowAction={(r) => {
        const account = accountsById.get(r.id);
        return (
          <>
            {account ? (
              <AddAccountDialog
                account={account}
                noteHistory={noteHistoryByAccount.get(account.id) ?? []}
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Edit account">
                    <Pencil />
                  </Button>
                }
              />
            ) : null}
            <ConfirmDialog
              title="Delete account?"
              description={`This removes "${r.name}" and its snapshots.`}
              confirmLabel="Delete"
              onConfirm={() =>
                del.mutate(r.id, {
                  onSuccess: () => toast.success("Account deleted"),
                  onError: (e) => toast.error(e.message),
                })
              }
              trigger={
                <Button variant="ghost" size="icon" aria-label="Delete account">
                  <Trash2 />
                </Button>
              }
            />
          </>
        );
      }}
      submitting={createSnapshot.isPending}
      onCreate={(date, entries) =>
        createSnapshot.mutate(
          {
            date,
            entries: entries.map((e) => ({ accountId: e.id, balance: e.value, note: e.note })),
          },
          {
            onSuccess: () => toast.success(`Snapshot saved for ${shortDate(date)}`),
            onError: (e) => toast.error(e.message),
          },
        )
      }
      history={history}
      historyTitle={copy.historyTitle}
      historySubtitle={copy.historySubtitle}
      currency={currency}
      headerAction={headerAction}
      icon={icon}
      accentClassName={accent}
    />
  );
}

/** Renders editable debt amounts, dated snapshot capture, and debt history. */
function DebtsCard({
  currency,
  headerAction,
  icon,
  accent,
}: {
  currency: string;
  headerAction?: ReactNode;
  icon: LucideIcon;
  accent: string;
}) {
  const debts = useDebts();
  const snapshots = useDebtSnapshots();
  const createSnapshot = useCreateDebtSnapshot();
  const del = useDeleteDebt();

  const debtsById = useMemo(() => new Map((debts.data ?? []).map((d) => [d.id, d])), [debts.data]);

  const history = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of snapshots.data ?? []) {
      const dateKey = snapshotDateKey(s.date);
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + s.amount);
    }
    return [...byDate.entries()]
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots.data]);

  const noteHistoryByDebt = useMemo(() => {
    const byDebt = new Map<string, SnapshotNoteHistoryItem[]>();
    for (const s of snapshots.data ?? []) {
      const note = s.note?.trim();
      if (!note) continue;
      const items = byDebt.get(s.debtId) ?? [];
      items.push({ date: snapshotDateKey(s.date), note });
      byDebt.set(s.debtId, items);
    }
    for (const items of byDebt.values()) {
      items.sort((a, b) => b.date.localeCompare(a.date));
    }
    return byDebt;
  }, [snapshots.data]);

  const latestNotesByDebt = useMemo(() => {
    const latest = new Map<string, string>();
    for (const [debtId, items] of noteHistoryByDebt) {
      const [item] = items;
      if (item) latest.set(debtId, item.note);
    }
    return latest;
  }, [noteHistoryByDebt]);

  const rows = useMemo(
    () =>
      (debts.data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        note: d.note ?? latestNotesByDebt.get(d.id) ?? null,
        currency: d.currency,
        value: d.amount,
      })),
    [debts.data, latestNotesByDebt],
  );

  return (
    <SnapshotPanel
      title="Debts"
      subtitle="Update amounts and save a dated snapshot"
      totalLabel="Total debt"
      rows={rows}
      isLoading={debts.isLoading}
      emptyText="No debts. Use + Add debt to record a loan or credit balance."
      negative
      addAction={<AddDebtDialog />}
      rowAction={(r) => {
        const debt = debtsById.get(r.id);
        return (
          <>
            {debt ? (
              <AddDebtDialog
                debt={debt}
                noteHistory={noteHistoryByDebt.get(debt.id) ?? []}
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Edit debt">
                    <Pencil />
                  </Button>
                }
              />
            ) : null}
            <ConfirmDialog
              title="Delete debt?"
              description={`This removes "${r.name}".`}
              confirmLabel="Delete"
              onConfirm={() =>
                del.mutate(r.id, {
                  onSuccess: () => toast.success("Debt deleted"),
                  onError: (e) => toast.error(e.message),
                })
              }
              trigger={
                <Button variant="ghost" size="icon" aria-label="Delete debt">
                  <Trash2 />
                </Button>
              }
            />
          </>
        );
      }}
      submitting={createSnapshot.isPending}
      onCreate={(date, entries) =>
        createSnapshot.mutate(
          {
            date,
            entries: entries.map((e) => ({ debtId: e.id, amount: e.value, note: e.note })),
          },
          {
            onSuccess: () => toast.success(`Snapshot saved for ${shortDate(date)}`),
            onError: (e) => toast.error(e.message),
          },
        )
      }
      history={history}
      historyTitle="Debt history"
      historySubtitle="Liabilities over time"
      currency={currency}
      headerAction={headerAction}
      icon={icon}
      accentClassName={accent}
    />
  );
}

/** Renders the dialog used to create or edit a tracked debt. */
function AddDebtDialog({
  debt,
  trigger,
  noteHistory = [],
}: {
  debt?: Debt;
  trigger?: ReactElement;
  noteHistory?: SnapshotNoteHistoryItem[];
}) {
  const editing = debt != null;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(debt?.name ?? "");
  const [currency, setCurrency] = useState(debt?.currency ?? "EUR");
  const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const create = useCreateDebt();
  const update = useUpdateDebt();
  const pending = create.isPending || update.isPending;

  /** Resets dialog fields from the current debt/default values when opened. */
  function resetFields() {
    setName(debt?.name ?? "");
    setCurrency(debt?.currency ?? "EUR");
    setAmount(debt ? String(debt.amount) : "");
    setNote(debt?.note ?? "");
  }

  /** Opens/closes the dialog and refreshes stale draft values before editing. */
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) resetFields();
    setOpen(nextOpen);
  }

  /** Creates or updates the debt from the dialog form fields. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, currency, amount: Number(amount), note: note || null };
    const opts = {
      onSuccess: () => {
        toast.success(editing ? "Debt updated" : "Debt added");
        setOpen(false);
        if (!editing) {
          setName("");
          setAmount("");
          setNote("");
        }
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (editing) update.mutate({ id: debt.id, ...payload }, opts);
    else create.mutate(payload, opts);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button type="button" variant="ghost" size="sm" className={addActionClass}>
              <Plus data-icon="inline-start" />
              Add debt
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit debt" : "New debt"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update this liability." : "Record a loan, mortgage or credit balance."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="debt-name">Name</FieldLabel>
              <Input id="debt-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="debt-currency">Currency</FieldLabel>
              <Input
                id="debt-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="debt-amount">Amount</FieldLabel>
              <Input
                id="debt-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="debt-note">Note</FieldLabel>
              <Textarea
                id="debt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                rows={3}
              />
            </Field>
            {editing ? (
              <Field>
                <FieldLabel>Note history</FieldLabel>
                {noteHistory.length > 0 ? (
                  <div className="flex max-h-44 flex-col overflow-auto rounded-lg border">
                    {noteHistory.map((item) => (
                      <div
                        key={`${item.date}:${item.note}`}
                        className="flex flex-col gap-1 border-b px-3 py-2.5 last:border-b-0"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortDate(item.date)}
                        </span>
                        <span className="break-words text-sm">{item.note}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <FieldDescription>No saved snapshot notes yet.</FieldDescription>
                )}
              </Field>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {editing ? "Save changes" : "Add debt"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
