"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { useCreateAccount, useUpdateAccount, type Account } from "@/hooks/use-accounts";
import { shortDate } from "@/lib/format";

export interface SnapshotNoteHistoryItem {
  date: string;
  note: string;
}

/**
 * Renders the create/edit dialog for cash, bank, credit, and other-asset accounts.
 */
export function AddAccountDialog({
  trigger,
  account,
  category = "LIQUIDITY",
  labels,
  noteHistory = [],
}: {
  trigger?: ReactElement;
  account?: Account;
  category?: Account["category"];
  labels?: { title?: string; description?: string };
  noteHistory?: SnapshotNoteHistoryItem[];
}) {
  const editing = account != null;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "BANK");
  const [currency, setCurrency] = useState(account?.currency ?? "EUR");
  const [balance, setBalance] = useState(account ? String(account.balance) : "0");
  const [note, setNote] = useState(account?.note ?? "");
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const pending = create.isPending || update.isPending;

  /** Resets dialog fields from the current account/default values when opened. */
  function resetFields() {
    setName(account?.name ?? "");
    setType(account?.type ?? "BANK");
    setCurrency(account?.currency ?? "EUR");
    setBalance(account ? String(account.balance) : "0");
    setNote(account?.note ?? "");
  }

  /** Opens/closes the dialog and refreshes stale draft values before editing. */
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) resetFields();
    setOpen(nextOpen);
  }

  /** Creates or updates the account from the current dialog fields. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Editing keeps the account's existing category; creating uses the prop.
    const payload = editing
      ? { name, type, currency, balance: Number(balance), note: note || null }
      : { name, type, category, currency, balance: Number(balance), note: note || null };
    const opts = {
      onSuccess: () => {
        toast.success(editing ? "Account updated" : "Account created");
        setOpen(false);
        if (!editing) {
          setName("");
          setBalance("0");
          setNote("");
        }
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (editing) update.mutate({ id: account.id, ...payload }, opts);
    else create.mutate(payload, opts);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <Plus data-icon="inline-start" />
              Add account
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit account" : (labels?.title ?? "New account")}
          </DialogTitle>
          <DialogDescription>
            {labels?.description ?? "Add a cash or bank account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="type">Type</FieldLabel>
              <Input id="type" value={type} onChange={(e) => setType(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="currency">Currency</FieldLabel>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="balance">Balance</FieldLabel>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="account-note">Note</FieldLabel>
              <Textarea
                id="account-note"
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
                {editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
