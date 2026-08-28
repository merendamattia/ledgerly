"use client";

import { Download, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrivateNumber } from "@/components/private-number";
import { CashflowMatrixTable } from "@/components/matrix/cashflow-matrix-table";
import { useCashflowMatrix, type CashflowMatrix } from "@/hooks/use-cashflow-matrix";
import { formatMoney, formatPercent, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Element-wise sum of every category row into one series. */
function totals(rows: CashflowMatrix["expense"], length: number): number[] {
  const out = Array(length).fill(0);
  for (const row of rows) for (let i = 0; i < length; i++) out[i] += row.values[i];
  return out;
}

/** Serializes the matrix to CSV (categories × months) and downloads it. */
function downloadCsv(data: CashflowMatrix) {
  const esc = (v: unknown) => {
    const raw = String(v ?? "");
    const safe = typeof v === "string" && /^[=+\-@]/.test(raw) ? `\t${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const n = data.months.length;
  const rows: (string | number)[][] = [["Category", ...data.months.map(monthLabel)]];
  const section = (label: string, catRows: CashflowMatrix["expense"], totalLabel: string) => {
    rows.push([label]);
    for (const r of catRows) rows.push([r.label, ...r.values]);
    rows.push([totalLabel, ...totals(catRows, n)]);
  };
  section("Expenses", data.expense, "Total expenses");
  section("Income", data.income, "Total income");
  section("Investments", data.investment, "Total investments");
  const expenseTotal = totals(data.expense, n);
  const incomeTotal = totals(data.income, n);
  const investmentTotal = totals(data.investment, n);
  rows.push(["Balance", ...incomeTotal.map((v, i) => v - expenseTotal[i] - investmentTotal[i])]);
  const csv = rows.map((row) => row.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "cashflow-matrix.csv";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Wide cash-flow matrix: income & spending by category across monthly boundaries. */
export function CashflowMatrixView() {
  const { data, isLoading, isError, error } = useCashflowMatrix();

  const base = data?.baseCurrency ?? "EUR";
  const n = data?.months.length ?? 0;
  const expenseTotal = data ? totals(data.expense, n) : [];
  const incomeTotal = data ? totals(data.income, n) : [];
  const investmentTotal = data ? totals(data.investment, n) : [];
  const balance = incomeTotal.map((v, i) => v - expenseTotal[i] - investmentTotal[i]);
  const saved = balance.map((v, i) => v + investmentTotal[i]);

  // Latest month figures + trailing-12-month savings rate for the ribbon.
  const lastBalance = n > 0 ? balance[n - 1] : null;
  const window12 = (series: number[]) => series.slice(Math.max(0, n - 12)).reduce((a, b) => a + b, 0);
  const income12 = window12(incomeTotal);
  const savings12 = income12 === 0 ? null : (window12(saved) / income12) * 100;
  const categoryCount = data ? data.expense.length + data.income.length + data.investment.length : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary ribbon */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="gap-0 border-0 bg-sidebar p-5 text-sidebar-accent-foreground">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-sidebar-foreground">
              This month
            </span>
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Balance
            </span>
          </div>
          <div
            className={cn(
              "mt-2.5 font-mono text-2xl font-semibold tracking-tight",
              lastBalance != null && lastBalance < 0 ? "text-negative" : "text-primary",
            )}
          >
            {lastBalance == null ? "—" : <PrivateNumber text={formatMoney(lastBalance, base)} />}
          </div>
          <div className="mt-1.5 text-xs text-sidebar-foreground">
            Income minus spending and investments
          </div>
        </Card>

        <Card className="gap-0 p-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            Savings rate (12m)
          </span>
          <div
            className={cn(
              "mt-2.5 font-mono text-2xl font-semibold tracking-tight",
              savings12 != null && savings12 < 0 ? "text-negative-ink" : "text-positive",
            )}
          >
            {savings12 == null ? "—" : formatPercent(savings12)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              <PrivateNumber text={formatMoney(window12(saved), base)} />
            </span>
            saved and invested over 12 months
          </div>
        </Card>

        <Card className="gap-0 p-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            Categories tracked
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
              {categoryCount ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">income + expense + investment</span>
          </div>
          {data && n > 0 ? (
            <div className="mt-1.5 text-xs text-muted-foreground">
              Monthly records since {monthLabel(data.months[0])}
            </div>
          ) : null}
        </Card>

        <Card className="justify-center gap-2 p-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">Actions</span>
          <Button
            variant="outline"
            className="justify-start"
            disabled={!data}
            onClick={() => data && downloadCsv(data)}
          >
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        </Card>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Cash-flow matrix unavailable</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Unable to load the cash-flow matrix."}
          </AlertDescription>
        </Alert>
      ) : (
        <CashflowMatrixTable data={data} isLoading={isLoading} />
      )}

      {!isError ? (
        <div className="flex flex-wrap items-center justify-between gap-4 px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <Info className="size-3.5" />
            Scroll horizontally for older months. Each year ends with its average and total.
          </span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-positive/30" />
              Surplus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-negative/30" />
              Deficit
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
