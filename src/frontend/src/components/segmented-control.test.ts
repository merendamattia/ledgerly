import { expect, test } from "bun:test";
import { SEGMENTED_CONTROL_CLASS, SEGMENTED_CONTROL_ITEM_CLASS } from "./segmented-control";

test("segmented controls keep localized labels visible", () => {
  expect(SEGMENTED_CONTROL_CLASS).toContain("w-max");
  expect(SEGMENTED_CONTROL_CLASS).toContain("max-w-full");
  expect(SEGMENTED_CONTROL_CLASS).toContain("overflow-x-auto");
  expect(SEGMENTED_CONTROL_ITEM_CLASS).toContain("shrink-0");
  expect(SEGMENTED_CONTROL_ITEM_CLASS).toContain("whitespace-nowrap");
});
