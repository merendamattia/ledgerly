import { expect, test } from "bun:test";
import { extractTags } from "./tags.ts";

test("extractTags returns distinct hashtag names in note order", () => {
  expect(extractTags("Trip #Rome food #rome #Budget-2026 #caffè")).toEqual([
    "Rome",
    "Budget-2026",
    "caffè",
  ]);
});

test("extractTags handles empty notes", () => {
  expect(extractTags(null)).toEqual([]);
  expect(extractTags("plain note")).toEqual([]);
});
