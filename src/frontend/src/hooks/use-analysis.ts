import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AnalysisData = InferResponseType<typeof api.analysis.$get, 200>;

/** Reads only the latest persisted forecast and polls while background work is active. */
export function useAnalysis() {
  return useQuery({
    queryKey: queryKeys.analysis,
    queryFn: async () => unwrap<AnalysisData>(await api.analysis.$get()),
    refetchInterval: (query) => {
      const data = query.state.data;
      const generating = data?.generation?.status === "PENDING" || data?.generation?.status === "RUNNING";
      const interpreting =
        data?.forecast?.analysis.status === "PENDING" ||
        data?.forecast?.analysis.status === "RUNNING";
      return generating || interpreting ? 2_000 : false;
    },
  });
}

/** Queues a full 20-year refresh for the authenticated user. */
export function useRefreshAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap<InferResponseType<typeof api.analysis.refresh.$post, 202>>(
      await api.analysis.refresh.$post(),
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
    },
  });
}
