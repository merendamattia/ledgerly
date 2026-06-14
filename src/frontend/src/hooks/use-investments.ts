import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type Ticker = InferResponseType<typeof api.tickers.$get, 200>[number];
export type Holding = InferResponseType<typeof api.holdings.$get, 200>[number];
export type AddAssetInput = InferRequestType<typeof api.tickers.$post>["json"];
export type CreateHoldingInput = InferRequestType<typeof api.holdings.$post>["json"];
type UpdateHoldingInput = InferRequestType<(typeof api.holdings)[":id"]["$put"]>["json"];

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

export function useDeleteTicker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.tickers[":id"].$delete({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tickers }),
  });
}

// --- Holdings ---------------------------------------------------------------
export function useHoldings() {
  return useQuery({
    queryKey: queryKeys.holdings,
    queryFn: async () => unwrap<Holding[]>(await api.holdings.$get()),
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
