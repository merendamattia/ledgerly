import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type Transaction = InferResponseType<typeof api.expenses.$get, 200>[number];
export type CreateTransactionInput = InferRequestType<typeof api.expenses.$post>["json"];
type UpdateTransactionInput = InferRequestType<(typeof api.expenses)[":id"]["$put"]>["json"];

export interface TransactionFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  direction?: "INCOME" | "EXPENSE";
  limit?: number;
  offset?: number;
}

// Query params must be strings for the Hono RPC client.
function toQuery(filters: TransactionFilters) {
  const { limit, offset, ...rest } = filters;
  return {
    ...rest,
    ...(limit != null ? { limit: String(limit) } : {}),
    ...(offset != null ? { offset: String(offset) } : {}),
  };
}

/** One-off fetch of all rows matching the filters (used for "export all"). */
export async function fetchExpenses(filters: TransactionFilters = {}): Promise<Transaction[]> {
  return unwrap<Transaction[]>(await api.expenses.$get({ query: toQuery(filters) }));
}

export function useExpenses(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.expenses(filters),
    queryFn: async () => fetchExpenses(filters),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateTransactionInput) =>
      unwrap<Transaction>(await api.expenses.$post({ json })),
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateTransactionInput & { id: string }) =>
      unwrap<Transaction>(await api.expenses[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.expenses[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}
