import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Filters supported by the expenses query and all transaction list cache keys.
 */
export interface TransactionFilters {
  search?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  direction?: "INCOME" | "EXPENSE";
  limit?: number;
  offset?: number;
}

/**
 * Centralized query keys for cache reads and invalidation.
 */
export const queryKeys = {
  dashboard: ["dashboard"] as const,
  netWorthHistory: ["dashboard", "networth-history"] as const,
  assetMatrix: ["dashboard", "asset-matrix"] as const,
  assetReturnMatrix: ["dashboard", "asset-return-matrix"] as const,
  cashflowMatrix: ["dashboard", "cashflow-matrix"] as const,
  settings: ["settings"] as const,
  integrationToken: ["integrations", "token"] as const,
  notifications: ["notifications"] as const,
  pushNotifications: ["notifications", "push"] as const,
  users: ["users"] as const,
  accounts: ["accounts"] as const,
  categories: (kind?: string) => (kind ? (["categories", kind] as const) : (["categories"] as const)),
  expensesRoot: ["expenses"] as const,
  expenses: (filters?: TransactionFilters) => [...queryKeys.expensesRoot, filters ?? {}] as const,
  expenseSummary: (filters?: Omit<TransactionFilters, "limit" | "offset">) =>
    [...queryKeys.expensesRoot, "summary", filters ?? {}] as const,
  expenseTags: (filters?: Pick<TransactionFilters, "from" | "to" | "categoryId" | "direction">) =>
    [...queryKeys.expensesRoot, "tags", filters ?? {}] as const,
  recurringExpenses: ["recurring-expenses"] as const,
  tickers: ["tickers"] as const,
  tickerSearch: (q: string, type?: string) => ["tickers", "search", q, type ?? ""] as const,
  holdings: ["holdings"] as const,
  investmentHistory: ["holdings", "history"] as const,
  investmentTransactionsRoot: ["investment-transactions"] as const,
  investmentTransactions: (filters?: Record<string, unknown>) =>
    [...queryKeys.investmentTransactionsRoot, filters ?? {}] as const,
  rebalanceGroups: ["rebalance-groups"] as const,
  pillars: ["pillars"] as const,
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

/**
 * Invalidates a group of Ledgerly query keys without forcing mutation handlers
 * to duplicate React Query boilerplate.
 */
export function invalidateLedgerQueries(queryClient: QueryClient, keys: readonly QueryKey[]) {
  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/** Removes personal query and mutation state before an account identity changes. */
export function clearLedgerQueryCache(queryClient: QueryClient) {
  queryClient.clear();
}
