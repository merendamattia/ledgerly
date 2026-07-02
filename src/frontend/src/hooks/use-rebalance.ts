import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type RebalanceGroup = InferResponseType<
  (typeof api)["rebalance-groups"]["$get"],
  200
>[number];
export type CreateRebalanceGroupInput = InferRequestType<
  (typeof api)["rebalance-groups"]["$post"]
>["json"];
export type UpdateRebalanceGroupInput = InferRequestType<
  (typeof api)["rebalance-groups"][":id"]["$put"]
>["json"];

export type Pillar = InferResponseType<typeof api.pillars.$get, 200>[number];
export type UpsertPillarInput = InferRequestType<
  (typeof api.pillars)[":position"]["$put"]
>["json"];

// --- Rebalance groups ---------------------------------------------------------
/** Loads the configured rebalance rows (asset groups with target allocations). */
export function useRebalanceGroups() {
  return useQuery({
    queryKey: queryKeys.rebalanceGroups,
    queryFn: async () => unwrap<RebalanceGroup[]>(await api["rebalance-groups"].$get()),
  });
}

/** Returns the standard invalidation callback for rebalance mutations. */
function useInvalidateRebalance() {
  const qc = useQueryClient();
  return () => invalidateLedgerQueries(qc, [queryKeys.rebalanceGroups]);
}

/** Creates a rebalance group (one or more tickers with a target %). */
export function useCreateRebalanceGroup() {
  const invalidate = useInvalidateRebalance();
  return useMutation({
    mutationFn: async (json: CreateRebalanceGroupInput) =>
      unwrap<RebalanceGroup>(await api["rebalance-groups"].$post({ json })),
    onSuccess: invalidate,
  });
}

/** Updates a rebalance group's name, target, threshold or members. */
export function useUpdateRebalanceGroup() {
  const invalidate = useInvalidateRebalance();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateRebalanceGroupInput & { id: string }) =>
      unwrap<RebalanceGroup>(
        await api["rebalance-groups"][":id"].$put({ param: { id }, json }),
      ),
    onSuccess: invalidate,
  });
}

/** Deletes a rebalance group; its tickers fall back to unconfigured rows. */
export function useDeleteRebalanceGroup() {
  const invalidate = useInvalidateRebalance();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api["rebalance-groups"][":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}

// --- Pillars -------------------------------------------------------------------
/** Loads the configured investment pillars (up to 4). */
export function usePillars() {
  return useQuery({
    queryKey: queryKeys.pillars,
    queryFn: async () => unwrap<Pillar[]>(await api.pillars.$get()),
  });
}

/** Creates or replaces the pillar at a position (1-4) with a name + members. */
export function useUpsertPillar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ position, ...json }: UpsertPillarInput & { position: number }) =>
      unwrap<Pillar>(
        await api.pillars[":position"].$put({ param: { position: String(position) }, json }),
      ),
    onSuccess: () => invalidateLedgerQueries(qc, [queryKeys.pillars]),
  });
}
