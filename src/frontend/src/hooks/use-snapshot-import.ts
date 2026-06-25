import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

const importApi = api.snapshots.import;

export type SnapshotParseResp = InferResponseType<typeof importApi.parse.$post, 200>;
export type SnapshotCommitInput = InferRequestType<typeof importApi.commit.$post>["json"];
export type SnapshotImportColumn = SnapshotCommitInput["columns"][number];
export type SnapshotImportResult = InferResponseType<typeof importApi.commit.$post, 201>;

/**
 * Uploads a wide snapshot CSV/TSV and returns headers plus raw rows for mapping.
 */
export function useParseSnapshotImport() {
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap<SnapshotParseResp>(await importApi.parse.$post({ form: { file } })),
  });
}

/**
 * Commits mapped snapshot rows and refreshes cash, debt, and dashboard views.
 */
export function useCommitSnapshotImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: SnapshotCommitInput) =>
      unwrap<SnapshotImportResult>(await importApi.commit.$post({ json })),
    onSuccess: () =>
      invalidateLedgerQueries(qc, [
        queryKeys.accounts,
        queryKeys.cashSnapshots,
        queryKeys.debts,
        queryKeys.debtSnapshots,
        queryKeys.dashboard,
      ]),
  });
}
