import { expect, test } from "bun:test";
import { resolvePeriod } from "./periods";

test("resolves an arbitrary historical month and its comparison month", () => {
  expect(resolvePeriod("2023-02", new Date(2026, 7, 27))).toEqual({
    from: "2023-02-01",
    to: "2023-02-28",
    prevFrom: "2023-01-01",
    prevTo: "2023-01-31",
    label: "February 2023",
    prevLabel: "January 2023",
    kind: "month",
  });
});
