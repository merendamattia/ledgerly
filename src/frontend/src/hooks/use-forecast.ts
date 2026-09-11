import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ForecastResponse } from "@/components/analysis/analysis-model";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function requestForecast(method: "GET" | "POST"): Promise<ForecastResponse> {
  return unwrap<ForecastResponse>(
    await fetch(`${apiBaseUrl}/api/forecast`, {
      method,
      credentials: "include",
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    }),
  );
}

/** Loads the persisted forecast and polls only while the current user's generation is active. */
export function useForecast() {
  return useQuery({
    queryKey: queryKeys.forecast,
    queryFn: () => requestForecast("GET"),
    placeholderData: (previous) => previous,
    refetchInterval: (query) =>
      query.state.data?.status === "GENERATING" ? 2_000 : false,
  });
}

/** Requests a guarded current-user generation while preserving any cached snapshot. */
export function useRefreshForecast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestForecast("POST"),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.forecast, response);
      void queryClient.invalidateQueries({ queryKey: queryKeys.forecast });
    },
  });
}
