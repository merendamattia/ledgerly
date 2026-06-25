import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type Debt = InferResponseType<typeof api.debts.$get, 200>[number];
export type CreateDebtInput = InferRequestType<typeof api.debts.$post>["json"];
type UpdateDebtInput = InferRequestType<(typeof api.debts)[":id"]["$put"]>["json"];
export type DebtSnapshot = InferResponseType<typeof api.debts.snapshots.$get, 200>[number];
export type CreateDebtSnapshotInput = InferRequestType<typeof api.debts.snapshots.$post>["json"];

/**
 * Loads the current liability rows used by net-worth and debt screens.
 */
export function useDebts() {
  return useQuery({
    queryKey: queryKeys.debts,
    queryFn: async () => unwrap<Debt[]>(await api.debts.$get()),
  });
}

/**
 * Returns the standard debt invalidation callback for debt mutations.
 */
function useInvalidate() {
  const qc = useQueryClient();
  return () => invalidateLedgerQueries(qc, [queryKeys.debts, queryKeys.dashboard]);
}

/**
 * Creates a debt row and refreshes debt-dependent dashboard data.
 */
export function useCreateDebt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateDebtInput) => unwrap<Debt>(await api.debts.$post({ json })),
    onSuccess: invalidate,
  });
}

/**
 * Updates a debt row and refreshes debt-dependent dashboard data.
 */
export function useUpdateDebt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateDebtInput & { id: string }) =>
      unwrap<Debt>(await api.debts[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

/**
 * Deletes a debt row and refreshes debt-dependent dashboard data.
 */
export function useDeleteDebt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.debts[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}

// --- Debt snapshots (dated amounts) -----------------------------------------
/**
 * Loads dated debt amount snapshots for liability history.
 */
export function useDebtSnapshots() {
  return useQuery({
    queryKey: queryKeys.debtSnapshots,
    queryFn: async () => unwrap<DebtSnapshot[]>(await api.debts.snapshots.$get()),
  });
}

/**
 * Creates or updates a dated debt snapshot and refreshes affected views.
 */
export function useCreateDebtSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: CreateDebtSnapshotInput) =>
      unwrap<DebtSnapshot[]>(await api.debts.snapshots.$post({ json })),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.debtSnapshots,
        queryKeys.debts,
        queryKeys.dashboard,
      ]),
  });
}

/**
 * Deletes one dated debt snapshot and refreshes affected views.
 */
export function useDeleteDebtSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.debts.snapshots[":id"].$delete({ param: { id } })),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.debtSnapshots,
        queryKeys.debts,
        queryKeys.dashboard,
      ]),
  });
}

/**
 * Deletes every debt snapshot and refreshes debt and dashboard views.
 */
export function useDeleteAllDebtSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap<{ deleted: number }>(await api.debts.snapshots.$delete()),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.debtSnapshots,
        queryKeys.debts,
        queryKeys.dashboard,
      ]),
  });
}
