"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MoneyAmount } from "@/components/money-amount";
import { DataTable, type Column } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useCashSnapshots,
  useDeleteCashSnapshot,
  useDeleteCashSnapshotsByCategory,
  type Account,
  type CashSnapshot,
} from "@/hooks/use-accounts";
import {
  useDebtSnapshots,
  useDeleteAllDebtSnapshots,
  useDeleteDebtSnapshot,
  type DebtSnapshot,
} from "@/hooks/use-debts";
import { shortDate } from "@/lib/format";
import { useLocaleLabels } from "@/hooks/use-locale-labels";

const ImportSnapshotsDialog = dynamic(
  () => import("@/components/import-snapshots-dialog").then((mod) => mod.ImportSnapshotsDialog),
  { ssr: false },
);
const ImportTransactionsDialog = dynamic(
  () =>
    import("@/components/import-transactions-dialog").then((mod) => mod.ImportTransactionsDialog),
  { ssr: false },
);
const ImportInvestmentTransactionsDialog = dynamic(
  () =>
    import("@/components/import-investment-transactions-dialog").then(
      (mod) => mod.ImportInvestmentTransactionsDialog,
    ),
  { ssr: false },
);

type SnapshotImportKind = Account["category"] | "DEBT";
type ImportDialogKey = SnapshotImportKind | "TRANSACTIONS" | "INVESTMENTS" | null;

/** Sorts dated import rows from newest to oldest. */
const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

/**
 * Renders a collapsible import section with a visible row count in its header.
 */
