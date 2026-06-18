import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type Category = InferResponseType<typeof api.categories.$get, 200>[number];
export type CreateCategoryInput = InferRequestType<typeof api.categories.$post>["json"];
type UpdateCategoryInput = InferRequestType<(typeof api.categories)[":id"]["$put"]>["json"];

export function useCategories(kind?: "INCOME" | "EXPENSE", enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories(kind),
    queryFn: async () =>
      unwrap<Category[]>(await api.categories.$get({ query: kind ? { kind } : {} })),
    enabled,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.categories() });
}

export function useCreateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (json: CreateCategoryInput) =>
      unwrap<Category>(await api.categories.$post({ json })),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...json }: UpdateCategoryInput & { id: string }) =>
      unwrap<Category>(await api.categories[":id"].$put({ param: { id }, json })),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: boolean }>(await api.categories[":id"].$delete({ param: { id } })),
    onSuccess: invalidate,
  });
}
