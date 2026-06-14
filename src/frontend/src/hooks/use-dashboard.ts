import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type DashboardData = InferResponseType<typeof api.dashboard.$get, 200>;

export function useDashboard(months?: number) {
  return useQuery({
    queryKey: months ? [...queryKeys.dashboard, months] : queryKeys.dashboard,
    queryFn: async () =>
      unwrap<DashboardData>(
        await api.dashboard.$get({ query: months ? { months: String(months) } : {} }),
      ),
  });
}
