import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AssetMatrix = InferResponseType<
  (typeof api.dashboard)["asset-matrix"]["$get"],
  200
>;

/** Wide net-worth matrix: assets (rows) × month boundaries (columns). */
export function useAssetMatrix() {
  return useQuery({
    queryKey: queryKeys.assetMatrix,
    queryFn: async () => unwrap<AssetMatrix>(await api.dashboard["asset-matrix"].$get()),
  });
}
