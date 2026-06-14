import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type TableData = InferResponseType<(typeof api.database.tables)[":table"]["$get"], 200>;

export function useTables() {
  return useQuery({
    queryKey: queryKeys.databaseTables,
    queryFn: async () =>
      unwrap<{ tables: string[] }>(await api.database.tables.$get()),
  });
}

export function useTableData(
  table: string,
  params: { search?: string; limit: number; offset: number },
) {
  return useQuery({
    queryKey: queryKeys.databaseTable(table, params),
    enabled: table.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      unwrap<TableData>(
        await api.database.tables[":table"].$get({
          param: { table },
          query: {
            ...(params.search ? { search: params.search } : {}),
            limit: String(params.limit),
            offset: String(params.offset),
          },
        }),
      ),
  });
}
