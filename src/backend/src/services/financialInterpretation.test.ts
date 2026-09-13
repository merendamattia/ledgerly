import { expect, test } from "bun:test";
import { financialInterpretationSchema } from "./financialInterpretation.ts";

test("financial interpretation requires the complete structured contract", () => {
  const valid = {
    summary: "A cautious summary.",
    netWorthAnalysis: "Net worth range.",
    cashFlowAnalysis: "Cash-flow range.",
    investmentAnalysis: "Portfolio range.",
    keyDrivers: ["Savings"],
    risksAndUncertainty: ["History is sparse"],
    assumptions: ["Debts stay flat"],
  };

  expect(financialInterpretationSchema.parse(valid)).toEqual(valid);
  expect(() => financialInterpretationSchema.parse({ summary: "Incomplete" })).toThrow();
});
