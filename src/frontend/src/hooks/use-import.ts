import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

type ParseResponse = InferResponseType<typeof api.expenses.import.parse.$post, 200>;
export type ImportRow = ParseResponse["rows"][number];
export type ImportParseError = ParseResponse["errors"][number];
type CommitInput = InferRequestType<typeof api.expenses.import.commit.$post>["json"];
export type ImportResult = InferResponseType<typeof api.expenses.import.commit.$post, 201>;

/**
 * Uploads a Budjet file and returns parsed rows plus parse errors for review.
 */
export function useParseImport() {
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap<ParseResponse>(await api.expenses.import.parse.$post({ form: { file } })),
  });
}

/**
 * Commits reviewed Budjet rows and refreshes transactions, dashboard, and categories.
 */
export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CommitInput["rows"]) =>
      unwrap<ImportResult>(await api.expenses.import.commit.$post({ json: { rows } })),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.expensesRoot,
        queryKeys.dashboard,
        queryKeys.categories(),
      ]),
  });
}
