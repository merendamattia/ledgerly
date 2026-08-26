"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Repeat } from "lucide-react";
import { MoneyAmount } from "@/components/money-amount";
import { StatCard } from "@/components/stat-card";
import { TransactionContentLayout } from "@/components/transaction-content-layout";
import {
  TRANSACTION_FILTERS_CLASS,
  TRANSACTION_FILTER_TAB_CLASS,
} from "@/components/transaction-filter-layout";
import { CategoryIcon } from "@/components/category-badge";
import { TagChips } from "@/components/tag-input";
import { DayGroupedList } from "@/components/day-grouped-list";
import { UpcomingMovement } from "@/components/cashflow/upcoming-movement";
import { RecurringList } from "@/components/recurring-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useCompleteExpenses,
  useExpenseSummary,
  useExpenseTags,
  type Transaction,
  type TransactionFilters,
} from "@/hooks/use-expenses";
import {
  useInvestmentTransactions,
  type InvestmentTransaction,
} from "@/hooks/use-investments";
import { useCategories } from "@/hooks/use-categories";
import { formatMoney, formatMonthYear, INVESTMENT_SIDE_LABELS } from "@/lib/format";
import {
  CUSTOM_TRANSACTION_PERIOD,
  resolveTransactionRange,
  shouldLoadCompleteTransactionResults,
  summarizeTransactionRows,
} from "@/lib/transaction-period";
import { cn } from "@/lib/utils";

const TransactionDetailDialog = dynamic(
  () => import("@/components/transaction-detail-dialog").then((mod) => mod.TransactionDetailDialog),
  { ssr: false },
);
const InvestmentTxDialog = dynamic(
  () => import("@/components/investment-tx-dialog").then((mod) => mod.InvestmentTxDialog),
  { ssr: false },
);

// Keep the initial list useful without making the page unwieldy. "Load more"
// reveals another page.
const PAGE_DESKTOP = 20;
const PAGE_MOBILE = 10;

// The "Investments" filter is shown for parity with the design; investment
// movements (buy/sell) are not yet recorded as transactions, so it yields none.
type Filter = "ALL" | "INCOME" | "EXPENSE" | "INVESTMENT";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
  { value: "INVESTMENT", label: "Investments" },
];

