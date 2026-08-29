import { expect, test } from "bun:test";
import { visibleSecondaryNavItems } from "./app-navigation";

test("normal users only see non-admin secondary navigation", () => {
  expect(visibleSecondaryNavItems("user").map((item) => item.href)).not.toContain("/database");
  expect(visibleSecondaryNavItems("user").map((item) => item.href)).not.toContain("/dev");
});

test("administrators see the database and developer navigation", () => {
  const hrefs = visibleSecondaryNavItems("admin").map((item) => item.href);
  expect(hrefs).toContain("/database");
  expect(hrefs).toContain("/dev");
});
