import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type Debt = InferResponseType<typeof api.debts.$get, 200>[number];
export type CreateDebtInput = InferRequestType<typeof api.debts.$post>["json"];
type UpdateDebtInput = InferRequestType<(typeof api.debts)[":id"]["$put"]>["json"];
export type DebtSnapshot = InferResponseType<typeof api.debts.snapshots.$get, 200>[number];
export type CreateDebtSnapshotInput = InferRequestType<typeof api.debts.snapshots.$post>["json"];

export function useDebts() {
  return useQuery({
    queryKey: queryKeys.debts,
    queryFn: async () => unwrap<Debt[]>(await api.debts.$get()),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.debts });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateDebt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateDebtInput) => unwrap<Debt>(await api.debts.$post({ json })),
    onSuccess: invalidate,
  });
}

export function useUpdateDebt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateDebtInput & { id: string }) =>
      unwrap<Debt>(await api.debts[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

export function useDeleteDebt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.debts[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}

// --- Debt snapshots (dated amounts) -----------------------------------------
export function useDebtSnapshots() {
  return useQuery({
    queryKey: queryKeys.debtSnapshots,
    queryFn: async () => unwrap<DebtSnapshot[]>(await api.debts.snapshots.$get()),
  });
}

export function useCreateDebtSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: CreateDebtSnapshotInput) =>
      unwrap<DebtSnapshot[]>(await api.debts.snapshots.$post({ json })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.debtSnapshots });
      qc.invalidateQueries({ queryKey: queryKeys.debts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteDebtSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.debts.snapshots[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.debtSnapshots });
      qc.invalidateQueries({ queryKey: queryKeys.debts });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
