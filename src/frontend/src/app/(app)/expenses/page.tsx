"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload, ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const { query } = useSearch();
  const settings = useSettings();
  const allCategories = useCategories();
  const dashboard = useDashboard(monthsForRange(chartRange));
  const currency = settings.data?.baseCurrency ?? "EUR";
  const cashFlowMonth = dashboard.data?.cashFlowMonth ?? { income: 0, expense: 0 };
  const balance = cashFlowMonth.income - cashFlowMonth.expense;

  const series = dashboard.data?.cashFlowSeries ?? [];
  const rangeIncome = series.reduce((s, d) => s + d.income, 0);
  const rangeExpense = series.reduce((s, d) => s + d.expense, 0);

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

  const columns: Column<Transaction>[] = [
    { header: "Date", cell: (t) => formatDate(t.date), className: "text-muted-foreground" },
    {
      header: "Description",
      cell: (t) => (
        <div className="flex items-center gap-3">
          <CategoryIcon name={t.category?.name} color={t.category?.color} />
          <span className="font-medium">{t.note || t.category?.name || "Transaction"}</span>
        </div>
      ),
    },
    {
      header: "Category",
      cell: (t) => <CategoryBadge name={t.category?.name} color={t.category?.color} />,
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
            <Button variant="ghost" size="icon">
              <Trash2 />
            </Button>
          }
        />
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
          label="Income (month)"
          value={formatMoney(cashFlowMonth.income, currency)}
          icon={ArrowDownLeft}
          accent="positive"
        />
        <StatCard
          label="Expenses (month)"
          value={formatMoney(cashFlowMonth.expense, currency)}
          icon={ArrowUpRight}
          accent="negative"
        />
        <StatCard
          label="Balance (month)"
          value={formatMoney(balance, currency)}
          icon={Scale}
          accent={balance >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly trend</CardTitle>
            <CardAction className="flex flex-wrap items-center gap-2">
              <Tabs
                value={chartType}
                onValueChange={(v) => setChartType((v ?? "bar") as "bar" | "line")}
              >
                <TabsList>
                  <TabsTrigger value="bar">Bars</TabsTrigger>
                  <TabsTrigger value="line">Lines</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select
                value={chartRange}
                onValueChange={(v) => setChartRange((v ?? "12m") as ChartRange)}
              >
                <SelectTrigger className="h-8 w-[160px]">
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

      <Card>
        <CardHeader>
          <CardTitle>All transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <Select value={preset} onValueChange={(v) => applyPreset((v ?? "all") as DatePreset)}>
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

          <DataTable columns={columns} data={rows} getRowKey={(t) => t.id} isLoading={isLoading} />

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
