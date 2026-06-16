import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type Account = InferResponseType<typeof api.accounts.$get, 200>[number];
export type CreateAccountInput = InferRequestType<typeof api.accounts.$post>["json"];
type UpdateAccountInput = InferRequestType<(typeof api.accounts)[":id"]["$put"]>["json"];
export type CashSnapshot = InferResponseType<typeof api.accounts.snapshots.$get, 200>[number];
export type CreateCashSnapshotInput = InferRequestType<
  typeof api.accounts.snapshots.$post
>["json"];

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async () => unwrap<Account[]>(await api.accounts.$get()),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.accounts });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateAccountInput) =>
      unwrap<Account>(await api.accounts.$post({ json })),
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateAccountInput & { id: string }) =>
      unwrap<Account>(await api.accounts[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.accounts[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}

// --- Cash snapshots (dated balances) ----------------------------------------
export function useCashSnapshots() {
  return useQuery({
    queryKey: queryKeys.cashSnapshots,
    queryFn: async () => unwrap<CashSnapshot[]>(await api.accounts.snapshots.$get()),
  });
}

export function useCreateCashSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: CreateCashSnapshotInput) =>
      unwrap<CashSnapshot[]>(await api.accounts.snapshots.$post({ json })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cashSnapshots });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
