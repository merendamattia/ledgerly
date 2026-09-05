import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys, type WalletRequestFilters } from "@/lib/query-keys";

type WalletRequestsApi = typeof api.admin["wallet-requests"];

export type WalletRequestList = InferResponseType<WalletRequestsApi["$get"], 200>;
export type WalletRequestDetail = InferResponseType<WalletRequestsApi[":id"]["$get"], 200>;

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function toQuery(filters: WalletRequestFilters, timezone: string) {
  return {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    timezone,
    limit: String(filters.limit),
    offset: String(filters.offset),
  };
}

/** Loads one paginated, filtered admin Wallet request page. */
export function useWalletRequests(filters: WalletRequestFilters) {
  const timezone = browserTimeZone();
  return useQuery({
    queryKey: queryKeys.walletRequests(filters, timezone),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      unwrap<WalletRequestList>(
        await api.admin["wallet-requests"].$get({ query: toQuery(filters, timezone) }),
      ),
  });
}

/** Loads the selected request's raw payload and normalized result. */
export function useWalletRequest(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.walletRequest(id),
    enabled: enabled && !!id,
    queryFn: async () =>
      unwrap<WalletRequestDetail>(
        await api.admin["wallet-requests"][":id"].$get({ param: { id } }),
      ),
  });
}
