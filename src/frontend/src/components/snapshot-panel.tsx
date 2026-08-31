"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyAmount } from "@/components/money-amount";
import {
  ACCOUNT_BALANCE_ROW_CLASS,
  ACCOUNT_TILE_CLASS,
  ACCOUNT_TYPE_BADGE_CLASS,
} from "@/components/mobile-account-layout";
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
  headerAction,
  icon: Icon,
  accentClassName,
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
  headerAction?: ReactNode;
  icon: LucideIcon;
  accentClassName: string;
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
    <div className="col-span-12 flex flex-col gap-4 animate-fu">
      {headerAction}

      <Card className="gap-0 overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", accentClassName)}>
              <Icon />
            </span>
            <div className="min-w-0">
              <CardTitle>{title}</CardTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted-foreground sm:text-xs">{totalLabel}</p>
            <p className={cn("font-mono text-base font-semibold tabular-nums sm:text-xl", negative && "text-negative-ink")}>
              {negative ? "−" : ""}
              <MoneyAmount value={total} currency={currency} />
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="col-span-full flex min-h-40 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">{emptyText}</p>
                {addAction}
              </div>
            ) : (
              rows.map((r) => (
                <article
                  key={r.id}
                  className={ACCOUNT_TILE_CLASS}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold", accentClassName)}>
                      {r.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={r.note ?? undefined}>
                        {r.note || r.type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0">{rowAction?.(r)}</div>
                  </div>

                  <div className={ACCOUNT_BALANCE_ROW_CLASS}>
                    <span className={ACCOUNT_TYPE_BADGE_CLASS}>
                      {r.type.replaceAll("_", " ")} · {r.currency}
                    </span>
                    <label className="min-w-0 max-w-full justify-self-end text-right">
                      <span className="block text-[10px] text-muted-foreground">Current balance</span>
                      <Input
                        type={shouldHidePrivateNumbers ? "password" : "number"}
                        inputMode="decimal"
                        step="0.01"
                        value={valueOf(r.id, r.value)}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        aria-label={`${r.name} balance in ${r.currency}`}
                        className="mt-0.5 h-7 w-32 bg-background px-2 text-right font-mono text-sm font-semibold tabular-nums sm:w-36"
                      />
                    </label>
                  </div>
                </article>
              ))
            )}
          </div>
        </CardContent>

        {rows.length > 0 ? (
          <CardFooter className="flex flex-col gap-3 bg-muted/30 sm:flex-row sm:justify-between">
            {addAction}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full bg-background text-foreground sm:h-9 sm:w-40"
              />
              <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
                <Plus data-icon="inline-start" />
                Create snapshot
              </Button>
            </div>
          </CardFooter>
        ) : null}
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <CardHeader className="border-b px-4 py-4 sm:px-5">
          <CardTitle>{historyTitle}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{historySubtitle}</p>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-center">
          {points ? (
            <svg viewBox="0 0 300 60" className="h-20 w-full overflow-visible" aria-label={`${historyTitle} chart`} role="img">
              <polyline
                points={points}
                fill="none"
                stroke={negative ? "var(--negative)" : "var(--positive)"}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <div className="hidden min-h-20 lg:block" />
          )}
          <div>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No snapshots yet.</p>
            ) : (
              [...history]
                .reverse()
                .slice(0, 5)
                .map((s) => (
                  <div key={s.date} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0">
                    <span className="text-sm font-semibold">{shortDate(s.date)}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {negative ? "−" : ""}
                      <MoneyAmount value={s.total} currency={currency} />
                    </span>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
