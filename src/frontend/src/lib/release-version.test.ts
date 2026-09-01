import { expect, test } from "bun:test";
import { shouldShowReleaseAnnouncement } from "./release-version";

test("shows an unacknowledged release", () => {
  expect(shouldShowReleaseAnnouncement("2.1.3", null)).toBe(true);
});

test("compares release versions semantically", () => {
  expect(shouldShowReleaseAnnouncement("2.10.0", "2.9.9")).toBe(true);
});

test("does not reopen an equal or rolled-back release", () => {
  expect(shouldShowReleaseAnnouncement("2.1.3", "2.1.3")).toBe(false);
  expect(shouldShowReleaseAnnouncement("2.1.0", "2.1.3")).toBe(false);
});

test("treats an invalid stored version as unacknowledged", () => {
  expect(shouldShowReleaseAnnouncement("2.1.3", "not-a-release")).toBe(true);
});
