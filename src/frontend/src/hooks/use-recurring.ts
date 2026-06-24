import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const endpoint = api["recurring-expenses"];

export type RecurringExpense = InferResponseType<typeof endpoint.$get, 200>[number];
export type CreateRecurringInput = InferRequestType<typeof endpoint.$post>["json"];
type UpdateRecurringInput = InferRequestType<(typeof endpoint)[":id"]["$put"]>["json"];

export function useRecurringExpenses() {
  return useQuery({
    queryKey: queryKeys.recurringExpenses,
    queryFn: async () => unwrap<RecurringExpense[]>(await endpoint.$get()),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  // A recurring change can also produce/affect movements, so refresh those too.
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.recurringExpenses });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateRecurringExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateRecurringInput) =>
      unwrap<RecurringExpense>(await endpoint.$post({ json })),
    onSuccess: invalidate,
  });
}

export function useUpdateRecurringExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateRecurringInput & { id: string }) =>
      unwrap<RecurringExpense>(await endpoint[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurringExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await endpoint[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}
