"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { MoneyAmount } from "@/components/money-amount";
import { usePillars, useUpsertPillar, type Pillar } from "@/hooks/use-rebalance";
import { useAccounts, type Account } from "@/hooks/use-accounts";
import type { DashboardData } from "@/hooks/use-dashboard";
import { CASH_CATEGORY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

type Holding = DashboardData["netWorth"]["holdings"][number];

const PILLAR_COLORS = ["var(--chart-3)", "var(--chart-4)", "var(--chart-6)", "var(--chart-1)"];
const DEFAULT_NAMES = ["Liquidity", "Income", "Stability", "Growth"];

interface MemberValue {
  key: string;
  name: string;
  value: number;
}

/** Resolves a pillar's members to named base-currency values. */
function memberValues(
  pillar: Pillar,
  accountsById: Map<string, Account>,
  holdingsByTicker: Map<string, Holding[]>,
): MemberValue[] {
  const out: MemberValue[] = [];
  for (const m of pillar.members) {
    if (m.cashAccountId) {
      const a = accountsById.get(m.cashAccountId);
      // ponytail: account balance used as-is (no FX) — convert if non-base accounts show up
      if (a) out.push({ key: m.cashAccountId, name: a.name, value: a.balance });
    } else if (m.tickerId) {
      const hs = holdingsByTicker.get(m.tickerId) ?? [];
      const first = hs[0];
      if (first) {
        out.push({
          key: m.tickerId,
          name: first.name,
          value: hs.reduce((s, h) => s + h.value, 0),
        });
      }
    }
  }
  return out.sort((a, b) => b.value - a.value);
}

/**
 * "Your 4 pillars" card: four named macro-buckets of accounts and assets, each
 * with its total, share, and a per-member breakdown.
 */
export function PillarsCard({
  holdings,
  currency,
  className,
}: {
  holdings: Holding[];
  currency: string;
  className?: string;
}) {
  const pillars = usePillars();
  const accounts = useAccounts();
  const [configuring, setConfiguring] = useState<number | null>(null);

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const holdingsByTicker = useMemo(() => {
    const map = new Map<string, Holding[]>();
    for (const h of holdings) map.set(h.tickerId, [...(map.get(h.tickerId) ?? []), h]);
    return map;
  }, [holdings]);

  const byPosition = useMemo(
    () => new Map((pillars.data ?? []).map((p) => [p.position, p])),
    [pillars.data],
  );

  const slots = useMemo(() => {
    return [1, 2, 3, 4].map((position) => {
      const pillar = byPosition.get(position) ?? null;
      const members = pillar ? memberValues(pillar, accountsById, holdingsByTicker) : [];
      return { position, pillar, members, total: members.reduce((s, m) => s + m.value, 0) };
    });
  }, [byPosition, accountsById, holdingsByTicker]);

  const grandTotal = useMemo(() => slots.reduce((s, p) => s + p.total, 0), [slots]);

  return (
    <Card className={cn("gap-0 p-5 animate-fu", className)}>
      <div className="mb-4">
        <p className="font-display text-base font-semibold">Your 4 pillars</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A balanced approach across four investment pillars
        </p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3.5 sm:grid-cols-2">
        {slots.map(({ position, pillar, members, total }) => (
          <div
            key={position}
            className="flex flex-col rounded-xl border bg-muted/30 px-4 py-3.5"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex size-5.5 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold text-white"
                style={{ background: PILLAR_COLORS[position - 1] }}
              >
                {position}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold">
                {pillar?.name ?? `Pillar ${position}`}
              </span>
              {pillar ? (
                <>
                  <MoneyAmount
                    value={total}
                    currency={currency}
                    className="font-mono text-[13px] font-semibold"
                  />
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground tabular-nums">
                    {grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : "0.0"}%
                  </span>
                </>
              ) : null}
            </div>

            {pillar ? (
              <>
                <div className="flex flex-col gap-2.5">
                  {members.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">No members yet.</p>
                  ) : (
                    members.slice(0, 4).map((m) => (
                      <div key={m.key}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-xs font-medium">{m.name}</span>
                          <MoneyAmount
                            value={m.value}
                            currency={currency}
                            className="shrink-0 font-mono text-[11px] text-muted-foreground"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full animate-grow"
                              style={{
                                width: `${total > 0 ? (m.value / total) * 100 : 0}%`,
                                background: PILLAR_COLORS[position - 1],
                              }}
                            />
                          </div>
                          <span className="min-w-7 text-right font-mono text-[10.5px] text-muted-foreground tabular-nums">
                            {total > 0 ? Math.round((m.value / total) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  {members.length > 4 ? (
                    <p className="text-[11px] text-muted-foreground">
                      +{members.length - 4} more
                    </p>
                  ) : null}
                </div>
                <div className="mt-auto pt-2.5">
                  <button
                    type="button"
                    onClick={() => setConfiguring(position)}
                    className="text-xs font-semibold text-positive hover:underline"
                  >
                    See details →
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-start justify-center gap-2 py-3">
                <p className="text-xs text-muted-foreground">
                  Group accounts and assets into this pillar.
                </p>
                <Button variant="outline" size="sm" onClick={() => setConfiguring(position)}>
                  Set up
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {configuring != null ? (
        <PillarDialog
          position={configuring}
          pillar={byPosition.get(configuring) ?? null}
          accounts={accounts.data ?? []}
          holdings={holdings}
          holdingsByTicker={holdingsByTicker}
          takenBy={pillars.data ?? []}
          currency={currency}
          open
          onOpenChange={(o) => {
            if (!o) setConfiguring(null);
          }}
        />
      ) : null}
    </Card>
  );
}

type Selection = { cashAccountId?: string; tickerId?: string };

/**
 * Config dialog for one pillar: rename it and pick which cash accounts,
 * credits, other assets and investments it groups.
 */
function PillarDialog({
  position,
  pillar,
  accounts,
  holdings,
  holdingsByTicker,
  takenBy,
  currency,
  open,
  onOpenChange,
}: {
  position: number;
  pillar: Pillar | null;
  accounts: Account[];
  holdings: Holding[];
  holdingsByTicker: Map<string, Holding[]>;
  takenBy: Pillar[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(pillar?.name ?? DEFAULT_NAMES[position - 1]);
  const [selected, setSelected] = useState<Selection[]>(
    (pillar?.members ?? []).map((m) =>
      m.cashAccountId ? { cashAccountId: m.cashAccountId } : { tickerId: m.tickerId ?? "" },
    ),
  );
  const upsert = useUpsertPillar();

  // Members claimed by another pillar are disabled to avoid double counting.
  const taken = useMemo(() => {
    const t = { accounts: new Set<string>(), tickers: new Set<string>() };
    for (const p of takenBy) {
      if (p.position === position) continue;
      for (const m of p.members) {
        if (m.cashAccountId) t.accounts.add(m.cashAccountId);
        if (m.tickerId) t.tickers.add(m.tickerId);
      }
    }
    return t;
  }, [takenBy, position]);

  const uniqueHoldings = useMemo(() => {
    const seen = new Set<string>();
    return holdings.filter((h) => !seen.has(h.tickerId) && seen.add(h.tickerId));
  }, [holdings]);

  const isAccountSelected = (id: string) => selected.some((s) => s.cashAccountId === id);
  const isTickerSelected = (id: string) => selected.some((s) => s.tickerId === id);

  function toggleAccount(id: string) {
    setSelected((sel) =>
      isAccountSelected(id) ? sel.filter((s) => s.cashAccountId !== id) : [...sel, { cashAccountId: id }],
    );
  }
  function toggleTicker(id: string) {
    setSelected((sel) =>
      isTickerSelected(id) ? sel.filter((s) => s.tickerId !== id) : [...sel, { tickerId: id }],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    upsert.mutate(
      { position, name, members: selected },
      {
        onSuccess: () => {
          toast.success("Pillar saved");
          onOpenChange(false);
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  }

  const rowClass = (checked: boolean, disabled: boolean) =>
    cn(
      "flex items-center gap-2.5 border-b px-3 py-2 text-left text-sm last:border-b-0",
      disabled ? "opacity-40" : "hover:bg-muted/60",
      checked && "bg-muted/40",
    );
  const check = (checked: boolean) => (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border text-[10px] text-primary-foreground",
        checked && "border-foreground bg-foreground",
      )}
    >
      {checked ? "✓" : ""}
    </span>
  );

  const nonBrokerAccounts = accounts.filter((a) => a.type !== "BROKER");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pillar {position}</DialogTitle>
          <DialogDescription>
            Name this pillar and pick the accounts and assets it groups.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pillar-name">Name</FieldLabel>
              <Input
                id="pillar-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={DEFAULT_NAMES[position - 1]}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Investments</FieldLabel>
              <div className="flex max-h-40 flex-col overflow-auto rounded-lg border">
                {uniqueHoldings.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">No positions yet.</p>
                ) : (
                  uniqueHoldings.map((h) => {
                    const checked = isTickerSelected(h.tickerId);
                    const disabled = taken.tickers.has(h.tickerId);
                    const value = (holdingsByTicker.get(h.tickerId) ?? []).reduce(
                      (s, x) => s + x.value,
                      0,
                    );
                    return (
                      <button
                        key={h.tickerId}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleTicker(h.tickerId)}
                        className={rowClass(checked, disabled)}
                      >
                        {check(checked)}
                        <span className="min-w-0 flex-1 truncate">{h.name}</span>
                        <MoneyAmount
                          value={value}
                          currency={currency}
                          className="font-mono text-xs text-muted-foreground"
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel>Accounts</FieldLabel>
              <div className="flex max-h-40 flex-col overflow-auto rounded-lg border">
                {nonBrokerAccounts.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">No accounts yet.</p>
                ) : (
                  nonBrokerAccounts.map((a) => {
                    const checked = isAccountSelected(a.id);
                    const disabled = taken.accounts.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleAccount(a.id)}
                        className={rowClass(checked, disabled)}
                      >
                        {check(checked)}
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {CASH_CATEGORY_LABELS[a.category] ?? a.category}
                        </span>
                        <MoneyAmount
                          value={a.balance}
                          currency={a.currency}
                          className="font-mono text-xs text-muted-foreground"
                        />
                      </button>
                    );
                  })
                )}
              </div>
              <FieldDescription>
                Items already in another pillar are disabled — each item counts once.
              </FieldDescription>
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={upsert.isPending}>
                Save pillar
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
