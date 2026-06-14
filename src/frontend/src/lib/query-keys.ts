import type { TransactionFilters } from "@/hooks/use-expenses";

// Centralized query keys for cache reads and invalidation.
export const queryKeys = {
  dashboard: ["dashboard"] as const,
  settings: ["settings"] as const,
  accounts: ["accounts"] as const,
  categories: (kind?: string) => (kind ? (["categories", kind] as const) : (["categories"] as const)),
  expenses: (filters?: TransactionFilters) => ["expenses", filters ?? {}] as const,
  tickers: ["tickers"] as const,
  holdings: ["holdings"] as const,
  cronJobs: ["cron", "jobs"] as const,
  cronRuns: ["cron", "runs"] as const,
};
