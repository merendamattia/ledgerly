import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type Account = InferResponseType<typeof api.accounts.$get, 200>[number];
export type CreateAccountInput = InferRequestType<typeof api.accounts.$post>["json"];
type UpdateAccountInput = InferRequestType<(typeof api.accounts)[":id"]["$put"]>["json"];
export type CashSnapshot = InferResponseType<typeof api.accounts.snapshots.$get, 200>[number];
export type CreateCashSnapshotInput = InferRequestType<
  typeof api.accounts.snapshots.$post
>["json"];

/**
 * Loads the current cash, broker, credit, and other-asset accounts.
 */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async () => unwrap<Account[]>(await api.accounts.$get()),
  });
}

/**
 * Returns the standard account invalidation callback for account mutations.
 */
function useInvalidate() {
  const qc = useQueryClient();
  return () => invalidateLedgerQueries(qc, [queryKeys.accounts, queryKeys.dashboard]);
}

/**
 * Creates a cash/broker account and refreshes account-dependent dashboard data.
 */
export function useCreateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateAccountInput) =>
      unwrap<Account>(await api.accounts.$post({ json })),
    onSuccess: invalidate,
  });
}

/**
 * Updates an existing account and refreshes account-dependent dashboard data.
 */
export function useUpdateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateAccountInput & { id: string }) =>
      unwrap<Account>(await api.accounts[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

/**
 * Deletes an account and refreshes account-dependent dashboard data.
 */
export function useDeleteAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.accounts[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}

// --- Cash snapshots (dated balances) ----------------------------------------
/**
 * Loads the dated balance snapshots that back cash and broker history charts.
 */
export function useCashSnapshots() {
  return useQuery({
    queryKey: queryKeys.cashSnapshots,
    queryFn: async () => unwrap<CashSnapshot[]>(await api.accounts.snapshots.$get()),
  });
}

/**
 * Creates or updates a dated cash snapshot and refreshes affected account views.
 */
export function useCreateCashSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: CreateCashSnapshotInput) =>
      unwrap<CashSnapshot[]>(await api.accounts.snapshots.$post({ json })),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.cashSnapshots,
        queryKeys.accounts,
        queryKeys.dashboard,
      ]),
  });
}

/**
 * Deletes one dated cash snapshot and refreshes affected account views.
 */
export function useDeleteCashSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.accounts.snapshots[":id"].$delete({ param: { id } })),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.cashSnapshots,
        queryKeys.accounts,
        queryKeys.dashboard,
      ]),
  });
}

/**
 * Deletes all cash snapshots in one account category and refreshes affected views.
 */
export function useDeleteCashSnapshotsByCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (category: Account["category"]) =>
      unwrap<{ deleted: number }>(
        await api.accounts.snapshots.categories[":category"].$delete({ param: { category } }),
      ),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.cashSnapshots,
        queryKeys.accounts,
        queryKeys.dashboard,
      ]),
  });
}
