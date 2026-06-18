import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

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
export function useTickers() {
  return useQuery({
    queryKey: queryKeys.tickers,
    queryFn: async () => unwrap<Ticker[]>(await api.tickers.$get()),
  });
}

export function useAddAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: AddAssetInput) => unwrap<Ticker>(await api.tickers.$post({ json })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tickers });
      qc.invalidateQueries({ queryKey: queryKeys.cronRuns });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tickers });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

/** Set/update the current price of a manually-valued asset. */
export function useSetManualPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...json }: SetManualPriceInput & { id: string }) =>
      unwrap<{ ok: boolean }>(await api.tickers[":id"].price.$post({ param: { id }, json })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.holdings });
    },
  });
}

export function useDeleteTicker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.tickers[":id"].$delete({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tickers }),
  });
}

// --- Instrument search ------------------------------------------------------
/** Debounce should be applied by the caller; query runs only on a non-empty term. */
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
export function useInvestmentTransactions(filters: { tickerId?: string; limit?: number } = {}) {
  const query: Record<string, string> = {};
  if (filters.tickerId) query.tickerId = filters.tickerId;
  if (filters.limit != null) query.limit = String(filters.limit);
  return useQuery({
    queryKey: queryKeys.investmentTransactions(filters),
    queryFn: async () =>
      unwrap<InvestmentTransaction[]>(
        await api["investment-transactions"].$get({ query }),
      ),
  });
}

function useInvalidateInvestmentTx() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["investment-transactions"] });
    qc.invalidateQueries({ queryKey: queryKeys.holdings });
    qc.invalidateQueries({ queryKey: queryKeys.investmentHistory });
    qc.invalidateQueries({ queryKey: queryKeys.investmentBenchmark });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateInvestmentTx() {
  const invalidate = useInvalidateInvestmentTx();
  return useMutation({
    mutationFn: async (json: CreateInvestmentTxInput) =>
      unwrap<InvestmentTransaction>(await api["investment-transactions"].$post({ json })),
    onSuccess: invalidate,
  });
}

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

export type BenchmarkComparison = InferResponseType<typeof api.holdings.benchmark.$get, 200>;

/** Portfolio vs MSCI World (IWDA.AS) rebased index + summary, for the benchmark chart. */
export function useBenchmark() {
  return useQuery({
    queryKey: queryKeys.investmentBenchmark,
    queryFn: async () =>
      unwrap<BenchmarkComparison>(await api.holdings.benchmark.$get()),
  });
}

export type HoldingReturn = InferResponseType<typeof api.holdings.returns.$get, 200>[number];

/** Per-position market return over a window (omit `from` for the Max window). */
export function useHoldingReturns(from?: string) {
  return useQuery({
    queryKey: from ? [...queryKeys.investmentReturns, from] : queryKeys.investmentReturns,
    queryFn: async () =>
      unwrap<HoldingReturn[]>(
        await api.holdings.returns.$get({ query: from ? { from } : {} }),
      ),
  });
}

function useInvalidateHoldings() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.holdings });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateHolding() {
  const invalidate = useInvalidateHoldings();
  return useMutation({
    mutationFn: async (json: CreateHoldingInput) =>
      unwrap<Holding>(await api.holdings.$post({ json })),
    onSuccess: invalidate,
  });
}

export function useUpdateHolding() {
  const invalidate = useInvalidateHoldings();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateHoldingInput & { id: string }) =>
      unwrap<Holding>(await api.holdings[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

export function useDeleteHolding() {
  const invalidate = useInvalidateHoldings();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.holdings[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}
