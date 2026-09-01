import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type PersonalApiTokenStatus = InferResponseType<typeof api.integrations.token.$get, 200>;
export type GeneratedPersonalApiToken = InferResponseType<
  typeof api.integrations.token.$post,
  201
>;
export type RotatedPersonalApiToken = InferResponseType<
  typeof api.integrations.token.rotate.$post,
  200
>;

/** Loads only the non-sensitive metadata for the current user's integration token. */
export function usePersonalApiToken() {
  return useQuery({
    queryKey: queryKeys.integrationToken,
    queryFn: async () =>
      unwrap<PersonalApiTokenStatus>(await api.integrations.token.$get()),
  });
}

/** Creates the first personal integration token and refreshes its metadata. */
export function useCreatePersonalApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<GeneratedPersonalApiToken>(await api.integrations.token.$post()),
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.integrationToken]),
  });
}

/** Rotates the personal integration token, invalidating the previous secret. */
export function useRotatePersonalApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<RotatedPersonalApiToken>(await api.integrations.token.rotate.$post()),
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.integrationToken]),
  });
}

/** Revokes the current personal integration token. */
export function useRevokePersonalApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<{ ok: true }>(await api.integrations.token.$delete()),
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.integrationToken]),
  });
}
