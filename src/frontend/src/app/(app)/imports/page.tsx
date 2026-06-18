"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronDown, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MoneyAmount } from "@/components/money-amount";
import { DataTable, type Column } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ImportSnapshotsDialog } from "@/components/import-snapshots-dialog";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { ImportInvestmentTransactionsDialog } from "@/components/import-investment-transactions-dialog";
import {
  useCashSnapshots,
  useDeleteCashSnapshot,
  type Account,
  type CashSnapshot,
} from "@/hooks/use-accounts";
import { useDebtSnapshots, useDeleteDebtSnapshot, type DebtSnapshot } from "@/hooks/use-debts";
import { shortDate } from "@/lib/format";

const CASH_SECTIONS: { category: Account["category"]; label: string }[] = [
  { category: "LIQUIDITY", label: "Liquidity" },
  { category: "CREDIT", label: "Credits" },
  { category: "OTHER_ASSET", label: "Other assets" },
];

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

// Collapsible section: there are many snapshot tables, so each starts collapsed
// and expands on click. The count stays visible in the header when collapsed.
function CollapsibleCard({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-(--card-spacing) text-left"
      >
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
          <ChevronDown
            className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </div>
      </button>
      {open ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

export default function ImportsPage() {
  const cashSnapshots = useCashSnapshots();
  const debtSnapshots = useDebtSnapshots();
  const deleteCash = useDeleteCashSnapshot();
  const deleteDebt = useDeleteDebtSnapshot();

  const cashColumns: Column<CashSnapshot>[] = [
    { header: "Date", cell: (s) => shortDate(s.date) },
    { header: "Account", cell: (s) => s.cashAccount?.name ?? "—" },
    {
      header: "Balance",
      align: "right",
      cell: (s) => <MoneyAmount value={s.balance} currency={s.cashAccount?.currency ?? "EUR"} />,
    },
    {
      header: "",
      align: "right",
      cell: (s) => (
        <ConfirmDialog
          title="Delete snapshot?"
          description={`This removes the ${shortDate(s.date)} balance for "${s.cashAccount?.name ?? "this account"}".`}
          confirmLabel="Delete"
          onConfirm={() =>
            deleteCash.mutate(s.id, {
              onSuccess: () => toast.success("Snapshot deleted"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon" aria-label="Delete snapshot">
              <Trash2 />
            </Button>
          }
        />
      ),
    },
  ];

  const debtColumns: Column<DebtSnapshot>[] = [
    { header: "Date", cell: (s) => shortDate(s.date) },
    { header: "Debt", cell: (s) => s.debt?.name ?? "—" },
    {
      header: "Amount",
      align: "right",
      cell: (s) => (
        <span className="text-negative">
          −<MoneyAmount value={s.amount} currency={s.debt?.currency ?? "EUR"} />
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (s) => (
        <ConfirmDialog
          title="Delete snapshot?"
          description={`This removes the ${shortDate(s.date)} amount for "${s.debt?.name ?? "this debt"}".`}
          confirmLabel="Delete"
          onConfirm={() =>
            deleteDebt.mutate(s.id, {
              onSuccess: () => toast.success("Snapshot deleted"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon" aria-label="Delete snapshot">
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
        title="Imports"
        description="Bulk-import balances and transactions from CSV/TSV, and manage saved snapshots."
      />

      <Card>
        <CardHeader>
          <CardTitle>Import data</CardTitle>
          <CardDescription>
            Each importer maps a CSV/TSV and previews before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Snapshots</p>
            <div className="flex flex-wrap gap-2">
              <ImportSnapshotsDialog
                lockedKind="LIQUIDITY"
                trigger={
                  <Button variant="outline" size="sm">
                    <Upload data-icon="inline-start" />
                    Liquidity
                  </Button>
                }
              />
              <ImportSnapshotsDialog
                lockedKind="CREDIT"
                trigger={
                  <Button variant="outline" size="sm">
                    <Upload data-icon="inline-start" />
                    Credits
                  </Button>
                }
              />
              <ImportSnapshotsDialog
                lockedKind="OTHER_ASSET"
                trigger={
                  <Button variant="outline" size="sm">
                    <Upload data-icon="inline-start" />
                    Other assets
                  </Button>
                }
              />
              <ImportSnapshotsDialog
                lockedKind="DEBT"
                trigger={
                  <Button variant="outline" size="sm">
                    <Upload data-icon="inline-start" />
                    Debts
                  </Button>
                }
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Transactions</p>
            <div className="flex flex-wrap gap-2">
              <ImportTransactionsDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Upload data-icon="inline-start" />
                    Income & expenses
                  </Button>
                }
              />
              <ImportInvestmentTransactionsDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Upload data-icon="inline-start" />
                    Investment movements
                  </Button>
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {CASH_SECTIONS.map(({ category, label }) => {
        const rows = (cashSnapshots.data ?? [])
          .filter((s) => s.cashAccount?.category === category)
          .sort(byDateDesc);
        return (
          <CollapsibleCard
            key={category}
            title={`${label} snapshots`}
            description="Saved dated balances. Delete any you want to drop."
            count={rows.length}
          >
            <DataTable
              columns={cashColumns}
              data={rows}
              getRowKey={(s) => s.id}
              isLoading={cashSnapshots.isLoading}
            />
          </CollapsibleCard>
        );
      })}

      <CollapsibleCard
        title="Debt snapshots"
        description="Saved dated amounts. Delete any you want to drop."
        count={debtSnapshots.data?.length ?? 0}
      >
        <DataTable
          columns={debtColumns}
          data={[...(debtSnapshots.data ?? [])].sort(byDateDesc)}
          getRowKey={(s) => s.id}
          isLoading={debtSnapshots.isLoading}
        />
      </CollapsibleCard>
    </div>
  );
}
