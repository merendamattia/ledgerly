import { expect, test } from "bun:test";
import { visibleSecondaryNavItems } from "./app-navigation";

test("normal users only see non-admin secondary navigation", () => {
  const hrefs = visibleSecondaryNavItems("user").map((item) => item.href);
  expect(hrefs).toContain("/analysis");
  expect(hrefs).not.toContain("/database");
  expect(hrefs).not.toContain("/dev");
});

test("administrators see the database and developer navigation", () => {
  const hrefs = visibleSecondaryNavItems("admin").map((item) => item.href);
  expect(hrefs).toContain("/database");
  expect(hrefs).toContain("/dev");
  expect(hrefs).toContain("/analysis");
});
