import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type Account = InferResponseType<typeof api.accounts.$get, 200>[number];
export type CreateAccountInput = InferRequestType<typeof api.accounts.$post>["json"];
type UpdateAccountInput = InferRequestType<(typeof api.accounts)[":id"]["$put"]>["json"];

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
