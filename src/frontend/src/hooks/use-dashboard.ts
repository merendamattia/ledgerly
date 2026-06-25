import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type DashboardData = InferResponseType<typeof api.dashboard.$get, 200>;
export type NetWorthPoint = InferResponseType<
  (typeof api.dashboard)["networth-history"]["$get"],
  200
>[number];

/**
 * Loads the overview dashboard payload for the requested trailing month window.
 */
export function useDashboard(months?: number) {
  return useQuery({
    queryKey: months ? [...queryKeys.dashboard, months] : queryKeys.dashboard,
    queryFn: async () =>
      unwrap<DashboardData>(
        await api.dashboard.$get({ query: months ? { months: String(months) } : {} }),
      ),
  });
}

/** Daily net-worth series (cash + investments − debts) for the Overview chart. */
export function useNetWorthHistory() {
  return useQuery({
    queryKey: queryKeys.netWorthHistory,
    queryFn: async () =>
      unwrap<NetWorthPoint[]>(await api.dashboard["networth-history"].$get()),
  });
}
