import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys, type WalletRequestFilters } from "@/lib/query-keys";

type WalletRequestsApi = typeof api.admin["wallet-requests"];

export type WalletRequestList = InferResponseType<WalletRequestsApi["$get"], 200>;
export type WalletRequestDetail = InferResponseType<WalletRequestsApi[":id"]["$get"], 200>;

function toQuery(filters: WalletRequestFilters) {
  return {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    limit: String(filters.limit),
    offset: String(filters.offset),
  };
}

/** Loads one paginated, filtered admin Wallet request page. */
export function useWalletRequests(filters: WalletRequestFilters) {
  return useQuery({
    queryKey: queryKeys.walletRequests(filters),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      unwrap<WalletRequestList>(
        await api.admin["wallet-requests"].$get({ query: toQuery(filters) }),
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
