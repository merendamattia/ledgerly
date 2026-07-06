"use client";

import { Fragment, useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PrivateNumber } from "@/components/private-number";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { useAssetReturnMatrix, type AssetReturnMatrix } from "@/hooks/use-asset-return-matrix";

const ASSET = "sticky left-0 z-20 w-60 min-w-60 px-3 py-2 text-left";
const TICKER = "sticky left-60 z-20 w-28 min-w-28 px-3 py-2 text-left";
const VALUE = "w-24 min-w-24 px-3 py-2 text-right";

type AssetOption = {
  id: string;
  label: string;
  symbol: string;
  isBtp: boolean;
};

function isBtpAsset(asset: { name: string; symbol: string }) {
  return /\bbtp\b/i.test(`${asset.name} ${asset.symbol}`);
}

function assetOptions(data: AssetReturnMatrix): AssetOption[] {
  const byId = new Map<string, AssetOption>();
  for (const year of data.years) {
    for (const row of year.rows) {
      byId.set(row.id, {
        id: row.id,
        label: row.name,
        symbol: row.symbol,
        isBtp: isBtpAsset(row),
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function previousValue(values: (number | null)[], index: number, start: number | null) {
  if (index === 0) return start;
  for (let i = index - 1; i >= 0; i--) if (values[i] != null) return values[i];
  return start;
}

function valueTone(value: number | null, previous: number | null) {
  if (value == null || previous == null || previous === 0) return "";
  const change = value / previous - 1;
  if (Math.abs(change) < 0.0001) return "";
  const token = change > 0 ? "--positive" : "--negative";
  const intensity = (8 + Math.min(1, Math.abs(change) / 0.15) * 18).toFixed(1);
  return `color-mix(in srgb, var(${token}) ${intensity}%, transparent)`;
}

function textTone(value: number | null, previous: number | null) {
  if (value == null || previous == null || previous === 0) return "";
  const change = value / previous - 1;
  if (Math.abs(change) < 0.0001) return "";
  return change > 0 ? "text-positive" : "text-negative";
}

function ReturnCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-mono font-semibold", value < 0 ? "text-negative" : "text-positive")}>
      {formatPercent(value)}
    </span>
  );
}

function PriceCell({ value, currency }: { value: number | null; currency: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return <PrivateNumber text={formatMoney(value, currency)} className="font-mono" />;
}

function AssetFilterMenu({
  assets,
  selected,
  onChange,
}: {
  assets: AssetOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const shown = selected.size;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted aria-expanded:text-foreground"
          >
            <ListFilter className="size-4 shrink-0" />
            Assets
            <span className="font-mono text-xs text-muted-foreground">
              {shown}/{assets.length}
            </span>
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Visible assets</div>
        <DropdownMenuItem onClick={() => onChange(new Set(assets.map((asset) => asset.id)))}>
          Select all
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onChange(new Set(assets.filter((asset) => !asset.isBtp).map((asset) => asset.id)))}
        >
          Hide BTP
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {assets.map((asset) => (
          <DropdownMenuCheckboxItem
            key={asset.id}
            checked={selected.has(asset.id)}
            onCheckedChange={() => toggle(asset.id)}
            className="py-2"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{asset.symbol}</span>
              <span className="truncate text-xs text-muted-foreground">{asset.label}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReturnMatrixTable({ data }: { data: AssetReturnMatrix }) {
  const assets = useMemo(() => assetOptions(data), [data]);
  const defaultSelected = useMemo(
    () => new Set(assets.filter((asset) => !asset.isBtp).map((asset) => asset.id)),
    [assets],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const selected = selectedIds ?? defaultSelected;
  const filteredData = useMemo(
    () => ({
      ...data,
      years: data.years
        .map((year) => ({
          ...year,
          rows: year.rows.filter((row) => selected.has(row.id)),
        }))
        .filter((year) => year.rows.length > 0),
    }),
    [data, selected],
  );

  return (
    <Card className="animate-fu overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <div className="font-display text-[17px] font-semibold tracking-tight">Asset return matrix</div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            Monthly asset prices and yearly returns from each asset&apos;s first portfolio transaction
          </div>
        </div>
        <AssetFilterMenu assets={assets} selected={selected} onChange={setSelectedIds} />
      </div>

      {filteredData.years.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No assets selected.
        </div>
      ) : (
        <div className="overflow-x-auto bg-background">
          <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
            <tbody>
              {filteredData.years.map((yearBlock, blockIndex) => (
                <Fragment key={yearBlock.year}>
                  {blockIndex > 0 ? (
                    <tr aria-hidden="true">
                      <td colSpan={16} className="h-8 bg-card p-0" />
                    </tr>
                  ) : null}
                  <tr className="bg-muted/80 text-[11px] font-bold uppercase text-foreground">
                    <th className={cn(ASSET, "border-y border-r border-border bg-muted/80")}>Asset</th>
                    <th className={cn(TICKER, "border-y border-r border-border bg-muted/80")}>Ticker</th>
                    <th className={cn(VALUE, "border-y border-r border-border text-foreground")}>
                      {yearBlock.year - 1}
                    </th>
                    {data.monthLabels.map((label) => (
                      <th key={`${yearBlock.year}-${label}`} className={cn(VALUE, "border-y border-r border-border")}>
                        {label}
                      </th>
                    ))}
                    <th className={cn(VALUE, "border-y border-border text-foreground")}>
                      {yearBlock.year}
                    </th>
                  </tr>
                  {yearBlock.rows.map((row, rowIndex) => {
                    const isLastRow = rowIndex === yearBlock.rows.length - 1;
                    const bottomBorder = isLastRow && "border-b border-border";
                    return (
                    <tr key={`${yearBlock.year}-${row.id}`} className="hover:bg-muted/30">
                      <td className={cn(ASSET, "border-r border-border bg-card font-medium", bottomBorder)}>
                        <span className="block truncate">{row.name}</span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {row.type} · from {formatDate(row.firstAdded)}
                        </span>
                      </td>
                      <td className={cn(TICKER, "border-r border-border bg-card font-mono font-medium", bottomBorder)}>
                        {row.symbol}
                      </td>
                      <td className={cn(VALUE, "border-r border-border", bottomBorder)}>
                        <PriceCell value={row.start} currency={row.currency} />
                      </td>
                      {row.months.map((value, index) => (
                        <td
                          key={index}
                          style={{
                            backgroundColor: valueTone(value, previousValue(row.months, index, row.start)),
                          }}
                          className={cn(
                            VALUE,
                            "border-r border-border",
                            textTone(value, previousValue(row.months, index, row.start)),
                            bottomBorder,
                          )}
                        >
                          <PriceCell value={value} currency={row.currency} />
                        </td>
                      ))}
                      <td
                        className={cn(
                          VALUE,
                          "border-border bg-card",
                          row.returnPct != null && (row.returnPct >= 0 ? "bg-positive/10" : "bg-negative/10"),
                          bottomBorder,
                        )}
                      >
                        <ReturnCell value={row.returnPct} />
                      </td>
                    </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Annual return matrix for every currently-held portfolio asset. */
export function AssetReturnMatrixView() {
  const { data, isLoading, isError, error } = useAssetReturnMatrix();

  if (isLoading) return <Skeleton className="h-[28rem] w-full rounded-[var(--card-radius)]" />;

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Asset return matrix unavailable</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Unable to load the asset return matrix."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.years.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No investment prices yet. Add assets and prices to build the return matrix.
      </Card>
    );
  }

  return <ReturnMatrixTable data={data} />;
}
