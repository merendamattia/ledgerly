import { expect, test } from "bun:test";
import {
  SEGMENTED_CONTROL_CLASS,
  SEGMENTED_CONTROL_EQUAL_WIDTH_CLASS,
  SEGMENTED_CONTROL_EQUAL_WIDTH_ITEM_CLASS,
  SEGMENTED_CONTROL_ITEM_CLASS,
} from "./segmented-control";
import { cn } from "../lib/utils";

test("segmented controls keep localized labels visible", () => {
  expect(SEGMENTED_CONTROL_CLASS).toContain("w-max");
  expect(SEGMENTED_CONTROL_CLASS).toContain("max-w-full");
  expect(SEGMENTED_CONTROL_CLASS).toContain("overflow-x-auto");
  expect(SEGMENTED_CONTROL_ITEM_CLASS).toContain("shrink-0");
  expect(SEGMENTED_CONTROL_ITEM_CLASS).toContain("whitespace-nowrap");
});

test("equal-width segmented controls fit narrow cards and retain the desktop layout", () => {
  const controlClass = cn(SEGMENTED_CONTROL_CLASS, SEGMENTED_CONTROL_EQUAL_WIDTH_CLASS);
  const itemClass = cn(SEGMENTED_CONTROL_ITEM_CLASS, SEGMENTED_CONTROL_EQUAL_WIDTH_ITEM_CLASS);

  expect(controlClass).toContain("grid-cols-2");
  expect(controlClass).toContain("w-full");
  expect(controlClass).toContain("overflow-hidden");
  expect(controlClass).toContain("sm:inline-flex");
  expect(controlClass).toContain("sm:w-auto");
  expect(controlClass).not.toContain("overflow-x-auto");
  expect(itemClass).toContain("min-w-0");
  expect(itemClass).toContain("w-full");
  expect(itemClass).toContain("sm:w-auto");
});
