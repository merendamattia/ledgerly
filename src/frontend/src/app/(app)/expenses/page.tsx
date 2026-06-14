"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload, ArrowDownLeft, ArrowUpRight, Scale, Pencil } from "lucide-react";
import { MoneyAmount } from "@/components/money-amount";
import { DataTable, type Column } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatCard } from "@/components/stat-card";
import { CategoryIcon, CategoryBadge } from "@/components/category-badge";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { CashFlowLineChart } from "@/components/charts/cashflow-line-chart";
import { IncomeExpensePie } from "@/components/charts/income-expense-pie";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearch } from "@/components/search-context";
import { useCategories } from "@/hooks/use-categories";
import { useSettings } from "@/hooks/use-settings";
import { useDashboard } from "@/hooks/use-dashboard";
import {
  useExpenses,
  useDeleteTransaction,
  fetchExpenses,
  type Transaction,
  type TransactionFilters,
} from "@/hooks/use-expenses";
import {
  formatDate,
  formatMoney,
  monthsForRange,
  dateRangePreset,
  truncate,
  DIRECTION_LABELS,
  type ChartRange,
  type DatePreset,
} from "@/lib/format";

const ALL = "ALL";
const PAGE_SIZE = 50;

const RANGE_LABELS: Record<ChartRange, string> = {
  ytd: "This year",
  "12m": "Last 12 months",
  "24m": "Last 2 years",
  "36m": "Last 3 years",
};

const PRESET_LABELS: Record<DatePreset | "custom", string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  all: "All time",
  custom: "Custom",
};

