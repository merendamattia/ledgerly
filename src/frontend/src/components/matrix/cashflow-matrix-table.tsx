"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PrivateNumber } from "@/components/private-number";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, monthLabel } from "@/lib/format";
import type { CashflowMatrix } from "@/hooks/use-cashflow-matrix";

// Sticky left column: Category (0). Every value column scrolls to its right.
const CAT = "sticky left-0 z-20 w-44 min-w-44 px-4 py-2.5 text-left";
const MONTH = "w-[5.25rem] min-w-[5.25rem] px-3 py-2.5 text-right";
// Per-year summary columns (average + year total) stand out from the months.
const SUMMARY = "bg-accent border-primary/25 font-semibold";

/** A resolved column: a single month, a year's average, or a year's total. */
type Column =
  | { kind: "month"; year: number; index: number; label: string }
  | { kind: "avg" | "year"; year: number; indices: number[]; label: string };

/** Builds the interleaved column layout: each year's months, its average, its total. */
function buildColumns(months: string[]): Column[] {
  const byYear = new Map<number, number[]>();
  months.forEach((m, index) => {
    const year = Number(m.slice(0, 4));
    (byYear.get(year) ?? byYear.set(year, []).get(year)!).push(index);
  });
  const columns: Column[] = [];
  for (const [year, indices] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    for (const index of indices) {
      columns.push({ kind: "month", year, index, label: monthLabel(months[index]) });
    }
    columns.push({ kind: "avg", year, indices, label: "Avg" });
    columns.push({ kind: "year", year, indices, label: String(year) });
  }
  return columns;
}

/** Value a row contributes to a column: the month cell, the year sum, or the monthly average. */
function cellValue(values: number[], column: Column): number {
  if (column.kind === "month") return values[column.index];
  const total = column.indices.reduce((acc, i) => acc + values[i], 0);
  return column.kind === "avg" ? total / column.indices.length : total;
}

/** Sums category rows element-wise into a single totals series. */
function totalsOf(rows: CashflowMatrix["expense"], length: number): number[] {
  const out = Array(length).fill(0);
  for (const row of rows) for (let i = 0; i < length; i++) out[i] += row.values[i];
  return out;
}

/** A private numeric figure, dimmed at zero. */
function Amount({ value }: { value: number }) {
  return (
    <PrivateNumber
      text={formatNumber(value, 0)}
      className={cn("font-mono", value === 0 && "text-muted-foreground")}
    />
  );
}

