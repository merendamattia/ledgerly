import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacyModeProvider } from "../privacy-mode";
import { queryKeys } from "@/lib/query-keys";
import type { AssetReturnMatrix } from "@/hooks/use-asset-return-matrix";
import { AssetReturnMatrixView } from "./asset-return-matrix-view";

test("every year pins opaque asset and ticker cells above scrolling values", () => {
  const data: AssetReturnMatrix = {
    monthLabels: ["Jan", "Feb"],
    years: [2025, 2024].map((year) => ({
      year,
      nextYear: year + 1,
      rows: [{
        id: "test-etf",
        name: "Test ETF",
        symbol: "TEST",
        type: "ETF",
        currency: "EUR",
        firstAdded: "2024-01-01",
        start: 100,
        months: [101, 102],
        returnPct: 2,
      }],
    })),
  };
  const client = new QueryClient();
  client.setQueryData(queryKeys.assetReturnMatrix, data);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <PrivacyModeProvider>
        <AssetReturnMatrixView />
      </PrivacyModeProvider>
    </QueryClientProvider>,
  );
  client.clear();

  expect(html).toContain("overflow-x-auto");
  const pinned = [...html.matchAll(/<(th|td) class="([^"]*\bsticky\b[^"]*)"/g)];
  expect(pinned).toHaveLength(8);
  for (const [index, cell] of pinned.entries()) {
    const classes = cell[2].split(" ");
    expect(classes).toContain(index % 2 === 0 ? "left-0" : "left-60");
    expect(classes).toContain(cell[1] === "th" ? "bg-muted" : "bg-card");
    expect(classes).toContain(cell[1] === "th" ? "z-30" : "z-20");
    expect(classes.some((value) => /^(bg-.*\/|opacity-)/.test(value))).toBe(false);
  }
});
