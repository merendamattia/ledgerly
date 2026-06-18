"use client";

import { useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { MoneyAmount } from "@/components/money-amount";
import { CategoryIcon, CategoryBadge } from "@/components/category-badge";
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog";
import { InvestmentTxDialog } from "@/components/investment-tx-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearch } from "@/components/search-context";
import { useSettings } from "@/hooks/use-settings";
import {
  useExpenses,
  type Transaction,
  type TransactionFilters,
} from "@/hooks/use-expenses";
import {
  useInvestmentTransactions,
  type InvestmentTransaction,
} from "@/hooks/use-investments";
import { useCategories } from "@/hooks/use-categories";
import { formatMoney, numericDate, INVESTMENT_SIDE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

// The "Investments" filter is shown for parity with the design; investment
// movements (buy/sell) are not yet recorded as transactions, so it yields none.
type Filter = "ALL" | "INCOME" | "EXPENSE" | "INVESTMENT";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
  { value: "INVESTMENT", label: "Investments" },
];

// Desktop: a ledger-style CSS grid. Below md each row collapses to a stacked
// card (description + amount on top, date / category beneath).
const GRID_COLS = "grid-cols-[78px_minmax(0,1.6fr)_140px_120px]";
const ROW_DESKTOP = cn("hidden items-center px-5 py-3.5 text-sm md:grid", GRID_COLS);
const ROW_MOBILE = "flex items-center gap-3 px-4 py-3 md:hidden";

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [month, setMonth] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [invTx, setInvTx] = useState<InvestmentTransaction | null>(null);

  const { query } = useSearch();
  const settings = useSettings();
  const currency = settings.data?.baseCurrency ?? "EUR";

  // Last 12 months plus "All time" for the period pill.
  const monthOptions = useMemo(() => {
    const opts = [{ value: "all", label: "All time" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      });
    }
    return opts;
  }, []);
  const monthItems = Object.fromEntries(monthOptions.map((o) => [o.value, o.label]));

  const range = useMemo(() => {
    if (month === "all") return { from: undefined, to: undefined };
    const [y, m] = month.split("-").map(Number);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  }, [month]);

  const categoryKind = filter === "INCOME" || filter === "EXPENSE" ? filter : undefined;
  const categories = useCategories(categoryKind, categoryKind !== undefined);
  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...(categories.data ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories.data],
  );
  const categoryItems = useMemo(
    () => Object.fromEntries(categoryOptions.map((o) => [o.value, o.label])),
    [categoryOptions],
  );

  const filters: TransactionFilters = {
    direction: filter === "INCOME" || filter === "EXPENSE" ? filter : undefined,
    from: range.from,
    to: range.to,
    categoryId:
      filter === "INCOME" || filter === "EXPENSE"
        ? categoryId === "all"
          ? undefined
          : categoryId
        : undefined,
    limit,
  };

  const { data, isLoading } = useExpenses(filters);
  const investments = useInvestmentTransactions({ limit: filter === "INVESTMENT" ? limit : 1 });

  const rows = useMemo(() => {
    if (filter === "INVESTMENT") return [];
    const q = query.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter(
      (t) =>
        (t.note ?? "").toLowerCase().includes(q) ||
        (t.category?.name ?? "").toLowerCase().includes(q),
    );
  }, [data, query, filter]);

  const investmentRows = useMemo(() => {
    if (filter !== "INVESTMENT") return [];
    const q = query.trim().toLowerCase();
    const list = investments.data ?? [];
    if (!q) return list;
    return list.filter(
      (t) =>
        (t.ticker?.symbol ?? "").toLowerCase().includes(q) ||
        (t.ticker?.name ?? "").toLowerCase().includes(q),
    );
  }, [investments.data, query, filter]);

  const hasMore = filter !== "INVESTMENT" && !query && !!data && data.length === limit;

  return (
    <div className="flex flex-col gap-5 animate-fu">
      {/* Filter segmented control + period select */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-muted p-0.5 sm:inline-flex">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setFilter(f.value);
                  setCategoryId("all");
                  setLimit(PAGE_SIZE);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {categoryKind ? (
            <Select
              value={categoryId}
              items={categoryItems}
              onValueChange={(v) => {
                setCategoryId(v ?? "all");
                setLimit(PAGE_SIZE);
              }}
            >
              <SelectTrigger className="w-full bg-card sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={month}
            items={monthItems}
            onValueChange={(v) => {
              setMonth(v ?? "all");
              setCategoryId("all");
              setLimit(PAGE_SIZE);
            }}
          >
            <SelectTrigger className="w-full gap-2 bg-card sm:w-auto">
              <Calendar className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-[var(--card-radius)] border bg-card shadow-card">
        <div
          className={cn(
            ROW_DESKTOP,
            "border-b bg-[#FCFBF7] py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
          )}
        >
          <span>Date</span>
          <span>Description</span>
          <span>Category</span>
          <span className="text-right">Amount</span>
        </div>

        {filter === "INVESTMENT" ? (
          investments.isLoading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : investmentRows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No investment movements yet.
            </div>
          ) : (
            investmentRows.map((t) => {
              const gross = t.quantity * t.price;
              const signed = t.side === "BUY" ? -(gross + t.fee) : gross - t.fee;
              const tile = (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent font-display text-[11px] font-semibold text-accent-foreground">
                  {(t.ticker?.symbol ?? "?").slice(0, 2).toUpperCase()}
                </span>
              );
              const amount = (
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    signed >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {signed >= 0 ? "+" : ""}
                  {formatMoney(signed, t.ticker?.currency ?? currency)}
                </span>
              );
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInvTx(t)}
                  className="block w-full border-b border-background text-left transition-colors last:border-b-0 hover:bg-muted/50"
                >
                  <div className={ROW_DESKTOP}>
                    <span className="font-mono text-xs text-muted-foreground">{numericDate(t.date)}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      {tile}
                      <span className="truncate font-medium">
                        {INVESTMENT_SIDE_LABELS[t.side]} {t.ticker?.symbol ?? ""}
                      </span>
                    </span>
                    <span>
                      <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                        Investment
                      </span>
                    </span>
                    <span className="text-right">{amount}</span>
                  </div>
                  <div className={ROW_MOBILE}>
                    {tile}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {INVESTMENT_SIDE_LABELS[t.side]} {t.ticker?.symbol ?? ""}
                        </span>
                        {amount}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{numericDate(t.date)}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{t.ticker?.name ?? "Investment"}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )
        ) : isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No transactions for this filter.
          </div>
        ) : (
          rows.map((t) => {
            const signed = t.direction === "EXPENSE" ? -t.amount : t.amount;
            const amount = (
              <MoneyAmount
                value={signed}
                currency={currency}
                colored
                signed
                className="font-mono font-semibold"
              />
            );
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailTx(t)}
                className="block w-full border-b border-background text-left transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className={ROW_DESKTOP}>
                  <span className="font-mono text-xs text-muted-foreground">{numericDate(t.date)}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <CategoryIcon name={t.category?.name} />
                    <span className="truncate font-medium">
                      {t.note || t.category?.name || "Transaction"}
                    </span>
                  </span>
                  <span>
                    <CategoryBadge name={t.category?.name} />
                  </span>
                  <span className="text-right">{amount}</span>
                </div>
                <div className={ROW_MOBILE}>
                  <CategoryIcon name={t.category?.name} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {t.note || t.category?.name || "Transaction"}
                      </span>
                      {amount}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{numericDate(t.date)}</span>
                      <span aria-hidden>·</span>
                      <CategoryBadge name={t.category?.name} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}

      <TransactionDetailDialog
        transaction={detailTx}
        open={detailTx !== null}
        onOpenChange={(o) => {
          if (!o) setDetailTx(null);
        }}
        currency={currency}
      />

      <InvestmentTxDialog
        tx={invTx}
        open={invTx !== null}
        onOpenChange={(o) => {
          if (!o) setInvTx(null);
        }}
      />
    </div>
  );
}
