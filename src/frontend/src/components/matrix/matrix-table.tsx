"use client";

import { Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PrivateNumber } from "@/components/private-number";
import { cn } from "@/lib/utils";
import { formatMoney, formatNumber, formatPercent, monthLabel } from "@/lib/format";
import type { AssetMatrix } from "@/hooks/use-asset-matrix";

// Sticky left columns: Asset (0) · Value (12rem) · MoM (19rem) · YTD (24.5rem). Month columns scroll.
const ASSET = "sticky left-0 z-20 w-48 min-w-48 px-4 py-2.5 text-left";
const VALUE = "sticky left-48 z-20 w-28 min-w-28 px-3.5 py-2.5 text-right";
const DELTA = "sticky left-[19rem] z-20 w-[5.5rem] min-w-[5.5rem] px-3 py-2.5 text-right";
const YTD_COL = "sticky left-[24.5rem] z-20 w-24 min-w-24 px-3.5 py-2.5 text-right";
const MONTH = "w-[5.75rem] min-w-[5.75rem] px-3 py-2.5 text-right";
const SPAN = 4; // sticky columns before the month columns

// Current column / Value highlight tint.
const CURRENT = "bg-accent";
const CURRENT_BORDER = "border-primary/25";

/** Percentage change of the last value vs the previous one (null when undefined). */
function lastDelta(values: (number | null)[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const prev = values[n - 2];
  const cur = values[n - 1];
  if (prev == null || cur == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Percentage change from the first to last available value in a period. */
function periodDelta(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2 || nums[0] === 0) return null;
  return ((nums[nums.length - 1] - nums[0]) / Math.abs(nums[0])) * 100;
}

// Trend sparkline parked for now; YTD % is easier to scan in the sticky column.
/*
function Sparkline({ values }: { values: (number | null)[] }) {
  const pointsWithIndex = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value != null);
  if (pointsWithIndex.length < 2) return <span className="text-muted-foreground">—</span>;

  const nums = pointsWithIndex.map((point) => point.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const points = pointsWithIndex
    .map(({ value, index }) => {
      const x = (index / (values.length - 1 || 1)) * 88;
      const y = 26 - ((value - min) / range) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = nums[nums.length - 1] >= nums[0];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 88 30"
      preserveAspectRatio="none"
      className={cn("ml-auto block h-[22px] w-[88px] overflow-visible", up ? "text-positive" : "text-negative")}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
*/

/** A signed delta figure, dimmed when undefined. */
function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-mono", value < 0 ? "text-negative" : "text-positive")}>
      {formatPercent(value)}
    </span>
  );
}

/** A private monetary figure, dimmed when zero/blank. */
function Money({ value, currency }: { value: number | null; currency: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <PrivateNumber
      text={formatMoney(value, currency)}
      className={cn("font-mono", value === 0 && "text-muted-foreground")}
    />
  );
}

