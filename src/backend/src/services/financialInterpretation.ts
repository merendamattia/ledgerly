import { createHash } from "node:crypto";
import { z } from "zod";
import type { FinancialForecastPayload } from "./financialForecast.ts";

export const financialInterpretationSchema = z.object({
  summary: z.string().min(1).max(1_500),
  netWorthAnalysis: z.string().min(1).max(1_500),
  cashFlowAnalysis: z.string().min(1).max(1_500),
  investmentAnalysis: z.string().min(1).max(1_500),
  keyDrivers: z.array(z.string().min(1).max(400)).max(6),
  risksAndUncertainty: z.array(z.string().min(1).max(400)).max(6),
  assumptions: z.array(z.string().min(1).max(400)).max(8),
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

export type FinancialInterpretation = z.infer<typeof financialInterpretationSchema>;

function horizonSummaries(payload: FinancialForecastPayload) {
  return [12, 24, 60, 120, 180, 240].map((months) => ({
    months,
    netWorth: payload.series.netWorth[months - 1] ?? null,
    income: payload.series.income[months - 1] ?? null,
    expenses: payload.series.expenses[months - 1] ?? null,
    investments: payload.series.investments[months - 1] ?? null,
    surplus: payload.series.surplus[months - 1] ?? null,
  }));
}

/** Interprets aggregate forecast metrics; it never receives raw transactions. */
export async function interpretFinancialForecast(input: {
  userId: string;
  locale: "en" | "it";
  payload: FinancialForecastPayload;
}): Promise<FinancialInterpretation> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT?.trim() || "low";
  const language = input.locale === "it" ? "Italian" : "English";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      reasoning: { effort: reasoningEffort },
      store: false,
      safety_identifier: createHash("sha256").update(input.userId).digest("hex"),
      input: [
        {
          role: "system",
          content:
            `Interpret Ledgerly's already-calculated Monte Carlo forecast in ${language}. ` +
            "Use only the supplied numbers; do not recalculate, add figures, or provide prescriptive buy/sell advice. Explain scenarios, drivers, assumptions, and compounding uncertainty in a concise, cautious tone. This is not financial advice.",
        },
        {
          role: "user",
          content: JSON.stringify({
            currency: input.payload.baseCurrency,
            current: input.payload.current,
            summary: input.payload.summary,
            assumptions: input.payload.assumptions,
            horizons: horizonSummaries(input.payload),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ledgerly_financial_interpretation",
          strict: true,
          schema: z.toJSONSchema(financialInterpretationSchema, { target: "draft-7" }),
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
  const parsed = responseSchema.parse(await response.json());
  const content = parsed.output.flatMap((item) => item.content ?? []);
  if (content.some((item) => item.type === "refusal")) {
    throw new Error("OpenAI refused the financial interpretation");
  }
  const text = content.find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no financial interpretation");
  return financialInterpretationSchema.parse(JSON.parse(text));
}
