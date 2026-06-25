import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

const endpoint = api["recurring-expenses"];

export type RecurringExpense = InferResponseType<typeof endpoint.$get, 200>[number];
export type CreateRecurringInput = InferRequestType<typeof endpoint.$post>["json"];
type UpdateRecurringInput = InferRequestType<(typeof endpoint)[":id"]["$put"]>["json"];

/**
 * Loads the recurring expenses that can generate future transactions.
 */
export function useRecurringExpenses() {
  return useQuery({
    queryKey: queryKeys.recurringExpenses,
    queryFn: async () => unwrap<RecurringExpense[]>(await endpoint.$get()),
  });
}

/**
 * Returns the standard invalidation callback for recurring expense mutations.
 */
function useInvalidate() {
  const qc = useQueryClient();
  // A recurring change can also produce/affect movements, so refresh those too.
  return () =>
    invalidateLedgerQueries(qc, [
      queryKeys.recurringExpenses,
      queryKeys.expensesRoot,
      queryKeys.dashboard,
    ]);
}

/**
 * Creates a recurring expense definition and refreshes affected movement views.
 */
export function useCreateRecurringExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateRecurringInput) =>
      unwrap<RecurringExpense>(await endpoint.$post({ json })),
    onSuccess: invalidate,
  });
}

/**
 * Updates a recurring expense definition and refreshes affected movement views.
 */
export function useUpdateRecurringExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateRecurringInput & { id: string }) =>
      unwrap<RecurringExpense>(await endpoint[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

/**
 * Deletes a recurring expense definition and refreshes affected movement views.
 */
export function useDeleteRecurringExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await endpoint[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}
