import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import {
  invalidateLedgerQueries,
  queryKeys,
  type TransactionFilters,
} from "@/lib/query-keys";
import { loadCompletePages, MAX_TRANSACTION_PAGE_SIZE } from "@/lib/transaction-period";

export type { TransactionFilters } from "@/lib/query-keys";

export type Transaction = InferResponseType<typeof api.expenses.$get, 200>[number];
export type ExpenseTagsResponse = InferResponseType<typeof api.expenses.tags.$get, 200>;
export type TransactionSummary = InferResponseType<typeof api.expenses.summary.$get, 200>;
export type CreateTransactionInput = InferRequestType<typeof api.expenses.$post>["json"];
type UpdateTransactionInput = InferRequestType<(typeof api.expenses)[":id"]["$put"]>["json"];

/**
 * Converts typed transaction filters into string query params for Hono RPC.
 */
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

/** Loads every matching page while keeping each request within the API limit. */
export async function fetchCompleteExpenses(filters: TransactionFilters = {}): Promise<Transaction[]> {
  return loadCompletePages((offset, limit) =>
    fetchExpenses({ ...filters, limit: Math.min(limit, MAX_TRANSACTION_PAGE_SIZE), offset }),
  );
}

/**
 * Loads paginated or filtered income/expense transactions.
 */
export function useExpenses(filters: TransactionFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.expenses(filters),
    queryFn: async () => fetchExpenses(filters),
    enabled,
  });
}

/** Loads the complete result for a bounded period or another analytical slice. */
export function useCompleteExpenses(filters: TransactionFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.expenses({ ...filters, limit: MAX_TRANSACTION_PAGE_SIZE, offset: 0 }),
    queryFn: async () => fetchCompleteExpenses(filters),
    enabled,
  });
}

/** Loads server-side financial totals for the complete filtered transaction set. */
export function useExpenseSummary(
  filters: Omit<TransactionFilters, "limit" | "offset"> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.expenseSummary(filters),
    queryFn: async () =>
      unwrap<TransactionSummary>(await api.expenses.summary.$get({ query: toQuery(filters) })),
    enabled,
  });
}

/** Loads distinct note hashtags for the selected transaction slice. */
export function useExpenseTags(
  filters: Pick<TransactionFilters, "from" | "to" | "categoryId" | "direction"> = {},
) {
  return useQuery({
    queryKey: queryKeys.expenseTags(filters),
    queryFn: async () =>
      unwrap<ExpenseTagsResponse>(await api.expenses.tags.$get({ query: toQuery(filters) })),
  });
}

/**
 * Returns the standard transaction invalidation callback for expense mutations.
 */
function useInvalidate() {
  const qc = useQueryClient();
  return () => invalidateLedgerQueries(qc, [queryKeys.expensesRoot, queryKeys.dashboard]);
}

/**
 * Creates an income or expense transaction and refreshes affected totals.
 */
export function useCreateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateTransactionInput) =>
      unwrap<Transaction>(await api.expenses.$post({ json })),
    onSuccess: invalidate,
  });
}

/**
 * Updates an income or expense transaction and refreshes affected totals.
 */
export function useUpdateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateTransactionInput & { id: string }) =>
      unwrap<Transaction>(await api.expenses[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

/**
 * Deletes one transaction and refreshes affected totals.
 */
export function useDeleteTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.expenses[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}
