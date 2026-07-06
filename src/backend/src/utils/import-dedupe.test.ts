import { expect, test } from "bun:test";
import { importDayRange, isoDay } from "./import-dedupe.ts";

test("isoDay formats dates as the import duplicate-key day", () => {
  expect(isoDay(new Date("2024-03-02T18:30:00.000Z"))).toBe("2024-03-02");
});

test("importDayRange spans whole UTC days for timestamped import rows", () => {
  expect(
    importDayRange([
      new Date("2024-03-02T18:30:00.000Z"),
      new Date("2024-03-01T12:15:00.000Z"),
    ]),
  ).toEqual({
    from: new Date("2024-03-01T00:00:00.000Z"),
    to: new Date("2024-03-02T23:59:59.999Z"),
  });
});

test("importDayRange returns null for an empty import batch", () => {
  expect(importDayRange([])).toBeNull();
});
