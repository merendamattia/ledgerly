import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api-client";
import type { ForecastResponse } from "@/lib/forecast-contract";
import { queryKeys } from "@/lib/query-keys";

/** Loads the persisted forecast and polls only while the current user's generation is active. */
export function useForecast() {
  return useQuery({
    queryKey: queryKeys.forecast,
    queryFn: async () => unwrap<ForecastResponse>(await api.forecast.$get()),
    placeholderData: (previous) => previous,
    refetchInterval: (query) =>
      query.state.data?.status === "GENERATING" ? 2_000 : false,
  });
}

/** Requests a guarded current-user generation while preserving any cached snapshot. */
export function useRefreshForecast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap<ForecastResponse>(await api.forecast.$post()),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.forecast, response);
      void queryClient.invalidateQueries({ queryKey: queryKeys.forecast });
    },
  });
}