/** Renders the cash-flow matrix: expenses, income, investments and balance across month columns. */
export function CashflowMatrixTable({
  data,
  isLoading,
}: {
  data?: CashflowMatrix;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-[28rem] w-full rounded-[var(--card-radius)]" />;
  if (!data || data.months.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No transactions yet. Record income, expenses and investments to build your cash-flow history.
      </Card>
    );
  }

  const { months, expense, income, investment, baseCurrency } = data;
  const columns = buildColumns(months);
  const n = months.length;

  const expenseTotal = totalsOf(expense, n);
  const incomeTotal = totalsOf(income, n);
  const investmentTotal = totalsOf(investment, n);
  const balance = incomeTotal.map((inc, i) => inc - expenseTotal[i] - investmentTotal[i]);
  const saved = balance.map((v, i) => v + investmentTotal[i]);
  // Savings rate per column counts both net savings and invested capital.
  const savingsRate = (column: Column) => {
    const inc = cellValue(incomeTotal, column);
    return inc === 0 ? null : (cellValue(saved, column) / inc) * 100;
  };

  const isSummary = (c: Column) => c.kind !== "month";

  /** Header cells, one per column, with a year-summary tint. */
  const head = (
    <thead>
      <tr className="bg-card text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <th className={cn(CAT, "z-30 border-b border-r border-border bg-card")}>Category</th>
        {columns.map((c, i) => (
          <th
            key={i}
            className={cn(
              MONTH,
              "border-b border-border font-mono",
              isSummary(c) && SUMMARY,
              isSummary(c) && "font-bold text-foreground",
            )}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );

  /** A colored band row introducing a section (full-width cell, so it never scrolls). */
  const bandRow = (label: string, tone: string) => (
    <tr>
      <td colSpan={1 + columns.length} className={cn("border-y border-border p-0", tone)}>
        <div className="sticky left-0 inline-flex items-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </div>
      </td>
    </tr>
  );

  /** A category row: label + one numeric cell per column. */
  const categoryRow = (row: CashflowMatrix["expense"][number]) => (
    <tr key={row.id} className="border-t border-border hover:bg-muted/30">
      <td className={cn(CAT, "border-r border-border bg-card font-medium")}>{row.label}</td>
      {columns.map((c, i) => (
        <td key={i} className={cn(MONTH, isSummary(c) && SUMMARY)}>
          <Amount value={cellValue(row.values, c)} />
        </td>
      ))}
    </tr>
  );

  /** A bold totals row. The sticky label and month cells keep an opaque bg-card so
   *  scrolling cells never bleed through the pinned first column. */
  const totalRow = (label: string, values: number[], text: string) => (
    <tr className="border-t-2 border-border font-semibold">
      <td className={cn(CAT, "border-r border-border bg-muted", text)}>{label}</td>
      {columns.map((c, i) => (
        <td key={i} className={cn(MONTH, "font-mono", text, isSummary(c) ? SUMMARY : "bg-muted")}>
          <Amount value={cellValue(values, c)} />
        </td>
      ))}
    </tr>
  );

  return (
    <Card className="animate-fu overflow-hidden p-0">
      <div className="border-b border-border px-6 py-5">
        <div className="font-display text-[17px] font-semibold tracking-tight">Cash-flow matrix</div>
        <div className="mt-0.5 text-sm text-muted-foreground">
          Every category&apos;s income, spending and investing per month, with yearly averages and totals ({baseCurrency})
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
          {head}
          <tbody>
            {bandRow("Expenses", "bg-negative/12 text-negative")}
            {expense.map(categoryRow)}
            {totalRow("Total expenses", expenseTotal, "text-negative")}

            {bandRow("Income", "bg-positive/12 text-positive")}
            {income.map(categoryRow)}
            {totalRow("Total income", incomeTotal, "text-positive")}

            {bandRow("Investments", "bg-accent-gold/12 text-accent-gold")}
            {investment.map(categoryRow)}
            {totalRow("Total investments", investmentTotal, "text-accent-gold")}

            {bandRow("Balance", "bg-sidebar text-sidebar-accent-foreground")}
            {/* Balance total row (ink, like the net-worth row on the asset matrix). */}
            <tr className="font-semibold text-sidebar-accent-foreground">
              <td className={cn(CAT, "border-t-2 border-sidebar bg-sidebar")}>Balance</td>
              {columns.map((c, i) => {
                const v = cellValue(balance, c);
                return (
                  <td
                    key={i}
                    className={cn(
                      MONTH,
                      "border-t-2 border-sidebar bg-sidebar font-mono",
                      isSummary(c) && "font-semibold",
                      v < 0 ? "text-negative" : "text-primary",
                    )}
                  >
                    <PrivateNumber text={formatNumber(v, 0)} />
                  </td>
                );
              })}
            </tr>

            {/* Savings-rate row (heatmap, like P/L on the asset matrix). */}
            <tr className="border-t border-border text-xs italic">
              <td className={cn(CAT, "border-r border-border bg-card font-medium not-italic")}>
                Savings rate
              </td>
              {columns.map((c, i) => {
                const v = savingsRate(c);
                const intensity = v == null ? null : (6 + Math.min(1, Math.abs(v) / 60) * 30).toFixed(1);
                const tint =
                  v == null
                    ? undefined
                    : `color-mix(in srgb, var(${v >= 0 ? "--positive" : "--negative"}) ${intensity}%, transparent)`;
                return (
                  <td
                    key={i}
                    style={tint ? { backgroundColor: tint } : undefined}
                    className={cn(
                      MONTH,
                      "font-mono font-semibold not-italic",
                      v == null ? "text-muted-foreground" : v < 0 ? "text-negative" : "text-positive",
                    )}
                  >
                    {v == null ? "—" : formatPercent(v)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
