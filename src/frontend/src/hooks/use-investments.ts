import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type Ticker = InferResponseType<typeof api.tickers.$get, 200>[number];
export type Holding = InferResponseType<typeof api.holdings.$get, 200>[number];
export type AddAssetInput = InferRequestType<typeof api.tickers.$post>["json"];
export type CreateHoldingInput = InferRequestType<typeof api.holdings.$post>["json"];
type UpdateHoldingInput = InferRequestType<(typeof api.holdings)[":id"]["$put"]>["json"];

export type SearchCandidate = InferResponseType<typeof api.tickers.search.$get, 200>[number];
export type InvestmentTransaction = InferResponseType<
  (typeof api)["investment-transactions"]["$get"],
  200
>[number];
export type CreateInvestmentTxInput = InferRequestType<
  (typeof api)["investment-transactions"]["$post"]
>["json"];
export type UpdateInvestmentTxInput = InferRequestType<
  (typeof api)["investment-transactions"][":id"]["$put"]
>["json"];

// --- Tickers ----------------------------------------------------------------
/**
 * Loads all tracked market instruments and manually-priced assets.
 */
export function useTickers() {
  return useQuery({
    queryKey: queryKeys.tickers,
    queryFn: async () => unwrap<Ticker[]>(await api.tickers.$get()),
  });
}

/**
 * Adds a provider-backed asset and refreshes ticker plus cron-run visibility.
 */
export function useAddAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: AddAssetInput) => unwrap<Ticker>(await api.tickers.$post({ json })),
    onSuccess: () => invalidateLedgerQueries(qc, [queryKeys.tickers, queryKeys.cronRuns]),
  });
}

export type AddManualAssetInput = InferRequestType<typeof api.tickers.manual.$post>["json"];
export type SetManualPriceInput = InferRequestType<
  (typeof api.tickers)[":id"]["price"]["$post"]
>["json"];

/** Add a manually-valued asset (bond/commodity Yahoo can't price). */
export function useAddManualAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: AddManualAssetInput) =>
      unwrap<Ticker>(await api.tickers.manual.$post({ json })),
    onSuccess: () => invalidateLedgerQueries(qc, [queryKeys.tickers, queryKeys.dashboard]),
  });
}

/** Set/update the current price of a manually-valued asset. */
export function useSetManualPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...json }: SetManualPriceInput & { id: string }) =>
      unwrap<{ ok: boolean }>(await api.tickers[":id"].price.$post({ param: { id }, json })),
    onSuccess: () => invalidateLedgerQueries(qc, [queryKeys.dashboard, queryKeys.holdings]),
  });
}

/**
 * Deletes an unused ticker and refreshes the tracked instrument list.
 */
export function useDeleteTicker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.tickers[":id"].$delete({ param: { id } })),
    onSuccess: () => invalidateLedgerQueries(qc, [queryKeys.tickers]),
  });
}

// --- Instrument search ------------------------------------------------------
/**
 * Searches provider instruments; callers should debounce the query text.
 */
export function useTickerSearch(query: string, type?: "EQUITY" | "ETF" | "CRYPTO") {
  return useQuery({
    queryKey: queryKeys.tickerSearch(query, type),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
    queryFn: async () =>
      unwrap<SearchCandidate[]>(
        await api.tickers.search.$get({ query: { q: query.trim(), ...(type ? { type } : {}) } }),
      ),
  });
}

// --- Investment transactions (buy/sell ledger) ------------------------------
/**
 * Loads investment buy/sell movements, optionally scoped to a ticker or limit.
 */
export function useInvestmentTransactions(
  filters: { tickerId?: string; limit?: number } = {},
  options: { enabled?: boolean } = {},
) {
  const query: Record<string, string> = {};
  if (filters.tickerId) query.tickerId = filters.tickerId;
  if (filters.limit != null) query.limit = String(filters.limit);
  return useQuery({
    queryKey: queryKeys.investmentTransactions(filters),
    enabled: options.enabled ?? true,
    queryFn: async () =>
      unwrap<InvestmentTransaction[]>(
        await api["investment-transactions"].$get({ query }),
      ),
  });
}

/**
 * Returns the standard invalidation callback for investment movement mutations.
 */
function useInvalidateInvestmentTx() {
  const qc = useQueryClient();
  return () =>
    invalidateLedgerQueries(qc, [
      queryKeys.investmentTransactionsRoot,
      queryKeys.holdings,
      queryKeys.investmentHistory,
      queryKeys.dashboard,
    ]);
}

/**
 * Creates an investment movement and refreshes portfolio-derived views.
 */
export function useCreateInvestmentTx() {
  const invalidate = useInvalidateInvestmentTx();
  return useMutation({
    mutationFn: async (json: CreateInvestmentTxInput) =>
      unwrap<InvestmentTransaction>(await api["investment-transactions"].$post({ json })),
    onSuccess: invalidate,
  });
}

/**
 * Updates an investment movement and refreshes portfolio-derived views.
 */
export function useUpdateInvestmentTx() {
  const invalidate = useInvalidateInvestmentTx();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateInvestmentTxInput & { id: string }) =>
      unwrap<InvestmentTransaction>(
        await api["investment-transactions"][":id"].$put({ param: { id }, json }),
      ),
    onSuccess: invalidate,
  });
}

/**
 * Deletes an investment movement and refreshes portfolio-derived views.
 */
export function useDeleteInvestmentTx() {
  const invalidate = useInvalidateInvestmentTx();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(
        await api["investment-transactions"][":id"].$delete({ param: { id } }),
      ),
    onSuccess: invalidate,
  });
}

// --- Holdings ---------------------------------------------------------------
/**
 * Loads current portfolio holdings and their latest computed values.
 */
export function useHoldings() {
  return useQuery({
    queryKey: queryKeys.holdings,
    queryFn: async () => unwrap<Holding[]>(await api.holdings.$get()),
  });
}

export type PortfolioPoint = InferResponseType<typeof api.holdings.history.$get, 200>[number];

/** Daily portfolio value over time (from the first buy), for the portfolio chart. */
export function useInvestmentHistory() {
  return useQuery({
    queryKey: queryKeys.investmentHistory,
    queryFn: async () => unwrap<PortfolioPoint[]>(await api.holdings.history.$get()),
  });
}

/**
 * Returns the standard invalidation callback for holding mutations.
 */
function useInvalidateHoldings() {
  const qc = useQueryClient();
  return () => invalidateLedgerQueries(qc, [queryKeys.holdings, queryKeys.dashboard]);
}

/**
 * Creates a holding and refreshes holding-dependent dashboard data.
 */
export function useCreateHolding() {
  const invalidate = useInvalidateHoldings();
  return useMutation({
    mutationFn: async (json: CreateHoldingInput) =>
      unwrap<Holding>(await api.holdings.$post({ json })),
    onSuccess: invalidate,
  });
}

/**
 * Updates a holding and refreshes holding-dependent dashboard data.
 */
export function useUpdateHolding() {
  const invalidate = useInvalidateHoldings();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateHoldingInput & { id: string }) =>
      unwrap<Holding>(await api.holdings[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

/**
 * Deletes a holding and refreshes holding-dependent dashboard data.
 */
export function useDeleteHolding() {
  const invalidate = useInvalidateHoldings();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.holdings[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}
