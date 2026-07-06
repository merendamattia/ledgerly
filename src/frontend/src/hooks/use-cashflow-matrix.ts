import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type CashflowMatrix = InferResponseType<
  (typeof api.dashboard)["cashflow-matrix"]["$get"],
  200
>;

/** Wide cash-flow matrix: expense/income/investment categories (rows) × month columns. */
export function useCashflowMatrix() {
  return useQuery({
    queryKey: queryKeys.cashflowMatrix,
    queryFn: async () => unwrap<CashflowMatrix>(await api.dashboard["cashflow-matrix"].$get()),
  });
}
