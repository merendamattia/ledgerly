import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type Settings = InferResponseType<typeof api.settings.$get, 200>;
type UpdateSettingsInput = InferRequestType<typeof api.settings.$put>["json"];
type AcknowledgeReleaseInput = InferRequestType<
  (typeof api.settings)["release-acknowledgement"]["$post"]
>["json"];

/**
 * Loads application settings such as the base currency.
 */
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => unwrap<Settings>(await api.settings.$get()),
  });
}

/**
 * Updates application settings and refreshes settings-dependent dashboard data.
 */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: UpdateSettingsInput) =>
      unwrap<Settings>(await api.settings.$put({ json })),
    onSuccess: () => invalidateLedgerQueries(qc, [queryKeys.settings, queryKeys.dashboard]),
  });
}

/** Records the current built release as seen by the authenticated user. */
export function useAcknowledgeRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: AcknowledgeReleaseInput) =>
      unwrap<Settings>(await api.settings["release-acknowledgement"].$post({ json })),
    onSuccess: (settings) => qc.setQueryData(queryKeys.settings, settings),
  });
}
