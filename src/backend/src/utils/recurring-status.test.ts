import { expect, test } from "bun:test";
import {
  filterUnfinishedRecurringRules,
  isRecurringEnded,
  type RecurringRuleEndState,
} from "./recurring-status.ts";

const rule = (overrides: Partial<RecurringRuleEndState> = {}): RecurringRuleEndState => ({
  endMode: "NEVER",
  maxOccurrences: null,
  endDate: null,
  occurrencesCount: 0,
  nextRunDate: new Date("2026-01-01"),
  ...overrides,
});

test("a rule ends after its configured number of occurrences", () => {
  expect(
    isRecurringEnded(
      rule({ endMode: "AFTER_OCCURRENCES", maxOccurrences: 3, occurrencesCount: 2 }),
    ),
  ).toBe(false);
  expect(
    isRecurringEnded(
      rule({ endMode: "AFTER_OCCURRENCES", maxOccurrences: 3, occurrencesCount: 3 }),
    ),
  ).toBe(true);
});

test("a rule ends once its next occurrence is after the end date", () => {
  expect(
    isRecurringEnded(
      rule({
        endMode: "ON_DATE",
        endDate: new Date("2026-01-31"),
        nextRunDate: new Date("2026-01-31"),
      }),
    ),
  ).toBe(false);
  expect(
    isRecurringEnded(
      rule({
        endMode: "ON_DATE",
        endDate: new Date("2026-01-31"),
        nextRunDate: new Date("2026-02-01"),
      }),
    ),
  ).toBe(true);
});

test("filtering removes ended rules but keeps manually paused rules", () => {
  const paused = { ...rule(), enabled: false };
  const endedByCount = {
    ...rule({ endMode: "AFTER_OCCURRENCES", maxOccurrences: 2, occurrencesCount: 2 }),
    enabled: false,
  };
  const endedByDate = {
    ...rule({
      endMode: "ON_DATE",
      endDate: new Date("2026-01-31"),
      nextRunDate: new Date("2026-02-01"),
    }),
    enabled: false,
  };

  expect(filterUnfinishedRecurringRules([paused, endedByCount, endedByDate])).toEqual([paused]);
});
