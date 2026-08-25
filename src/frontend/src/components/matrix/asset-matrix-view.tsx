"use client";

import { Download, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrivateNumber } from "@/components/private-number";
import { MatrixTable } from "@/components/matrix/matrix-table";
import { useAssetMatrix, type AssetMatrix } from "@/hooks/use-asset-matrix";
import { formatMoney, formatPercent, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { currentPeriodDelta } from "./matrix-delta";

/** Serializes the matrix to CSV and triggers a client-side download. */
function downloadCsv(data: AssetMatrix) {
  const esc = (v: unknown) => {
    const raw = String(v ?? "");
    const safe = typeof v === "string" && /^[=+\-@]/.test(raw) ? `\t${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows: (string | number)[][] = [["Asset", "Value", ...data.months.map(monthLabel)]];
  for (const g of data.groups) {
    rows.push([g.category]);
    for (const r of g.rows) rows.push([r.label, r.current, ...r.values]);
  }
  rows.push(["Net Worth", data.summary.netWorthCurrent, ...data.summary.netWorth]);
  rows.push(["P/L % m/m", "", ...data.summary.plPct.map((v) => (v == null ? "" : v))]);
  for (const r of [...data.fx, ...data.netWorthOther]) {
    rows.push([r.label, r.current ?? "", ...r.values.map((v) => (v == null ? "" : v))]);
  }
  const csv = rows.map((row) => row.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "asset-matrix.csv";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Percentage + absolute net-worth change over the trailing `months` entries. */
function trailingChange(series: number[], months: number) {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const first = series[Math.max(0, series.length - 1 - months)];
  if (first === 0) return null;
  return { pct: ((last - first) / Math.abs(first)) * 100, abs: last - first };
}

/** Wide net-worth matrix: every asset's value across monthly snapshots. */
export function AssetMatrixView() {
  const { data, isLoading, isError, error } = useAssetMatrix();

  const base = data?.baseCurrency ?? "EUR";
  const lastDelta = data
    ? currentPeriodDelta(data.summary.netWorthCurrent, data.summary.netWorth, data.months, "month")
    : null;
  const yearChange = data ? trailingChange(data.summary.netWorth, 12) : null;
  const assetCount = data ? data.groups.reduce((acc, g) => acc + g.rows.length, 0) : null;
  const groupCount = data?.groups.length ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary ribbon */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="gap-0 border-0 bg-sidebar p-5 text-sidebar-accent-foreground">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-sidebar-foreground">
              Net worth
            </span>
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Live
            </span>
          </div>
          <div className="mt-2.5 font-mono text-2xl font-semibold tracking-tight">
            {data ? <PrivateNumber text={formatMoney(data.summary.netWorthCurrent, base)} /> : "—"}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span
              className={cn(
                "font-mono font-semibold",
                lastDelta == null ? "text-sidebar-foreground" : lastDelta < 0 ? "text-negative" : "text-primary",
              )}
            >
              {lastDelta == null ? "—" : formatPercent(lastDelta)}
            </span>
            <span className="text-sidebar-foreground">vs last month</span>
          </div>
        </Card>

        <Card className="gap-0 p-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">12-month change</span>
          <div
            className={cn(
              "mt-2.5 font-mono text-2xl font-semibold tracking-tight",
              yearChange && yearChange.pct < 0 ? "text-negative" : "text-positive",
            )}
          >
            {yearChange ? formatPercent(yearChange.pct) : "—"}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {yearChange ? <PrivateNumber text={formatMoney(yearChange.abs, base)} /> : "—"}
            </span>
            in absolute terms
          </div>
        </Card>

        <Card className="gap-0 p-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">Assets tracked</span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
              {assetCount ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {groupCount == null ? "classes" : `in ${groupCount} classes`}
            </span>
          </div>
          {data && data.months.length > 0 ? (
            <div className="mt-1.5 text-xs text-muted-foreground">
              Monthly snapshots since {monthLabel(data.months[0])}
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
          <AlertTitle>Asset matrix unavailable</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Unable to load the asset matrix."}
          </AlertDescription>
        </Alert>
      ) : (
        <MatrixTable data={data} isLoading={isLoading} />
      )}

      {/* Footer hint */}
      {!isError ? (
        <div className="flex flex-wrap items-center justify-between gap-4 px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <Info className="size-3.5" />
            Scroll horizontally to see older snapshots. The first four columns stay fixed.
          </span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-positive/30" />
              P/L positive
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-negative/30" />
              P/L negative
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
