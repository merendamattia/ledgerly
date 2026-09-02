import { expect, test } from "bun:test";
import { buildUserSettingsDefaults } from "./userProvisioning.ts";

test("builds an owned settings snapshot from the current defaults", () => {
  const source = {
    baseCurrency: "USD",
    locale: "it",
    categories: [
      { name: "Salary", kind: "INCOME" as const, emoji: "💼" },
      { name: "Rent", kind: "EXPENSE" as const, emoji: "🏠" },
    ],
  };

  const snapshot = buildUserSettingsDefaults(source);

  expect(snapshot).toEqual({ baseCurrency: source.baseCurrency, categories: source.categories });
  expect(snapshot).not.toBe(source);
  expect(snapshot.categories).not.toBe(source.categories);
  expect(snapshot.categories[0]).not.toBe(source.categories[0]);
});
