"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";
import { usePrivateNumberFormatter } from "@/components/private-number";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MoneyAmount } from "@/components/money-amount";
import {
  useRebalanceGroups,
  useCreateRebalanceGroup,
  useUpdateRebalanceGroup,
  useDeleteRebalanceGroup,
  type RebalanceGroup,
} from "@/hooks/use-rebalance";
import type { DashboardData } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

type Holding = DashboardData["netWorth"]["holdings"][number];

const TILE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

interface Row {
  key: string;
  name: string;
  detail: string; // symbol(s) under the name
  group: RebalanceGroup | null; // null → unconfigured holding
  tickerIds: string[];
  value: number;
  currentPct: number;
  targetPct: number | null;
  targetValue: number | null;
  deltaPct: number | null;
  action: "BUY" | "SELL" | null;
}

/**
 * Rebalancing card: one row per configured asset group (or ungrouped holding),
 * comparing current vs target allocation. A BUY/SELL action shows when the
 * delta exceeds the group's threshold.
 */
export function RebalanceCard({
  holdings,
  currency,
  className,
}: {
  holdings: Holding[];
  currency: string;
  className?: string;
}) {
  const groups = useRebalanceGroups();
  const [editing, setEditing] = useState<RebalanceGroup | null>(null);
  const [creating, setCreating] = useState<{ tickerIds: string[] } | null>(null);

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.value, 0), [holdings]);

  const rows = useMemo<Row[]>(() => {
    const byTicker = new Map<string, Holding[]>();
    for (const h of holdings) {
      byTicker.set(h.tickerId, [...(byTicker.get(h.tickerId) ?? []), h]);
    }
    const grouped = new Set<string>();
    const out: Row[] = [];

    for (const g of groups.data ?? []) {
      const members = g.tickerIds.flatMap((id) => byTicker.get(id) ?? []);
      for (const id of g.tickerIds) grouped.add(id);
      const value = members.reduce((s, h) => s + h.value, 0);
      const currentPct = totalValue > 0 ? (value / totalValue) * 100 : 0;
      const deltaPct = currentPct - g.targetPct;
      out.push({
        key: g.id,
        name: g.name,
        detail: members.map((h) => h.symbol).join(" · ") || `${g.tickerIds.length} assets`,
        group: g,
        tickerIds: g.tickerIds,
        value,
        currentPct,
        targetPct: g.targetPct,
        targetValue: (g.targetPct / 100) * totalValue,
        deltaPct,
        action:
          Math.abs(deltaPct) >= g.thresholdPct ? (deltaPct > 0 ? "SELL" : "BUY") : null,
      });
    }

    for (const h of holdings) {
      if (grouped.has(h.tickerId) || h.value <= 0) continue;
      out.push({
        key: h.holdingId,
        name: h.name,
        detail: h.symbol,
        group: null,
        tickerIds: [h.tickerId],
        value: h.value,
        currentPct: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
        targetPct: null,
        targetValue: null,
        deltaPct: null,
        action: null,
      });
    }

    return out.sort((a, b) => b.value - a.value);
  }, [groups.data, holdings, totalValue]);

  const totals = useMemo(
    () => ({
      target: rows.reduce((s, r) => s + (r.targetPct ?? 0), 0),
      current: rows.reduce((s, r) => s + r.currentPct, 0),
      value: rows.reduce((s, r) => s + r.value, 0),
      targetValue: rows.reduce((s, r) => s + (r.targetValue ?? 0), 0),
    }),
    [rows],
  );

  const cellHead =
    "whitespace-nowrap px-0.5 pb-2.5 text-right text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:px-2.5 sm:text-[11px] sm:tracking-wider";
  const cell =
    "whitespace-nowrap border-t px-0.5 py-3 text-right font-mono text-[11px] tabular-nums sm:px-2.5 sm:text-xs";

  return (
    <Card className={cn("gap-0 p-5 animate-fu", className)}>
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold">Rebalancing</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Keep the portfolio in line with the target allocation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreating({ tickerIds: [] })}>
          <Plus data-icon="inline-start" />
          Group
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No positions yet — record a buy first.
        </p>
      ) : (
        <>
        <CurrentSplitDonut rows={rows} currency={currency} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse sm:min-w-[520px]">
            <thead>
              <tr>
                <th className={cn(cellHead, "px-0 text-left")}>Asset</th>
                <th className={cellHead}>Target</th>
                <th className={cellHead}>Current</th>
                <th className={cn(cellHead, "hidden sm:table-cell")}>Value</th>
                <th className={cn(cellHead, "hidden sm:table-cell")}>Target val.</th>
                <th className={cellHead}>Delta</th>
                <th className={cellHead}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="group/row hover:bg-muted/50">
                  <td className={cn(cell, "px-0 text-left font-sans")}>
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 text-left sm:gap-2.5"
                      onClick={() =>
                        r.group ? setEditing(r.group) : setCreating({ tickerIds: r.tickerIds })
                      }
                    >
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-lg font-display text-[10px] font-semibold text-white sm:size-7"
                        style={{ background: TILE_COLORS[i % TILE_COLORS.length] }}
                      >
                        {r.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[92px] truncate text-xs font-medium sm:max-w-[190px] sm:text-[13px]">
                          {r.name}
                        </span>
                        <span className="block max-w-[92px] truncate font-mono text-[10px] text-muted-foreground tabular-nums sm:max-w-[190px] sm:text-[10.5px]">
                          {r.detail}
                        </span>
                      </span>
                      <Pencil className="hidden size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 sm:block" />
                    </button>
                  </td>
                  <td className={cn(cell, "text-muted-foreground")}>
                    {r.targetPct != null ? `${r.targetPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={cn(cell, "font-semibold")}>{r.currentPct.toFixed(1)}%</td>
                  <td className={cn(cell, "hidden sm:table-cell")}>
                    <MoneyAmount value={r.value} currency={currency} />
                  </td>
                  <td className={cn(cell, "hidden text-muted-foreground sm:table-cell")}>
                    {r.targetValue != null ? (
                      <MoneyAmount value={r.targetValue} currency={currency} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={cn(
                      cell,
                      "font-semibold",
                      r.deltaPct == null
                        ? "text-muted-foreground"
                        : r.deltaPct >= 0
                          ? "text-positive"
                          : "text-negative",
                    )}
                  >
                    {r.deltaPct != null
                      ? `${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className={cell}>
                    {r.action ? (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider sm:px-2 sm:text-[10.5px]",
                          r.action === "SELL"
                            ? "bg-negative/10 text-negative"
                            : "bg-positive/10 text-positive",
                        )}
                      >
                        {r.action}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td className={cn(cell, "border-t-2 border-foreground/20 px-0 text-left font-display text-[13px] font-bold")}>
                  Total
                </td>
                <td className={cn(cell, "border-t-2 border-foreground/20 font-bold")}>
                  {totals.target.toFixed(1)}%
                </td>
                <td className={cn(cell, "border-t-2 border-foreground/20 font-bold")}>
                  {totals.current.toFixed(1)}%
                </td>
                <td className={cn(cell, "hidden border-t-2 border-foreground/20 font-bold sm:table-cell")}>
                  <MoneyAmount value={totals.value} currency={currency} />
                </td>
                <td className={cn(cell, "hidden border-t-2 border-foreground/20 font-bold sm:table-cell")}>
                  <MoneyAmount value={totals.targetValue} currency={currency} />
                </td>
                <td className={cn(cell, "border-t-2 border-foreground/20")} colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
        </>
      )}

      {totals.target > 0 && Math.round(totals.target * 10) !== 1000 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Targets add up to {totals.target.toFixed(1)}% — adjust them to reach 100%.
        </p>
      ) : null}

      {creating ? (
        <RebalanceGroupDialog
          holdings={holdings}
          initialTickerIds={creating.tickerIds}
          open
          onOpenChange={(o) => {
            if (!o) setCreating(null);
          }}
        />
      ) : null}
      {editing ? (
        <RebalanceGroupDialog
          holdings={holdings}
          group={editing}
          open
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
        />
      ) : null}
    </Card>
  );
}

