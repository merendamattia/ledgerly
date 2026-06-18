import { test, expect } from "bun:test";
import { yahooProvider } from "../src/services/market/providers/yahoo.ts";

// Regression: the nightly cron once crashed with "start date cannot be after
// end date" when the latest stored close was already today and `from` became
// tomorrow. A future start date must short-circuit to no bars, never hit Yahoo.
test("fetchHistory returns no bars for a future start date (no provider call)", async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const bars = await yahooProvider.fetchHistory("AAPL", tomorrow);
  expect(bars).toEqual([]);
});
