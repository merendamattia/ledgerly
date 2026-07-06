import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AssetReturnMatrix = InferResponseType<
  (typeof api.dashboard)["asset-return-matrix"]["$get"],
  200
>;

/** Annual price-return matrix for tracked portfolio assets. */
export function useAssetReturnMatrix() {
  return useQuery({
    queryKey: queryKeys.assetReturnMatrix,
    queryFn: async () => unwrap<AssetReturnMatrix>(await api.dashboard["asset-return-matrix"].$get()),
  });
}
