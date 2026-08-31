import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type ManagedUser = InferResponseType<typeof api.users.$get, 200>[number];
type CreateUserInput = InferRequestType<typeof api.users.$post>["json"];
type ChangePasswordInput = InferRequestType<(typeof api.users.password)["$post"]>["json"];

/** Loads the account directory for the admin Settings surface. */
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => unwrap<ManagedUser[]>(await api.users.$get()),
  });
}

/** Provisions a user through the backend's admin-only account API. */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (json: CreateUserInput) =>
      unwrap<ManagedUser>(await api.users.$post({ json })),
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.users]),
  });
}

/** Changes the signed-in user's password and clears any temporary-password flag. */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (json: ChangePasswordInput) =>
      unwrap<ManagedUser>(await api.users.password.$post({ json })),
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.settings]),
  });
}
