import { expect, test } from "bun:test";
import { stableJson } from "./stable-json.ts";

test("stableJson ignores object key order without changing arrays", () => {
  expect(stableJson({ merchant: "Bar", details: { amount: 4, currency: "EUR" } })).toBe(
    stableJson({ details: { currency: "EUR", amount: 4 }, merchant: "Bar" }),
  );
  expect(stableJson({ values: [1, 2] })).not.toBe(stableJson({ values: [2, 1] }));
});
