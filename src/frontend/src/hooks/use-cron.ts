import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type CronJob = InferResponseType<(typeof api.cron.jobs)["$get"], 200>[number];
export type CronRun = InferResponseType<(typeof api.cron.runs)["$get"], 200>[number];

/**
 * Loads configured cron jobs and their current scheduling metadata.
 */
export function useCronJobs() {
  return useQuery({
    queryKey: queryKeys.cronJobs,
    queryFn: async () => unwrap<CronJob[]>(await api.cron.jobs.$get()),
  });
}

/**
 * Loads recent cron run history, limited to the requested number of rows.
 */
export function useCronRuns(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.cronRuns, limit],
    queryFn: async () =>
      unwrap<CronRun[]>(await api.cron.runs.$get({ query: { limit: String(limit) } })),
  });
}

/**
 * Runs one cron job manually and refreshes cron plus dashboard data.
 */
export function useRunCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) =>
      unwrap<CronRun>(await api.cron[":key"].run.$post({ param: { key } })),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.cronJobs,
        queryKeys.cronRuns,
        queryKeys.dashboard,
      ]),
  });
}