function exportCsv(rows: Transaction[], currency: string) {
  const header = ["Date", "Direction", "Category", "Note", "Amount", "Currency"];
  const body = rows.map((t) => [
    t.date,
    t.direction,
    t.category?.name ?? "",
    (t.note ?? "").replace(/"/g, '""'),
    String(t.amount),
    currency,
  ]);
  const csv = [header, ...body]
    .map((cols) => cols.map((c) => `"${c}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExpensesPage() {
  const [chartRange, setChartRange] = useState<ChartRange>("12m");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [preset, setPreset] = useState<DatePreset | "custom">("all");
  const [direction, setDirection] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const [catDirection, setCatDirection] = useState<"expense" | "income">("expense");
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [detailEdit, setDetailEdit] = useState(false);

  const { query } = useSearch();
  const settings = useSettings();
  const allCategories = useCategories();
  const dashboard = useDashboard(monthsForRange(chartRange));
  const currency = settings.data?.baseCurrency ?? "EUR";

  // Everything in the analytics section (cards + charts) reflects the range
  // chosen in the top toolbar; the transactions list below has its own filters.
  const series = dashboard.data?.cashFlowSeries ?? [];
  const rangeIncome = series.reduce((s, d) => s + d.income, 0);
  const rangeExpense = series.reduce((s, d) => s + d.expense, 0);
  const rangeBalance = rangeIncome - rangeExpense;

  // Per-category totals for the range, split by direction and sorted by size.
  const breakdown = dashboard.data?.categoryBreakdown ?? [];
  const expenseByCategory = breakdown
    .filter((c) => c.expense > 0)
    .map((c) => ({ name: c.name, value: c.expense }))
    .sort((a, b) => b.value - a.value);
  const incomeByCategory = breakdown
    .filter((c) => c.income > 0)
    .map((c) => ({ name: c.name, value: c.income }))
    .sort((a, b) => b.value - a.value);

  // Filters that scope the transactions list (and the export).
  const baseFilters: TransactionFilters = useMemo(
    () => ({
      direction: direction === ALL ? undefined : (direction as "INCOME" | "EXPENSE"),
      categoryId: categoryId === ALL ? undefined : categoryId,
      from: from || undefined,
      to: to || undefined,
    }),
    [direction, categoryId, from, to],
  );

  const { data, isLoading } = useExpenses({ ...baseFilters, limit });
  // Always-latest 10, independent of the list filters, for the side panel.
  const latest = useExpenses({ limit: 10 });
  const del = useDeleteTransaction();

  // Any filter change resets the list back to the first page.
  function applyPreset(value: DatePreset | "custom") {
    setPreset(value);
    setLimit(PAGE_SIZE);
    if (value !== "custom") {
      const range = dateRangePreset(value);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await fetchExpenses(baseFilters);
      exportCsv(rows, currency);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return data;
    return data.filter(
      (t) =>
        (t.note ?? "").toLowerCase().includes(q) ||
        (t.category?.name ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  const hasMore = !query && !!data && data.length === limit;

  // value→label maps so the select triggers show readable text, not raw keys.
  const directionItems = { [ALL]: "All", ...DIRECTION_LABELS };
  const categoryItems = useMemo(
    () => ({
      [ALL]: "All",
      ...Object.fromEntries((allCategories.data ?? []).map((c) => [c.id, c.name])),
    }),
    [allCategories.data],
  );

  function openDetail(tx: Transaction, edit = false) {
    setDetailEdit(edit);
    setDetailTx(tx);
  }

  const columns: Column<Transaction>[] = [
    { header: "Date", cell: (t) => formatDate(t.date), className: "text-muted-foreground" },
    {
      header: "Description",
      cell: (t) => (
        <div className="flex items-center gap-3">
          <CategoryIcon name={t.category?.name} />
          <span className="font-medium">{truncate(t.note || t.category?.name || "Transaction")}</span>
        </div>
      ),
    },
    {
      header: "Category",
      cell: (t) => <CategoryBadge name={t.category?.name} />,
    },
    {
      header: "Amount",
      align: "right",
      cell: (t) => (
        <MoneyAmount
          value={t.direction === "EXPENSE" ? -t.amount : t.amount}
          currency={currency}
          colored
          signed
          className="font-medium"
        />
      ),
    },
    {
      header: "",
      align: "right",
      cell: (t) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openDetail(t, true)}>
            <Pencil />
          </Button>
          <ConfirmDialog
            title="Delete transaction?"
            confirmLabel="Delete"
            onConfirm={() =>
              del.mutate(t.id, {
                onSuccess: () => toast.success("Deleted"),
                onError: (e) => toast.error(e.message),
              })
            }
            trigger={
              <Button variant="ghost" size="icon" aria-label="Delete">
                <Trash2 />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Track and review your income and spending.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={chartRange}
            items={RANGE_LABELS}
            onValueChange={(v) => setChartRange((v ?? "12m") as ChartRange)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as ChartRange[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {RANGE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Upload data-icon="inline-start" />
            Export
          </Button>
          <ImportTransactionsDialog />
          <AddTransactionDialog />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label={`Income · ${RANGE_LABELS[chartRange]}`}
          value={formatMoney(rangeIncome, currency)}
          icon={ArrowDownLeft}
          accent="positive"
        />
        <StatCard
          label={`Expenses · ${RANGE_LABELS[chartRange]}`}
          value={formatMoney(rangeExpense, currency)}
          icon={ArrowUpRight}
          accent="negative"
        />
        <StatCard
          label={`Balance · ${RANGE_LABELS[chartRange]}`}
          value={formatMoney(rangeBalance, currency)}
          icon={Scale}
          accent={rangeBalance >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly trend</CardTitle>
            <CardAction>
              <Tabs
                value={chartType}
                onValueChange={(v) => setChartType((v ?? "bar") as "bar" | "line")}
              >
                <TabsList>
                  <TabsTrigger value="bar">Bars</TabsTrigger>
                  <TabsTrigger value="line">Lines</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent>
            {chartType === "bar" ? (
              <CashFlowChart data={series} currency={currency} />
            ) : (
              <CashFlowLineChart data={series} currency={currency} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Income vs expense</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpensePie income={rangeIncome} expense={rangeExpense} currency={currency} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <CardAction>
              <Tabs
                value={catDirection}
                onValueChange={(v) => setCatDirection((v ?? "expense") as "expense" | "income")}
              >
                <TabsList>
                  <TabsTrigger value="expense">Expense</TabsTrigger>
                  <TabsTrigger value="income">Income</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={catDirection === "expense" ? expenseByCategory : incomeByCategory}
              currency={currency}
              fallback={catDirection === "expense" ? "var(--negative)" : "var(--positive)"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" onClick={() => setViewAllOpen(true)}>
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {latest.isLoading ? (
                <li className="px-4 py-4 text-sm text-muted-foreground">Loading…</li>
              ) : (latest.data ?? []).length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </li>
              ) : (
                latest.data?.map((t) => {
                  const signed = t.direction === "EXPENSE" ? -t.amount : t.amount;
                  return (
                    <li
                      key={t.id}
                      onClick={() => openDetail(t)}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <CategoryIcon name={t.category?.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {t.note || t.category?.name || "Transaction"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                      </div>
                      <CategoryBadge name={t.category?.name} />
                      <MoneyAmount
                        value={signed}
                        currency={currency}
                        colored
                        signed
                        className="w-24 text-right text-sm font-medium"
                      />
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit"
                          onClick={() => openDetail(t, true)}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          title="Delete transaction?"
                          confirmLabel="Delete"
                          onConfirm={() =>
                            del.mutate(t.id, {
                              onSuccess: () => toast.success("Deleted"),
                              onError: (e) => toast.error(e.message),
                            })
                          }
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Delete">
                              <Trash2 />
                            </Button>
                          }
                        />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>All transactions</DialogTitle>
            <DialogDescription>Filter and browse every transaction.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <Select
                value={preset}
                items={PRESET_LABELS}
                onValueChange={(v) => applyPreset((v ?? "all") as DatePreset)}
              >
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["this-month", "last-month", "this-year", "all"] as DatePreset[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PRESET_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Direction</label>
              <Select
                value={direction}
                items={directionItems}
                onValueChange={(v) => {
                  setDirection(v ?? ALL);
                  setLimit(PAGE_SIZE);
                }}
              >
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select
                value={categoryId}
                items={categoryItems}
                onValueChange={(v) => {
                  setCategoryId(v ?? ALL);
                  setLimit(PAGE_SIZE);
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {allCategories.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("custom");
                  setLimit(PAGE_SIZE);
                }}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("custom");
                  setLimit(PAGE_SIZE);
                }}
                className="h-9 w-[150px]"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            getRowKey={(t) => t.id}
            isLoading={isLoading}
            onRowClick={(t) => openDetail(t)}
          />

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Load more
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TransactionDetailDialog
        transaction={detailTx}
        open={detailTx !== null}
        onOpenChange={(o) => {
          if (!o) setDetailTx(null);
        }}
        currency={currency}
        defaultEditing={detailEdit}
      />
    </div>
  );
}
