import { test, expect } from "bun:test";
import { buildFxPairs, collectFxCurrencies } from "../src/services/cron/jobs.ts";

// Pure unit test (no DB / no provider): the nightly FX job must always refresh the
// reference EUR/USD pair, even when no holding uses USD.
test("always includes EUR/USD in both directions with no tickers", () => {
  const pairs = buildFxPairs("EUR", []);
  expect(pairs).toContainEqual(["EUR", "USD"]);
  expect(pairs).toContainEqual(["USD", "EUR"]);
});

test("adds each ticker currency vs base and dedupes", () => {
  const pairs = buildFxPairs("EUR", ["USD", "GBP", "GBP", "EUR"]);
  // USD->EUR already added via the EUR/USD floor; GBP->EUR added once; EUR->EUR dropped.
  expect(pairs).toContainEqual(["GBP", "EUR"]);
  expect(pairs.filter(([b, q]) => b === "GBP" && q === "EUR")).toHaveLength(1);
  expect(pairs.filter(([b, q]) => b === q)).toHaveLength(0);
});

test("never produces duplicate pairs", () => {
  const pairs = buildFxPairs("USD", ["EUR", "USD"]);
  const keys = pairs.map(([b, q]) => `${b}:${q}`);
  expect(new Set(keys).size).toBe(keys.length);
});

test("includes currencies used only by cash accounts and debts", () => {
  const currencies = collectFxCurrencies([], ["GBP"], ["CHF", "GBP"]);
  const pairs = buildFxPairs("EUR", currencies);

  expect(pairs).toContainEqual(["GBP", "EUR"]);
  expect(pairs).toContainEqual(["CHF", "EUR"]);
});
