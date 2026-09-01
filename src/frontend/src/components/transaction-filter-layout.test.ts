import { expect, test } from "bun:test";
import {
  TRANSACTION_DATE_INPUT_CLASS,
  TRANSACTION_FILTERS_CLASS,
  TRANSACTION_FILTER_TAB_CLASS,
} from "./transaction-filter-layout";

test("keeps full transaction filter labels without overflowing", () => {
  expect(TRANSACTION_FILTERS_CLASS).toContain("w-max");
  expect(TRANSACTION_FILTERS_CLASS).toContain("max-w-full");
  expect(TRANSACTION_FILTERS_CLASS).toContain("overflow-x-auto");
  expect(TRANSACTION_FILTER_TAB_CLASS).toContain("shrink-0");
  expect(TRANSACTION_FILTER_TAB_CLASS).toContain("whitespace-nowrap");
});

test("keeps transaction date inputs at 16px on mobile", () => {
  expect(TRANSACTION_DATE_INPUT_CLASS).toContain("text-base");
  expect(TRANSACTION_DATE_INPUT_CLASS).not.toContain("text-sm");
});
