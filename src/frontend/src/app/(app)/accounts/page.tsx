"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MoneyAmount } from "@/components/money-amount";
import { DataTable, type Column } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccounts, useDeleteAccount, type Account } from "@/hooks/use-accounts";

/** Renders the account list and account-management actions. */
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
