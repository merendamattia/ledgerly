import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type ParseResponse = InferResponseType<typeof api.expenses.import.parse.$post, 200>;
export type ImportRow = ParseResponse["rows"][number];
export type ImportParseError = ParseResponse["errors"][number];
type CommitInput = InferRequestType<typeof api.expenses.import.commit.$post>["json"];
export type ImportResult = InferResponseType<typeof api.expenses.import.commit.$post, 201>;

// Step 1: upload the Budjet file and get the parsed rows + parse errors back.
// No data is persisted here — the user reviews/edits the rows first.
export function useParseImport() {
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap<ParseResponse>(await api.expenses.import.parse.$post({ form: { file } })),
  });
}

// Step 2: commit the (possibly edited) rows. Duplicates are skipped server-side.
export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CommitInput["rows"]) =>
      unwrap<ImportResult>(await api.expenses.import.commit.$post({ json: { rows } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.categories() });
    },
  });
}