/** Formats a local calendar day for date-only API filters. */
function localISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Renders the transaction activity page with filters, search, and detail dialogs. */
export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [pageSize, setPageSize] = useState(PAGE_DESKTOP);
  const [limit, setLimit] = useState(PAGE_DESKTOP);
  const [showAllTags, setShowAllTags] = useState(false);

  // Track viewport to size the page (lg breakpoint = 1024px); reset the visible
  // window when it changes.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      const size = mq.matches ? PAGE_DESKTOP : PAGE_MOBILE;
      setPageSize(size);
      setLimit(size);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [invTx, setInvTx] = useState<InvestmentTransaction | null>(null);

  const { query, setQuery } = useSearch();
  const settings = useSettings();
  const currency = settings.data?.baseCurrency ?? "EUR";

  // Last 12 months plus "All time" and a custom range for the period control.
  const periodOptions = useMemo(() => {
    const opts = [
      { value: "all", label: "All time" },
      { value: CUSTOM_TRANSACTION_PERIOD, label: "Custom range" },
    ];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: formatMonthYear(d),
      });
    }
    return opts;
  }, []);
  const periodItems = Object.fromEntries(periodOptions.map((o) => [o.value, o.label]));
  const today = localISO(new Date());

  const range = useMemo(
    () => resolveTransactionRange(period, today, customFrom, customTo),
    [customFrom, customTo, period, today],
  );

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

  // A tag search (query starting with "#") fetches the full set for the selected
  // period, so every tagged movement in that period shows (not just the page).
  const tagActive = query.trim().startsWith("#");

  const filters: TransactionFilters = {
    search: query.trim() || undefined,
    direction: filter === "INCOME" || filter === "EXPENSE" ? filter : undefined,
    from: range.from,
    to: range.to,
    categoryId:
      filter === "INCOME" || filter === "EXPENSE"
        ? categoryId === "all"
          ? undefined
          : categoryId
        : undefined,
  };

  const completePeriod = shouldLoadCompleteTransactionResults(period);
  const completeResults = filter !== "INVESTMENT" && (completePeriod || tagActive);
  const paginatedTransactions = useExpenses({ ...filters, limit }, !completeResults);
  const completeTransactions = useCompleteExpenses(filters, completeResults);
  const periodSummary = useExpenseSummary(filters, completePeriod && filter !== "INVESTMENT");
  const data = completeResults ? completeTransactions.data : paginatedTransactions.data;
  const isLoading = completeResults
    ? completeTransactions.isLoading
    : paginatedTransactions.isLoading;

  // Distinct tags within the selected period (most recent first) for the quick
  // filter — so changing the period only surfaces tags from that period.
  const tagSource = useExpenseTags({ from: range.from, to: range.to });
  const allTags = tagSource.data?.tags ?? [];
  const activeTag = tagActive ? query.trim().slice(1).toLowerCase() : null;

  /**
   * Applies a tag filter while preserving the selected period.
   *
   * The transaction type and category filters are reset so both income and
   * expenses tagged with the value are included.
   */
  function applyTag(tag: string) {
    setFilter("ALL");
    setCategoryId("all");
    setQuery(`#${tag}`);
  }
  const investments = useInvestmentTransactions(
    { limit },
    { enabled: filter === "INVESTMENT" },
  );

  const rows = useMemo(() => {
    if (filter === "INVESTMENT") return [];
    return data ?? [];
  }, [data, filter]);

  // Net balance of the currently-shown rows — surfaced when a tag is active so a
  // tag (e.g. a trip city) reads as a single signed total.
  const tagNet = useMemo(() => summarizeTransactionRows(rows).net, [rows]);

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

  const hasMore = !completeResults && filter !== "INVESTMENT" && !!data && data.length === limit;
  const showPeriodSummary = completePeriod && filter !== "INVESTMENT";

  // Keep the open detail dialogs bound to LIVE query data (looked up by id) rather
  // than the snapshot captured on click, so an inline edit (date, amount, …)
  // reflects immediately without closing and reopening the popup. Falls back to
  // the snapshot for a row not in the current page (e.g. an upcoming movement).
  const liveDetailTx = useMemo(
    () => (detailTx ? ((data ?? []).find((t) => t.id === detailTx.id) ?? detailTx) : null),
    [data, detailTx],
  );
  const liveInvTx = useMemo(
    () => (invTx ? ((investments.data ?? []).find((t) => t.id === invTx.id) ?? invTx) : null),
    [investments.data, invTx],
  );

  return (
    <div className="flex min-w-0 flex-col gap-5 animate-fu">
      {/* Filters: full-width top bar */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={TRANSACTION_FILTERS_CLASS}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setFilter(f.value);
                  setCategoryId("all");
                  setLimit(pageSize);
                }}
                className={cn(
                  TRANSACTION_FILTER_TAB_CLASS,
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

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
          {categoryKind ? (
            <Select
              value={categoryId}
              items={categoryItems}
              onValueChange={(v) => {
                setCategoryId(v ?? "all");
                setLimit(pageSize);
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
            value={period}
            items={periodItems}
            onValueChange={(v) => {
              setPeriod(v ?? "all");
              setCategoryId("all");
              setLimit(pageSize);
            }}
          >
            <SelectTrigger className="w-full gap-2 bg-card sm:w-auto">
              <Calendar className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === CUSTOM_TRANSACTION_PERIOD ? (
            <div className="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-input bg-card p-2 sm:w-auto sm:flex-row sm:items-end">
              <label className="flex w-full min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:w-auto">
                From
                <Input
                  type="date"
                  value={customFrom}
                  max={today}
                  aria-label="From date"
                  className="h-8 w-full text-sm sm:w-[140px]"
                  onChange={(event) => {
                    const nextFrom = event.target.value > today ? today : event.target.value;
                    setCustomFrom(nextFrom);
                    if (customTo && nextFrom && nextFrom > customTo) setCustomTo(nextFrom);
                    setLimit(pageSize);
                  }}
                />
              </label>
              <label className="flex w-full min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:w-auto">
                To
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={today}
                  aria-label="To date"
                  className="h-8 w-full text-sm sm:w-[140px]"
                  onChange={(event) => {
                    const nextTo = event.target.value > today ? today : event.target.value;
                    setCustomTo(nextTo);
                    if (customFrom && nextTo && nextTo < customFrom) setCustomFrom(nextTo);
                    setLimit(pageSize);
                  }}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="w-full sm:mb-0.5 sm:w-auto sm:self-end"
                onClick={() => {
                  setPeriod("all");
                  setCustomFrom("");
                  setCustomTo("");
                  setCategoryId("all");
                  setLimit(pageSize);
                }}
              >
                Clear range
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tag quick-filter: click a tag to list every tagged movement in the period. */}
      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Tags</span>
          {(showAllTags ? allTags : allTags.slice(0, 12)).map((tag) => {
            const active = activeTag === tag.toLowerCase();
            return (
              <button
                key={tag.toLowerCase()}
                type="button"
                onClick={() => applyTag(tag)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted",
                )}
              >
                #{tag}
              </button>
            );
          })}
          {allTags.length > 12 ? (
            <button
              type="button"
              onClick={() => setShowAllTags((v) => !v)}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {showAllTags ? "Show less" : `+${allTags.length - 12} more`}
            </button>
          ) : null}
          {tagActive ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <TransactionContentLayout
        summary={
          showPeriodSummary ? (
            <div className="flex flex-col gap-3">
              <StatCard
                label="Total income"
                value={
                  periodSummary.data ? (
                    <MoneyAmount value={periodSummary.data.income} currency={currency} colored />
                  ) : periodSummary.isLoading ? (
                    "Loading…"
                  ) : (
                    "—"
                  )
                }
                accent="positive"
              />
              <StatCard
                label="Total expenses"
                value={
                  periodSummary.data ? (
                    <MoneyAmount value={periodSummary.data.expenses} currency={currency} />
                  ) : periodSummary.isLoading ? (
                    "Loading…"
                  ) : (
                    "—"
                  )
                }
                accent="negative"
              />
              <StatCard
                label="Net balance"
                value={
                  periodSummary.data ? (
                    <MoneyAmount
                      value={periodSummary.data.net}
                      currency={currency}
                      colored
                      signed
                    />
                  ) : periodSummary.isLoading ? (
                    "Loading…"
                  ) : (
                    "—"
                  )
                }
                accent={periodSummary.data && periodSummary.data.net < 0 ? "negative" : "positive"}
              />
            </div>
          ) : null
        }
        sidebar={
          <div className="flex flex-col gap-5">
            {tagActive && activeTag ? (
              <StatCard
                label={`Tag · #${activeTag}`}
                value={<MoneyAmount value={tagNet} currency={currency} colored signed />}
                accent={tagNet < 0 ? "negative" : "positive"}
                delta={{ label: `${rows.length} ${rows.length === 1 ? "movement" : "movements"}` }}
              />
            ) : null}
            <UpcomingMovement currency={currency} onTransactionClick={setDetailTx} />
            <RecurringList currency={currency} />
          </div>
        }
        movements={
          <div className="flex flex-col gap-5">
            {/* Day-grouped movements card */}
            <div className="overflow-hidden rounded-[var(--card-radius)] border bg-card px-5 pt-3 pb-1 shadow-card">
              {filter === "INVESTMENT" ? (
                investments.isLoading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                ) : investmentRows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No investment movements yet.
                  </div>
                ) : (
                  <DayGroupedList
                    items={investmentRows}
                    getKey={(t) => t.id}
                    getDate={(t) => t.date}
                    onItemClick={setInvTx}
                    renderItem={(t) => {
                      const gross = t.quantity * t.price;
                      const signed = t.side === "BUY" ? -(gross + t.fee) : gross - t.fee;
                      return (
                        <>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[11px] font-semibold text-accent-foreground">
                            {(t.ticker?.symbol ?? "?").slice(0, 2).toUpperCase()}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">
                              {INVESTMENT_SIDE_LABELS[t.side]} {t.ticker?.symbol ?? ""}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {t.ticker?.name ?? "Investment"}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 font-mono font-semibold tabular-nums",
                              signed >= 0 ? "text-positive" : "text-negative",
                            )}
                          >
                            {signed >= 0 ? "+" : ""}
                            {formatMoney(signed, t.ticker?.currency ?? currency)}
                          </span>
                        </>
                      );
                    }}
                  />
                )
              ) : isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No transactions for this filter.
                </div>
              ) : (
                <DayGroupedList
                  items={rows}
                  getKey={(t) => t.id}
                  getDate={(t) => t.date}
                  onItemClick={setDetailTx}
                  renderItem={(t) => (
                    <>
                      <CategoryIcon
                        name={t.category?.name}
                        emoji={t.category?.emoji}
                        className="size-9 rounded-full text-lg"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 truncate font-medium capitalize">
                          {t.category?.name || "Transaction"}
                          {t.recurringExpenseId ? (
                            <Repeat
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label="Recurring"
                            />
                          ) : null}
                        </span>
                        {t.note ? (
                          <span className="truncate text-xs text-muted-foreground">{t.note}</span>
                        ) : null}
                        <TagChips note={t.note} onTagClick={(tag) => setQuery(`#${tag}`)} />
                      </div>
                      <MoneyAmount
                        value={t.direction === "EXPENSE" ? -t.amount : t.amount}
                        currency={currency}
                        colored
                        signed
                        className="shrink-0 font-mono font-semibold"
                      />
                    </>
                  )}
                />
              )}
            </div>

            {hasMore ? (
              <div className="flex justify-center">
                <Button onClick={() => setLimit((l) => l + pageSize)}>Load more</Button>
              </div>
            ) : null}
          </div>
        }
      />

      {liveDetailTx ? (
        <TransactionDetailDialog
          transaction={liveDetailTx}
          open
          onOpenChange={(o) => {
            if (!o) setDetailTx(null);
          }}
          currency={currency}
        />
      ) : null}

      {liveInvTx ? (
        <InvestmentTxDialog
          tx={liveInvTx}
          open
          onOpenChange={(o) => {
            if (!o) setInvTx(null);
          }}
        />
      ) : null}
    </div>
  );
}
