"use client";

import { useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { MoneyAmount } from "@/components/money-amount";
import { CategoryIcon, CategoryBadge } from "@/components/category-badge";
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog";
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

const GRID = "grid grid-cols-[78px_minmax(0,1.5fr)_130px_140px_120px] items-center";

// Short month-day label for the date column, e.g. "13 Jun".
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
    new Date(iso),
  );
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [month, setMonth] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

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

  const filters: TransactionFilters = {
    direction: filter === "INCOME" || filter === "EXPENSE" ? filter : undefined,
    from: range.from,
    to: range.to,
    limit,
  };

  const { data, isLoading } = useExpenses(filters);

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

  const hasMore = filter !== "INVESTMENT" && !query && !!data && data.length === limit;

  return (
    <div className="flex flex-col gap-5 animate-fu">
      {/* Filter chips + period pill */}
      <div className="flex flex-wrap items-center gap-2.5">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setFilter(f.value);
                setLimit(PAGE_SIZE);
              }}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "border bg-card text-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          );
        })}

        <div className="ml-auto">
          <Select value={month} items={monthItems} onValueChange={(v) => setMonth(v ?? "all")}>
            <SelectTrigger className="h-10 gap-2 rounded-xl border bg-card">
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
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div
          className={cn(
            GRID,
            "border-b bg-[#FCFBF7] px-6 py-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
          )}
        >
          <span>Date</span>
          <span>Description</span>
          <span>Category</span>
          <span>Account</span>
          <span className="text-right">Amount</span>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {filter === "INVESTMENT"
              ? "No investment movements yet."
              : "No transactions for this filter."}
          </div>
        ) : (
          rows.map((t) => {
            const signed = t.direction === "EXPENSE" ? -t.amount : t.amount;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailTx(t)}
                className={cn(
                  GRID,
                  "w-full border-b border-background px-6 py-4 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50",
                )}
              >
                <span className="font-mono text-xs text-muted-foreground">{shortDate(t.date)}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <CategoryIcon name={t.category?.name} />
                  <span className="truncate font-medium">
                    {t.note || t.category?.name || "Transaction"}
                  </span>
                </span>
                <span>
                  <CategoryBadge name={t.category?.name} />
                </span>
                <span className="truncate text-muted-foreground">—</span>
                <MoneyAmount
                  value={signed}
                  currency={currency}
                  colored
                  signed
                  className="text-right font-mono font-semibold"
                />
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
    </div>
  );
}
