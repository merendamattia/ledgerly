import { afterAll, expect, test } from "bun:test";
import { normalizeAppleWalletTransaction } from "./appleWalletNormalizer.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalModel;
});

test("uses the configured OpenAI model, cleans Wallet slogans, and rejects invented categories", async () => {
  process.env.OPENAI_API_KEY = "opaque-test-key";
  process.env.OPENAI_MODEL = "configured-wallet-model";
  globalThis.fetch = (async (
    _input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ) => {
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
    expect(body.input[0].content).toContain("merchant context");
    expect(body.input[0].content).toContain("spesa intelligente");
    expect(body.input[0].content).toContain("return null");

    return new Response(JSON.stringify({
      model: "configured-wallet-model",
      usage: { input_tokens: 41, output_tokens: 17, total_tokens: 58 },
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            amount: 12.5,
            direction: "EXPENSE",
            date: "2026-09-01",
            note: "Eurospin",
            categoryId: "invented-category",
          }),
        }],
      }],
    }));
  }) as unknown as typeof fetch;

  const result = await normalizeAppleWalletTransaction({
    userId: "test-user",
    rawPayload: { merchant: "Eurospin, spesa intelligente", amount: "12,50 EUR" },
    receivedAt: new Date("2026-09-01T12:00:00.000Z"),
    baseCurrency: "EUR",
    categories: [{ id: "dining", name: "Eating out", kind: "EXPENSE" }],
  });

  expect(result.note).toBe("Eurospin");
  expect(result.categoryId).toBeNull();
  expect(result.model).toBe("configured-wallet-model");
  expect(result.usage).toEqual({ inputTokens: 41, outputTokens: 17, totalTokens: 58 });
});

test("returns the concise AI note without losing useful merchant context", async () => {
  process.env.OPENAI_API_KEY = "opaque-test-key";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({
      model: "configured-wallet-model",
      usage: { input_tokens: 29, output_tokens: 12, total_tokens: 41 },
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            amount: 48,
            direction: "EXPENSE",
            date: "2026-09-02",
            note: "Hotel Milano — Terminal 2",
            categoryId: null,
          }),
        }],
      }],
    }))) as unknown as typeof fetch;

  const result = await normalizeAppleWalletTransaction({
    userId: "test-user",
    rawPayload: { merchant: "Hotel Milano", description: "Terminal 2" },
    receivedAt: new Date("2026-09-02T12:00:00.000Z"),
    baseCurrency: "EUR",
    categories: [],
  });

  expect(result.note).toBe("Hotel Milano — Terminal 2");
  expect(result.usage.totalTokens).toBe(41);
});
