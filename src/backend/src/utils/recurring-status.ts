export type RecurringRuleEndState = {
  endMode: "NEVER" | "AFTER_OCCURRENCES" | "ON_DATE";
  maxOccurrences: number | null;
  endDate: Date | null;
  occurrencesCount: number;
  nextRunDate: Date;
};

/** Returns the UTC timestamp for a date-only value. */
function utcDayTimestamp(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whether a recurring rule has no occurrence left to generate. */
export function isRecurringEnded(rule: RecurringRuleEndState): boolean {
  if (
    rule.endMode === "AFTER_OCCURRENCES" &&
    rule.maxOccurrences != null &&
    rule.occurrencesCount >= rule.maxOccurrences
  ) {
    return true;
  }

  return (
    rule.endMode === "ON_DATE" &&
    rule.endDate != null &&
    utcDayTimestamp(rule.nextRunDate) > utcDayTimestamp(rule.endDate)
  );
}

/** Removes ended rules while preserving rules that were only paused manually. */
export function filterUnfinishedRecurringRules<T extends RecurringRuleEndState>(rules: T[]): T[] {
  return rules.filter((rule) => !isRecurringEnded(rule));
}
