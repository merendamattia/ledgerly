import { normalizeAppleWalletTransaction } from "../src/services/appleWalletNormalizer.ts";

const categoryId = "check-dining";
const result = await normalizeAppleWalletTransaction({
  userId: "apple-wallet-openai-check",
  rawPayload: {
    merchant: "Caffè Roma",
    amount: "12,50 EUR",
    transactionDate: "2026-09-01",
    card: "Visa",
  },
  receivedAt: new Date("2026-09-01T12:00:00.000Z"),
  baseCurrency: "EUR",
  categories: [{ id: categoryId, name: "Eating out", kind: "EXPENSE" }],
});

if (result.amount !== 12.5 || result.direction !== "EXPENSE" || result.date !== "2026-09-01") {
  throw new Error("OpenAI returned an unexpected normalized transaction");
}
if (result.categoryId !== null && result.categoryId !== categoryId) {
  throw new Error("OpenAI returned a category outside the supplied list");
}

console.log("OpenAI Apple Wallet structured-output check passed");
