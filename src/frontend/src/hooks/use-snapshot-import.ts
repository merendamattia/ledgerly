import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const importApi = api.snapshots.import;

export type SnapshotParseResp = InferResponseType<typeof importApi.parse.$post, 200>;
export type SnapshotCommitInput = InferRequestType<typeof importApi.commit.$post>["json"];
export type SnapshotImportColumn = SnapshotCommitInput["columns"][number];
export type SnapshotImportResult = InferResponseType<typeof importApi.commit.$post, 201>;

// Step 1: upload the wide `date,account1,account2,…` CSV/TSV and get the header
// + raw grid back. Nothing is persisted — the user maps columns first.
export function useParseSnapshotImport() {
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap<SnapshotParseResp>(await importApi.parse.$post({ form: { file } })),
  });
}

// Step 2: commit the mapped columns + rows. Creates any new accounts/debts and
// upserts the dated snapshots, then refreshes the affected views.
export function useCommitSnapshotImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: SnapshotCommitInput) =>
      unwrap<SnapshotImportResult>(await importApi.commit.$post({ json })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
      qc.invalidateQueries({ queryKey: queryKeys.cashSnapshots });
      qc.invalidateQueries({ queryKey: queryKeys.debts });
      qc.invalidateQueries({ queryKey: queryKeys.debtSnapshots });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
