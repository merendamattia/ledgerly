import { expect, test } from "bun:test";
import { transactionPushCopy } from "./webPush.ts";

test("formats the expense push copy in the user's locale", () => {
  expect(
    transactionPushCopy({ amount: 12.5, currency: "EUR", direction: "EXPENSE", locale: "it" }),
  ).toEqual({
    title: "Nuova spesa aggiunta",
    body: "È stata aggiunta una nuova spesa da 12,50 €. Clicca per aggiungere la categoria.",
  });
  expect(
    transactionPushCopy({ amount: 12.5, currency: "EUR", direction: "EXPENSE", locale: "en" }),
  ).toEqual({
    title: "New expense added",
    body: "A new expense of €12.50 was added. Click to add a category.",
  });
});
