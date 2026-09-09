import { afterAll, expect, test } from "bun:test";
import { normalizeAppleWalletTransaction } from "./appleWalletNormalizer.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

test("uses the configured OpenAI model and effort with a strict schema and rejects invented categories", async () => {
  process.env.OPENAI_API_KEY = "opaque-test-key";
  globalThis.fetch = (async (_input, init) => {
    const headers = init?.headers as Record<string, string>;
    const body = JSON.parse(String(init?.body));
    expect(headers.Authorization).toBe("Bearer opaque-test-key");
    expect(body.model).toBe(process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna");
    expect(body.reasoning).toEqual({
      effort: process.env.OPENAI_REASONING_EFFORT?.trim() || "low",
    });
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.required).toContain("sourceCurrency");
    expect(body.text.format.schema.properties.sourceCurrency.pattern).toBe("^[A-Z]{3}$");

    return new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            amount: 12.5,
            sourceCurrency: "EUR",
            direction: "EXPENSE",
            date: "2026-09-01",
            note: "Caffè Roma",
            categoryId: "invented-category",
          }),
        }],
      }],
    }));
  }) as typeof fetch;

  const result = await normalizeAppleWalletTransaction({
    userId: "test-user",
    rawPayload: { merchant: "Caffè Roma", amount: "12,50 EUR" },
    receivedAt: new Date("2026-09-01T12:00:00.000Z"),
    baseCurrency: "EUR",
    categories: [{ id: "dining", name: "Eating out", kind: "EXPENSE" }],
  });

  expect(result).toMatchObject({ categoryId: null, sourceCurrency: "EUR" });
});

test("keeps a currency resolved from an ambiguous symbol's Wallet context", async () => {
  process.env.OPENAI_API_KEY = "opaque-test-key";
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    const userInput = JSON.parse(body.input[1].content);
    expect(userInput.baseCurrency).toBe("EUR");
    expect(userInput.walletTransaction).toEqual({
      amount: "$10.00",
      currencySymbol: "$",
      merchantCountry: "CA",
    });
    expect(body.input[0].content).toContain("sourceCurrency");

    return new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            amount: 10,
            sourceCurrency: "CAD",
            direction: "EXPENSE",
            date: "2026-09-01",
            note: "Canadian merchant",
            categoryId: null,
          }),
        }],
      }],
    }));
  }) as typeof fetch;

  const result = await normalizeAppleWalletTransaction({
    userId: "test-user",
    rawPayload: {
      amount: "$10.00",
      currencySymbol: "$",
      merchantCountry: "CA",
    },
    receivedAt: new Date("2026-09-01T12:00:00.000Z"),
    baseCurrency: "EUR",
    categories: [],
  });

  expect(result.sourceCurrency).toBe("CAD");
});

test("rejects structured Wallet output that omits the source currency", async () => {
  process.env.OPENAI_API_KEY = "opaque-test-key";
  globalThis.fetch = (async (_input, _init) => new Response(JSON.stringify({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify({
          amount: 12.5,
          direction: "EXPENSE",
          date: "2026-09-01",
          note: "Missing currency",
          categoryId: null,
        }),
      }],
    }],
  }))) as typeof fetch;

  await expect(
    normalizeAppleWalletTransaction({
      userId: "test-user",
      rawPayload: { amount: "12.50 EUR" },
      receivedAt: new Date("2026-09-01T12:00:00.000Z"),
      baseCurrency: "EUR",
      categories: [],
    }),
  ).rejects.toThrow();
});
