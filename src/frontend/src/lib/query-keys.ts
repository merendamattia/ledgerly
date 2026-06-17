import type { TransactionFilters } from "@/hooks/use-expenses";

// Centralized query keys for cache reads and invalidation.
export const queryKeys = {
  dashboard: ["dashboard"] as const,
  netWorthHistory: ["dashboard", "networth-history"] as const,
  settings: ["settings"] as const,
  accounts: ["accounts"] as const,
  categories: (kind?: string) => (kind ? (["categories", kind] as const) : (["categories"] as const)),
  expenses: (filters?: TransactionFilters) => ["expenses", filters ?? {}] as const,
  tickers: ["tickers"] as const,
  tickerSearch: (q: string, type?: string) => ["tickers", "search", q, type ?? ""] as const,
  holdings: ["holdings"] as const,
  investmentHistory: ["holdings", "history"] as const,
  investmentBenchmark: ["holdings", "benchmark"] as const,
  investmentReturns: ["holdings", "returns"] as const,
  investmentTransactions: (filters?: Record<string, unknown>) =>
    ["investment-transactions", filters ?? {}] as const,
  debts: ["debts"] as const,
  debtSnapshots: ["debts", "snapshots"] as const,
  cashSnapshots: ["accounts", "snapshots"] as const,
  cronJobs: ["cron", "jobs"] as const,
  cronRuns: ["cron", "runs"] as const,
  databaseTables: ["database", "tables"] as const,
  databaseTable: (
    table: string,
    params: { search?: string; limit: number; offset: number },
  ) => ["database", "table", table, params] as const,
};
