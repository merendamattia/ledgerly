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
import { useCreateAccount, useUpdateAccount, type Account } from "@/hooks/use-accounts";

// Create or edit a cash/bank account. Shared by the Accounts page and the
// Liquidity panel. Pass `account` to edit an existing one.
export function AddAccountDialog({
  trigger,
  account,
}: {
  trigger?: ReactElement;
  account?: Account;
}) {
  const editing = account != null;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "BANK");
  const [currency, setCurrency] = useState(account?.currency ?? "EUR");
  const [balance, setBalance] = useState(account ? String(account.balance) : "0");
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const pending = create.isPending || update.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, type, currency, balance: Number(balance) };
    const opts = {
      onSuccess: () => {
        toast.success(editing ? "Account updated" : "Account created");
        setOpen(false);
        if (!editing) {
          setName("");
          setBalance("0");
        }
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (editing) update.mutate({ id: account.id, ...payload }, opts);
    else create.mutate(payload, opts);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>Add a cash or bank account.</DialogDescription>
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