/** Renders the wide net-worth matrix: assets (rows) × month boundaries (columns). */
export function MatrixTable({ data, isLoading }: { data?: AssetMatrix; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-[28rem] w-full rounded-[var(--card-radius)]" />;
  if (!data || data.months.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No snapshots yet. Record balances and prices to build your history.
      </Card>
    );
  }

  const { months, groups, summary, fx, netWorthOther, baseCurrency } = data;

  // Trend sparklines cover year-to-date only: from the first month of the latest year.
  const currentYear = new Date(months[months.length - 1]).getFullYear();
  const ytdStart = Math.max(
    0,
    months.findIndex((m) => new Date(m).getFullYear() === currentYear),
  );
  const ytd = <T,>(values: T[]) => values.slice(ytdStart);

  /** A muted band row that introduces a section (sticky label, optional total). */
  const bandRow = (label: string, total?: string) => (
    <tr>
      <td
        colSpan={SPAN + months.length}
        className="border-y border-border bg-muted/70 p-0"
      >
        <div className="sticky left-0 inline-flex items-center gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
          {total ? (
            <span className="font-mono text-[11px] font-medium normal-case tracking-normal text-muted-foreground">
              {total}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );

  /** Column headers shared by both tables. */
  const head = (valueLabel: string) => (
    <thead>
      <tr className="bg-card text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <th className={cn(ASSET, "z-30 border-b border-r border-border bg-card")}>Asset</th>
        <th className={cn(VALUE, "z-30 border-b border-r", CURRENT_BORDER, CURRENT, "text-accent-foreground")}>
          {valueLabel}
        </th>
        <th className={cn(DELTA, "z-30 border-b border-r border-border bg-card")}>MoM %</th>
        <th className={cn(YTD_COL, "z-30 border-b border-r border-border bg-card text-right")}>YTD %</th>
        {months.map((m, i) => (
          <th
            key={m}
            className={cn(MONTH, "border-b border-border font-mono", i === months.length - 1 && CURRENT)}
          >
            {monthLabel(m)}
          </th>
        ))}
      </tr>
    </thead>
  );

  /** A non-monetary series row (FX rates, net worth in other currencies). */
  const seriesRow = (row: AssetMatrix["fx"][number], bold = false) => {
    const fmt = (v: number | null) => (v == null ? "—" : formatNumber(v, row.digits));
    return (
      <tr key={row.label} className="border-t border-border hover:bg-muted/30">
        <td className={cn(ASSET, "border-r border-border bg-card font-medium", bold && "font-semibold")}>
          {row.label}
        </td>
        <td className={cn(VALUE, "border-r font-mono", CURRENT_BORDER, CURRENT)}>{fmt(row.current)}</td>
        <td className={cn(DELTA, "border-r border-border bg-card")}>
          <Delta value={lastDelta(row.values)} />
        </td>
        <td className={cn(YTD_COL, "border-r border-border bg-card")}>
          <Delta value={periodDelta(ytd(row.values))} />
        </td>
        {row.values.map((v, i) => (
          <td
            key={i}
            className={cn(MONTH, "font-mono", i === months.length - 1 && CURRENT)}
          >
            {v == null ? <span className="text-muted-foreground">—</span> : formatNumber(v, row.digits)}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Asset matrix */}
      <Card className="animate-fu overflow-hidden p-0">
        <div className="border-b border-border px-6 py-5">
          <div className="font-display text-[17px] font-semibold tracking-tight">Asset matrix</div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            Each asset&apos;s value at monthly boundary dates
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
            {head("Value")}
            <tbody>
              {groups.map((group) => {
                const total = group.rows.reduce((acc, r) => acc + r.current, 0);
                const signed = group.category === "Debts" ? -total : total;
                return (
                  <Fragment key={group.category}>
                    {bandRow(
                      group.category,
                      `${group.rows.length} pos · ${formatMoney(signed, baseCurrency)}`,
                    )}
                    {group.rows.map((row) => (
                      <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                        <td className={cn(ASSET, "border-r border-border bg-card font-medium")}>
                          {row.label}
                        </td>
                        <td className={cn(VALUE, "border-r", CURRENT_BORDER, CURRENT)}>
                          <Money value={row.current} currency={baseCurrency} />
                        </td>
                        <td className={cn(DELTA, "border-r border-border bg-card")}>
                          <Delta value={lastDelta(row.values)} />
                        </td>
                        <td className={cn(YTD_COL, "border-r border-border bg-card")}>
                          <Delta value={periodDelta(ytd(row.values))} />
                        </td>
                        {row.values.map((v, i) => (
                          <td key={i} className={cn(MONTH, i === months.length - 1 && CURRENT)}>
                            <Money value={v} currency={baseCurrency} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}

              {/* Net worth total row (ink). */}
              <tr className="font-semibold text-sidebar-accent-foreground">
                <td className={cn(ASSET, "border-t-2 border-sidebar bg-sidebar")}>
                  Net Worth ({baseCurrency})
                </td>
                <td className={cn(VALUE, "border-t-2 border-sidebar bg-sidebar-accent font-mono text-primary")}>
                  <PrivateNumber text={formatMoney(summary.netWorthCurrent, baseCurrency)} />
                </td>
                <td className={cn(DELTA, "border-t-2 border-sidebar bg-sidebar")}>
                  <Delta value={summary.plPct[summary.plPct.length - 1] ?? null} />
                </td>
                <td className={cn(YTD_COL, "border-t-2 border-sidebar bg-sidebar")}>
                  <Delta value={periodDelta(ytd(summary.netWorth))} />
                </td>
                {summary.netWorth.map((v, i) => (
                  <td
                    key={i}
                    className={cn(MONTH, "border-t-2 border-sidebar bg-sidebar font-mono")}
                  >
                    <PrivateNumber text={formatMoney(v, baseCurrency)} />
                  </td>
                ))}
              </tr>

              {/* P/L % m/m row (heatmap). */}
              <tr className="border-t border-border text-xs italic">
                <td className={cn(ASSET, "border-r border-border bg-card not-italic font-medium")}>
                  P/L % m/m
                </td>
                <td className={cn(VALUE, "border-r border-border bg-card")} />
                <td className={cn(DELTA, "border-r border-border bg-card")} />
                <td className={cn(YTD_COL, "border-r border-border bg-card")} />
                {summary.plPct.map((v, i) => {
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

      {/* FX & multi-currency net worth */}
      {(fx.length > 0 || netWorthOther.length > 0) && (
        <Card className="animate-fu overflow-hidden p-0">
          <div className="border-b border-border px-6 py-4">
            <div className="font-display text-base font-semibold tracking-tight">
              Exchange rates & net worth in other currencies
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              Monthly closing rates and converted net worth
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
              {head("Today")}
              <tbody>
                {fx.length > 0 && (
                  <>
                    {bandRow("Exchange rates")}
                    {fx.map((row) => seriesRow(row))}
                  </>
                )}
                {netWorthOther.length > 0 && (
                  <>
                    {bandRow("Net worth in other currencies")}
                    {netWorthOther.map((row) => seriesRow(row, true))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
