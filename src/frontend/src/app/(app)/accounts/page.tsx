"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MoneyAmount } from "@/components/money-amount";
import { DataTable, type Column } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  type Account,
} from "@/hooks/use-accounts";

function AddAccountDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("BANK");
  const [currency, setCurrency] = useState("EUR");
  const [balance, setBalance] = useState("0");
  const create = useCreateAccount();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, type, currency, balance: Number(balance) },
      {
        onSuccess: () => {
          toast.success("Account created");
          setOpen(false);
          setName("");
          setBalance("0");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" />
        Add account
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
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
              <Button type="submit" disabled={create.isPending}>
                Create
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountsPage() {
  const { data, isLoading } = useAccounts();
  const del = useDeleteAccount();

  const columns: Column<Account>[] = [
    { header: "Name", cell: (a) => a.name },
    { header: "Type", cell: (a) => a.type },
    { header: "Currency", cell: (a) => a.currency },
    {
      header: "Balance",
      align: "right",
      cell: (a) => <MoneyAmount value={a.balance} currency={a.currency} />,
    },
    {
      header: "",
      align: "right",
      cell: (a) => (
        <ConfirmDialog
          title="Delete account?"
          description={`This removes "${a.name}".`}
          confirmLabel="Delete"
          onConfirm={() =>
            del.mutate(a.id, {
              onSuccess: () => toast.success("Account deleted"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon">
              <Trash2 />
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accounts"
        description="Your liquid balances."
        action={<AddAccountDialog />}
      />
      <Card>
        <CardContent>
          <DataTable columns={columns} data={data} getRowKey={(a) => a.id} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
