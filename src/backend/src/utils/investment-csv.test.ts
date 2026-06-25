import { expect, test } from "bun:test";
import { parseInvestmentCsv } from "./investment-csv.ts";

/** Builds a tab-delimited investment CSV fixture. */
function buildCsv(header: string[], row: string[]): Uint8Array {
  return new TextEncoder().encode([header.join("\t"), row.join("\t")].join("\n"));
}

/** Builds a comma-delimited investment CSV fixture. */
function buildCommaCsv(header: string[], row: string[]): Uint8Array {
  return new TextEncoder().encode([header.join(","), row.join(",")].join("\n"));
}

test("parses reordered investment columns using the supplied mapping", () => {
  const bytes = buildCsv(
    ["date", "broker", "quantity", "price", "ticker", "total"],
    ["15/01/2024", "Trading212", "1,390", "458,35", "AMS:CSPX", "637,20"],
  );

  const { rows, errors } = parseInvestmentCsv(bytes, {
    ticker: 4,
    price: 3,
    quantity: 2,
    total: 5,
    date: 0,
    broker: 1,
    defaults: {},
    skipHeader: true,
  });

  expect(errors).toEqual([]);
  expect(rows).toEqual([
    {
      ticker: "AMS:CSPX",
      broker: "Trading212",
      date: "2024-01-15",
      quantity: 1.39,
      price: 458.35,
      total: 637.2,
    },
  ]);
});

test("parses comma-delimited investment csv files", () => {
  const bytes = buildCommaCsv(
    ["ticker", "side", "qty", "price", "date", "fee"],
    ["BTC", "Buy", "0.0047298", "74144.26", "2021-05-01", "0.0"],
  );

  const { rows, errors } = parseInvestmentCsv(bytes, {
    ticker: 0,
    price: 3,
    quantity: 2,
    total: 5,
    date: 4,
    broker: null,
    defaults: {
      broker: "Coinbase",
    },
    skipHeader: true,
  });

  expect(errors).toEqual([]);
  expect(rows[0]).toMatchObject({
    ticker: "BTC",
    broker: "Coinbase",
    date: "2021-05-01",
    quantity: 0.0047298,
    price: 74144.26,
    total: 0,
  });
});

test("uses defaults for missing non-numeric investment columns", () => {
  const bytes = buildCsv(["price", "quantity"], ["458,35", "1,390"]);

  const { rows, errors } = parseInvestmentCsv(bytes, {
    ticker: null,
    price: 0,
    quantity: 1,
    total: null,
    date: null,
    broker: null,
    defaults: {
      ticker: "AMS:CSPX",
      date: "15/01/2024",
      broker: "Trading212",
    },
    skipHeader: true,
  });

  expect(errors).toEqual([]);
  expect(rows).toEqual([
    {
      ticker: "AMS:CSPX",
      broker: "Trading212",
      date: "2024-01-15",
      quantity: 1.39,
      price: 458.35,
      total: null,
    },
  ]);
});

test("still rejects missing required numeric fields", () => {
  const bytes = buildCsv(["ticker", "quantity"], ["AMS:CSPX", "1,390"]);

  const { rows, errors } = parseInvestmentCsv(bytes, {
    ticker: 0,
    price: null,
    quantity: 1,
    total: null,
    date: null,
    broker: null,
    defaults: {
      broker: "Trading212",
      date: "15/01/2024",
    },
    skipHeader: true,
  });

  expect(rows).toHaveLength(0);
  expect(errors[0]?.message).toBe("Missing price");
});
