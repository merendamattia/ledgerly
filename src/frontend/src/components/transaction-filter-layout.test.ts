import { expect, test } from "bun:test";
import {
  TRANSACTION_DATE_INPUT_CLASS,
  TRANSACTION_FILTERS_CLASS,
  TRANSACTION_FILTER_TAB_CLASS,
} from "./transaction-filter-layout";

test("keeps transaction filters contained at a 320px viewport", () => {
  expect(TRANSACTION_FILTERS_CLASS).toContain("grid-cols-2");
  expect(TRANSACTION_FILTERS_CLASS).toContain("sm:inline-flex");
  expect(TRANSACTION_FILTER_TAB_CLASS).toContain("min-w-0");
  expect(TRANSACTION_FILTER_TAB_CLASS).toContain("whitespace-nowrap");
});

test("keeps transaction date inputs at 16px on mobile", () => {
  expect(TRANSACTION_DATE_INPUT_CLASS).toContain("text-base");
  expect(TRANSACTION_DATE_INPUT_CLASS).not.toContain("text-sm");
});
