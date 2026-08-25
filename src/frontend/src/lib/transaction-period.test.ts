import { expect, test } from "bun:test";
import {
  CUSTOM_TRANSACTION_PERIOD,
  resolveTransactionRange,
} from "./transaction-period";

const TODAY = "2026-08-25";

test("resolves month presets through the existing inclusive date filters", () => {
  expect(resolveTransactionRange("2026-07", TODAY)).toEqual({
    from: "2026-07-01",
    to: "2026-07-31",
  });
  expect(resolveTransactionRange("2026-08", TODAY)).toEqual({
    from: "2026-08-01",
    to: TODAY,
  });
  expect(resolveTransactionRange("all", TODAY)).toEqual({
    from: undefined,
    to: TODAY,
  });
});

test("resolves and bounds a custom date range", () => {
  expect(
    resolveTransactionRange(CUSTOM_TRANSACTION_PERIOD, TODAY, "2026-07-15", "2026-08-10"),
  ).toEqual({
    from: "2026-07-15",
    to: "2026-08-10",
  });
  expect(
    resolveTransactionRange(CUSTOM_TRANSACTION_PERIOD, TODAY, "2026-08-20", "2026-09-01"),
  ).toEqual({
    from: "2026-08-20",
    to: TODAY,
  });
});

test("clearing custom dates falls back to the current period boundary", () => {
  expect(resolveTransactionRange(CUSTOM_TRANSACTION_PERIOD, TODAY, "", "")).toEqual({
    from: undefined,
    to: TODAY,
  });
});
