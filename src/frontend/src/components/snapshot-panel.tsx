"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyAmount } from "@/components/money-amount";
import { usePrivacyMode } from "@/components/privacy-mode";
import { shortDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SnapshotRow {
  id: string;
  name: string;
  type: string;
  note?: string | null;
  currency: string;
  value: number;
}

export interface SnapshotHistoryPoint {
  date: string;
  total: number;
}

/**
 * Generic "editable balances + dated snapshot + history chart" panel. Used for
 * both Liquidity (cash accounts) and Debts so the two share an identical layout.
 * Emits `{ id, value, note }[]` on snapshot; the caller maps to its own entry shape.
 */
export function SnapshotPanel({
  title,
  subtitle,
  totalLabel,
  rows,
  isLoading,
  emptyText,
  negative = false,
  addAction,
  rowAction,
  submitting,
  onCreate,
  history,
  historyTitle,
  historySubtitle,
  currency,
}: {
  title: string;
  subtitle: string;
  totalLabel: string;
  rows: SnapshotRow[];
  isLoading?: boolean;
  emptyText: string;
  negative?: boolean;
  addAction?: ReactNode;
  rowAction?: (row: SnapshotRow) => ReactNode;
  submitting: boolean;
  onCreate: (date: string, entries: { id: string; value: number; note: string | null }[]) => void;
  history: SnapshotHistoryPoint[];
  historyTitle: string;
  historySubtitle: string;
  currency: string;
}) {
  const [date, setDate] = useState(todayISO());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { shouldHidePrivateNumbers } = usePrivacyMode();

  const valueOf = (id: string, fallback: number) =>
    drafts[id] !== undefined ? drafts[id] : String(fallback);
  const total = rows.reduce((s, r) => s + Number(valueOf(r.id, r.value) || 0), 0);

  /** Creates a dated snapshot from the current draft row values. */
  function submit() {
    if (rows.length === 0) {
      toast.error("Nothing to snapshot yet");
      return;
    }
    const entries = rows.map((r) => {
      const note = (r.note ?? "").trim();
      return {
        id: r.id,
        value: Number(valueOf(r.id, r.value) || 0),
        note: note.length > 0 ? note : null,
      };
    });
    onCreate(date, entries);
    setDrafts({});
  }

  const spark = useMemo(() => history.slice(-12), [history]);
  const max = Math.max(1, ...spark.map((p) => p.total));
  const min = Math.min(...spark.map((p) => p.total), 0);
  const points =
    spark.length > 1
      ? spark
          .map((p, i) => {
            const x = (i / (spark.length - 1)) * 300;
            const y = 54 - ((p.total - min) / (max - min || 1)) * 48;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")
      : "";

  return (
    <>
      <Card className={cn("col-span-12 gap-0 p-5 animate-fu lg:col-span-7")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-base font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{totalLabel}</p>
            <p
              className={cn(
                "font-mono text-xl font-semibold tabular-nums",
                negative && "text-negative",
              )}
            >
              {negative ? "−" : ""}
              <MoneyAmount value={total} currency={currency} />
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{emptyText}</p>
              {addAction}
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 last:border-b-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent font-display text-xs font-semibold text-accent-foreground">
                  {r.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  {r.note ? (
                    <p className="truncate text-xs text-muted-foreground">{r.note}</p>
                  ) : null}
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <span className="font-mono text-xs text-muted-foreground">{r.currency}</span>
                  <Input
                    type={shouldHidePrivateNumbers ? "password" : "number"}
                    inputMode="decimal"
                    step="0.01"
                    value={valueOf(r.id, r.value)}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    className="h-9 w-full text-right font-mono sm:w-28"
                  />
                  {rowAction?.(r)}
                </div>
              </div>
            ))
          )}
        </div>

        {addAction && rows.length > 0 ? <div className="mt-3">{addAction}</div> : null}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-40"
          />
          <Button onClick={submit} disabled={submitting || rows.length === 0}>
            <Plus data-icon="inline-start" />
            Create snapshot
          </Button>
        </div>
      </Card>

      <Card className="col-span-12 gap-0 border-0 bg-sidebar p-5 text-sidebar-accent-foreground shadow-card ring-0 animate-fu lg:col-span-5">
        <p className="font-display text-base font-semibold text-white">{historyTitle}</p>
        <p className="mt-0.5 text-xs text-sidebar-foreground">{historySubtitle}</p>
        {points ? (
          <svg viewBox="0 0 300 60" className="mt-3 h-14 w-full overflow-visible">
            <polyline
              points={points}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        <div className="mt-3">
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-sidebar-foreground">No snapshots yet.</p>
          ) : (
            [...history]
              .reverse()
              .slice(0, 5)
              .map((s) => (
                <div
                  key={s.date}
                  className="flex items-center justify-between border-b border-[#2C2D22] py-2.5 last:border-b-0"
                >
                  <span className="text-sm font-semibold text-[#F4F2EA]">{shortDate(s.date)}</span>
                  <span className="font-mono text-sm font-semibold text-white tabular-nums">
                    {negative ? "−" : ""}
                    <MoneyAmount value={s.total} currency={currency} />
                  </span>
                </div>
              ))
          )}
        </div>
      </Card>
    </>
  );
}