function CollapsibleCard({
  title,
  description,
  count,
  action,
  children,
}: {
  title: string;
  description: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-start gap-2 px-(--card-spacing)">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
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
              className={cn(
                "size-5 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        </button>
        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
      {open ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

/** Renders data import tools and imported snapshot cleanup tables. */
export default function ImportsPage() {
  const t = useTranslations("importsPage");
  const common = useTranslations("common");
  const { cashCategories } = useLocaleLabels();
  const cashSections: { category: Account["category"]; label: string }[] = [
    { category: "LIQUIDITY", label: cashCategories.LIQUIDITY },
    { category: "CREDIT", label: cashCategories.CREDIT },
    { category: "OTHER_ASSET", label: cashCategories.OTHER_ASSET },
  ];
  const [importDialog, setImportDialog] = useState<ImportDialogKey>(null);
  const cashSnapshots = useCashSnapshots();
  const debtSnapshots = useDebtSnapshots();
  const deleteCash = useDeleteCashSnapshot();
  const deleteCashCategory = useDeleteCashSnapshotsByCategory();
  const deleteDebt = useDeleteDebtSnapshot();
  const deleteAllDebtSnapshots = useDeleteAllDebtSnapshots();

  const cashColumns: Column<CashSnapshot>[] = [
    { header: t("date"), cell: (s) => shortDate(s.date) },
    { header: t("account"), cell: (s) => s.cashAccount?.name ?? "—" },
    {
      header: t("balance"),
      align: "right",
      cell: (s) => <MoneyAmount value={s.balance} currency={s.cashAccount?.currency ?? "EUR"} />,
    },
    {
      header: "",
      align: "right",
      cell: (s) => (
        <ConfirmDialog
          title={t("deleteSnapshot")}
          description={t("deleteCashDescription", { date: shortDate(s.date), name: s.cashAccount?.name ?? t("thisAccount") })}
          confirmLabel={common("delete")}
          onConfirm={() =>
            deleteCash.mutate(s.id, {
              onSuccess: () => toast.success(t("snapshotDeleted")),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("deleteSnapshotAria")}>
              <Trash2 />
            </Button>
          }
        />
      ),
    },
  ];

  const debtColumns: Column<DebtSnapshot>[] = [
    { header: t("date"), cell: (s) => shortDate(s.date) },
    { header: t("debt"), cell: (s) => s.debt?.name ?? "—" },
    {
      header: t("amount"),
      align: "right",
      cell: (s) => (
        <span className="text-negative-ink">
          −<MoneyAmount value={s.amount} currency={s.debt?.currency ?? "EUR"} />
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (s) => (
        <ConfirmDialog
          title={t("deleteSnapshot")}
          description={t("deleteDebtDescription", { date: shortDate(s.date), name: s.debt?.name ?? t("thisDebt") })}
          confirmLabel={common("delete")}
          onConfirm={() =>
            deleteDebt.mutate(s.id, {
              onSuccess: () => toast.success(t("snapshotDeleted")),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("deleteSnapshotAria")}>
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
        title={t("title")}
        description={t("description")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("importData")}</CardTitle>
          <CardDescription>{t("importDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">{t("snapshots")}</p>
            <div className="flex flex-wrap gap-2">
              <ImportButton label={cashCategories.LIQUIDITY} onClick={() => setImportDialog("LIQUIDITY")} />
              <ImportButton label={cashCategories.CREDIT} onClick={() => setImportDialog("CREDIT")} />
              <ImportButton label={cashCategories.OTHER_ASSET} onClick={() => setImportDialog("OTHER_ASSET")} />
              <ImportButton label={t("debts")} onClick={() => setImportDialog("DEBT")} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">{t("transactions")}</p>
            <div className="flex flex-wrap gap-2">
              <ImportButton
                label={t("incomeExpenses")}
                onClick={() => setImportDialog("TRANSACTIONS")}
              />
              <ImportButton
                label={t("investmentMovements")}
                onClick={() => setImportDialog("INVESTMENTS")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {importDialog === "TRANSACTIONS" ? (
        <ImportTransactionsDialog open onOpenChange={(open) => !open && setImportDialog(null)} />
      ) : importDialog === "INVESTMENTS" ? (
        <ImportInvestmentTransactionsDialog
          open
          onOpenChange={(open) => !open && setImportDialog(null)}
        />
      ) : importDialog ? (
        <ImportSnapshotsDialog
          lockedKind={importDialog}
          open
          onOpenChange={(open) => !open && setImportDialog(null)}
        />
      ) : null}

      {cashSections.map(({ category, label }) => {
        const rows = (cashSnapshots.data ?? [])
          .filter((s) => s.cashAccount?.category === category)
          .sort(byDateDesc);
        const disabled =
          rows.length === 0 || cashSnapshots.isLoading || deleteCashCategory.isPending;
        return (
          <CollapsibleCard
            key={category}
            title={t("cashTitle", { label })}
            description={t("savedBalances")}
            count={rows.length}
            action={
              <ConfirmDialog
                title={t("deleteAllTitle", { label: label.toLocaleLowerCase() })}
                description={t("deleteAllCashDescription", { count: rows.length, label: label.toLocaleLowerCase() })}
                confirmLabel={t("deleteAll")}
                onConfirm={() =>
                  deleteCashCategory.mutate(category, {
                    onSuccess: (result) =>
                      toast.success(t("deletedCount", { count: result.deleted })),
                    onError: (e) => toast.error(e.message),
                  })
                }
                trigger={
                  <Button variant="destructive" size="sm" disabled={disabled}>
                    <Trash2 data-icon="inline-start" />
                    {t("deleteAll")}
                  </Button>
                }
              />
            }
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
        title={t("debtSnapshots")}
        description={t("savedAmounts")}
        count={debtSnapshots.data?.length ?? 0}
        action={
          <ConfirmDialog
            title={t("deleteAllTitle", { label: t("debts").toLocaleLowerCase() })}
            description={t("deleteAllDebtDescription", { count: debtSnapshots.data?.length ?? 0 })}
            confirmLabel={t("deleteAll")}
            onConfirm={() =>
              deleteAllDebtSnapshots.mutate(undefined, {
                onSuccess: (result) =>
                  toast.success(t("deletedCount", { count: result.deleted })),
                onError: (e) => toast.error(e.message),
              })
            }
            trigger={
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  (debtSnapshots.data?.length ?? 0) === 0 ||
                  debtSnapshots.isLoading ||
                  deleteAllDebtSnapshots.isPending
                }
              >
                <Trash2 data-icon="inline-start" />
                {t("deleteAll")}
              </Button>
            }
          />
        }
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

function ImportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Upload data-icon="inline-start" />
      {label}
    </Button>
  );
}