/**
 * Compact donut of the current allocation split, colored to match the table
 * row tiles, with a small current-vs-target legend beside it.
 */
function CurrentSplitDonut({ rows, currency }: { rows: Row[]; currency: string }) {
  const { privateText } = usePrivateNumberFormatter();
  const data = rows
    .filter((r) => r.value > 0)
    .map((r, i) => ({ key: r.key, name: r.name, value: r.value, fill: TILE_COLORS[i % TILE_COLORS.length] }));
  if (data.length === 0) return null;
  const chartConfig = Object.fromEntries(
    data.map((d) => [d.key, { label: d.name, color: d.fill }]),
  ) satisfies ChartConfig;
  const total = data.reduce((s, d) => s + d.value, 0);

  // flex-1 + h-full let the donut absorb the card's spare height (the pillars
  // card usually sets the row height), so the table stays pinned at the bottom.
  return (
    <div className="mb-3 flex flex-1 items-center justify-center gap-x-4 py-1 sm:gap-x-10">
      <ChartContainer
        config={chartConfig}
        className="aspect-square h-[130px] shrink-0 sm:h-full sm:max-h-[300px] sm:min-h-[170px]"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent formatter={(v) => privateText(formatMoney(Number(v), currency))} />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="95%"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="grid min-w-0 shrink grid-cols-[auto_auto_auto_auto] content-center items-center gap-x-2 gap-y-2.5 text-[11px] sm:gap-x-3 sm:text-xs">
        {data.map((d) => {
          const row = rows.find((r) => r.key === d.key);
          return (
            <Fragment key={d.key}>
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: d.fill }} />
              <span className="max-w-[88px] truncate sm:max-w-[150px]">{d.name}</span>
              <span className="text-right font-mono font-semibold tabular-nums">
                {total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0"}%
              </span>
              <span className="text-right font-mono text-muted-foreground tabular-nums">
                {row?.targetPct != null ? `→ ${row.targetPct.toFixed(1)}%` : "—"}
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Create/edit dialog for a rebalance group: pick the assets it aggregates and
 * set the target allocation plus the delta threshold that triggers an action.
 */
function RebalanceGroupDialog({
  holdings,
  group,
  initialTickerIds = [],
  open,
  onOpenChange,
}: {
  holdings: Holding[];
  group?: RebalanceGroup;
  initialTickerIds?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = group != null;
  const single = initialTickerIds.length === 1 && !editing;
  const initialName = single
    ? (holdings.find((h) => h.tickerId === initialTickerIds[0])?.name ?? "")
    : "";
  const [name, setName] = useState(group?.name ?? initialName);
  const [tickerIds, setTickerIds] = useState<string[]>(group?.tickerIds ?? initialTickerIds);
  const [target, setTarget] = useState(group ? String(group.targetPct) : "");
  const [threshold, setThreshold] = useState(group ? String(group.thresholdPct) : "5");
  const create = useCreateRebalanceGroup();
  const update = useUpdateRebalanceGroup();
  const del = useDeleteRebalanceGroup();
  const pending = create.isPending || update.isPending;

  // Tickers already claimed by another group can't be picked twice.
  const groups = useRebalanceGroups();
  const takenElsewhere = useMemo(() => {
    const taken = new Set<string>();
    for (const g of groups.data ?? []) {
      if (g.id === group?.id) continue;
      for (const id of g.tickerIds) taken.add(id);
    }
    return taken;
  }, [groups.data, group?.id]);

  const uniqueHoldings = useMemo(() => {
    const seen = new Set<string>();
    return holdings.filter((h) => !seen.has(h.tickerId) && seen.add(h.tickerId));
  }, [holdings]);

  function toggle(tickerId: string) {
    setTickerIds((ids) =>
      ids.includes(tickerId) ? ids.filter((i) => i !== tickerId) : [...ids, tickerId],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      targetPct: Number(target),
      thresholdPct: Number(threshold),
      tickerIds,
    };
    const opts = {
      onSuccess: () => {
        toast.success(editing ? "Group updated" : "Target set");
        onOpenChange(false);
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (editing) update.mutate({ id: group.id, ...payload }, opts);
    else create.mutate(payload, opts);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit rebalance group" : "New rebalance group"}</DialogTitle>
          <DialogDescription>
            Group one or more assets, then set the target weight and the delta that triggers a
            buy/sell action.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rb-name">Name</FieldLabel>
              <Input
                id="rb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. World ETFs"
                required
              />
            </Field>
            <Field>
              <FieldLabel>Assets</FieldLabel>
              <div className="flex max-h-44 flex-col overflow-auto rounded-lg border">
                {uniqueHoldings.map((h) => {
                  const checked = tickerIds.includes(h.tickerId);
                  const disabled = takenElsewhere.has(h.tickerId);
                  return (
                    <button
                      key={h.tickerId}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(h.tickerId)}
                      className={cn(
                        "flex items-center gap-2.5 border-b px-3 py-2 text-left text-sm last:border-b-0",
                        disabled ? "opacity-40" : "hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border text-[10px] text-primary-foreground",
                          checked && "border-foreground bg-foreground",
                        )}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{h.name}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {h.symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
              <FieldDescription>
                {tickerIds.length > 1
                  ? "These assets are summed and rebalanced as one."
                  : "Pick more than one asset to treat them as a single position."}
                {takenElsewhere.size > 0 ? " Assets in another group are disabled." : ""}
              </FieldDescription>
            </Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field>
                <FieldLabel htmlFor="rb-target">Target %</FieldLabel>
                <Input
                  id="rb-target"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rb-threshold">Action threshold %</FieldLabel>
                <Input
                  id="rb-threshold"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                />
              </Field>
            </div>
            <FieldDescription>
              Buy/sell shows once the current weight drifts from the target by at least the
              threshold.
            </FieldDescription>
            <DialogFooter className="flex-row items-center justify-between sm:justify-between">
              {editing ? (
                <ConfirmDialog
                  title="Remove target?"
                  description={`"${group.name}" goes back to an unconfigured row.`}
                  confirmLabel="Remove"
                  onConfirm={() =>
                    del.mutate(group.id, {
                      onSuccess: () => {
                        toast.success("Group removed");
                        onOpenChange(false);
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                  trigger={
                    <Button type="button" variant="ghost" className="text-negative">
                      <Trash2 data-icon="inline-start" />
                      Remove
                    </Button>
                  }
                />
              ) : (
                <span />
              )}
              <Button type="submit" disabled={pending || tickerIds.length === 0}>
                {editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
