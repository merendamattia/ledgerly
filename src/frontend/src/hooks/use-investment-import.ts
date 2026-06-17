import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const importApi = api["investment-transactions"].import;

type ParseResp = InferResponseType<typeof importApi.parse.$post, 200>;
export type ParsedInvestmentRow = ParseResp["rows"][number];
export type InvestmentParseError = ParseResp["errors"][number];
type CommitInput = InferRequestType<typeof importApi.commit.$post>["json"];
export type CommitRow = CommitInput["rows"][number];
export type InvestmentImportResult = InferResponseType<typeof importApi.commit.$post, 201>;

export type InvestmentImportColumnMap = {
  ticker: number | null;
  price: number | null;
  quantity: number | null;
  total: number | null;
  date: number | null;
  broker: number | null;
  defaults: {
    ticker?: string;
    date?: string;
    broker?: string;
  };
  skipHeader: boolean;
};

export type InvestmentParseInput = {
  file: File;
  mapping: InvestmentImportColumnMap;
};

// Step 1: upload the broker CSV/TSV and get parsed rows + parse errors back.
// Nothing is persisted — the user reviews, maps tickers/brokers, and edits first.
export function useParseInvestmentImport() {
  return useMutation({
    mutationFn: async ({ file, mapping }: InvestmentParseInput) =>
      unwrap<ParseResp>(
        await importApi.parse.$post({
          form: { file, mapping: JSON.stringify(mapping) },
        }),
      ),
  });
}

// Step 2: commit the mapped rows. Duplicates are skipped server-side; affected
// holdings are recomputed once per ticker.
export function useCommitInvestmentImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CommitRow[]) =>
      unwrap<InvestmentImportResult>(await importApi.commit.$post({ json: { rows } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investment-transactions"] });
      qc.invalidateQueries({ queryKey: queryKeys.holdings });
      qc.invalidateQueries({ queryKey: queryKeys.investmentHistory });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });
}
