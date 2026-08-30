import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { clearLedgerQueryCache, queryKeys } from "./query-keys";

test("does not reuse user A's fresh personal data after logout before user B fetches", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });

  queryClient.setQueryData(queryKeys.dashboard, { owner: "A", netWorth: 1_000 });
  queryClient.setQueryData(queryKeys.accounts, [{ owner: "A", name: "A's account" }]);
  queryClient.setQueryData(queryKeys.settings, { owner: "A", baseCurrency: "EUR" });

  clearLedgerQueryCache(queryClient);

  expect(queryClient.getQueryData(queryKeys.dashboard)).toBeUndefined();
  expect(queryClient.getQueryData(queryKeys.accounts)).toBeUndefined();
  expect(queryClient.getQueryData(queryKeys.settings)).toBeUndefined();

  const userBData = await queryClient.fetchQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => ({ owner: "B", netWorth: 2_000 }),
  });

  expect(userBData).toEqual({ owner: "B", netWorth: 2_000 });
});
