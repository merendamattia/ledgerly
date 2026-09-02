import { createHash } from "node:crypto";
import { z } from "zod";

const normalizedTransactionSchema = z.object({
  amount: z.number().positive().max(1_000_000_000_000),
  direction: z.enum(["INCOME", "EXPENSE"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().min(1).max(280),
  categoryId: z.string().nullable(),
});

const responseSchema = z.object({
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string().optional(),
            refusal: z.string().optional(),
          }).passthrough(),
        )
        .optional(),
    }).passthrough(),
  ),
}).passthrough();

export type WalletCategory = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
};

export type NormalizedWalletTransaction = z.infer<typeof normalizedTransactionSchema>;

/** Normalizes opaque Apple Wallet data through GPT-5.6 Luna Structured Outputs. */
export async function normalizeAppleWalletTransaction(input: {
  userId: string;
  rawPayload: unknown;
  receivedAt: Date;
  baseCurrency: string;
  categories: WalletCategory[];
}): Promise<NormalizedWalletTransaction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT?.trim() || "low";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: reasoningEffort },
      store: false,
      safety_identifier: createHash("sha256").update(input.userId).digest("hex"),
      input: [
        {
          role: "system",
          content:
            "Normalize raw Apple Wallet transaction data into one Ledgerly transaction. Preserve the merchant or useful external description in note. Amount must be positive; direction carries the sign. Use the received date only when the payload has no reliable transaction date. Choose categoryId only from the supplied categories with the same direction. If categorization is uncertain, return null rather than guessing.",
        },
        {
          role: "user",
          content: JSON.stringify({
            receivedAt: input.receivedAt.toISOString(),
            baseCurrency: input.baseCurrency,
            categories: input.categories,
            walletTransaction: input.rawPayload,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ledgerly_wallet_transaction",
          strict: true,
          schema: z.toJSONSchema(normalizedTransactionSchema, { target: "draft-7" }),
        },
      },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
  const parsed = responseSchema.parse(await response.json());
  const content = parsed.output.flatMap((item) => item.content ?? []);
  if (content.some((item) => item.type === "refusal")) throw new Error("OpenAI refused the Wallet payload");
  const text = content.find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no structured Wallet transaction");

  const normalized = normalizedTransactionSchema.parse(JSON.parse(text));
  const category = input.categories.find((candidate) => candidate.id === normalized.categoryId);
  return {
    ...normalized,
    categoryId: category?.kind === normalized.direction ? category.id : null,
  };
}
