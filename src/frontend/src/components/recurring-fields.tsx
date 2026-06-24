"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { occurrenceDates, type RecurEndMode, type RecurInterval } from "@/lib/recurring";
import { formatDate } from "@/lib/format";

const UNIT_LABELS: Record<RecurInterval, string> = { DAY: "Days", WEEK: "Weeks", MONTH: "Months" };
const END_LABELS: Record<RecurEndMode, string> = {
  NEVER: "Never",
  AFTER_OCCURRENCES: "After N occurrences",
  ON_DATE: "On a date",
};

export interface RecurringFieldsState {
  startDate: string;
  intervalUnit: RecurInterval;
  setIntervalUnit: (v: RecurInterval) => void;
  intervalCount: string;
  setIntervalCount: (v: string) => void;
  endMode: RecurEndMode;
  setEndMode: (v: RecurEndMode) => void;
  maxOccurrences: string;
  setMaxOccurrences: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}

// Cadence + end-condition inputs with a live preview of the dates that will be
// booked. Shared by the standalone recurring dialog and the "make it recurring"
// toggle in the Add-transaction drawer. The start date lives in the host form.
export function RecurringFields(s: RecurringFieldsState) {
  const preview = useMemo(
    () =>
      occurrenceDates(
        {
          startDate: s.startDate,
          intervalUnit: s.intervalUnit,
          intervalCount: Number(s.intervalCount) || 0,
          endMode: s.endMode,
          maxOccurrences: s.endMode === "AFTER_OCCURRENCES" ? Number(s.maxOccurrences) || null : null,
          endDate: s.endMode === "ON_DATE" ? s.endDate || null : null,
        },
        12,
      ),
    [s.startDate, s.intervalUnit, s.intervalCount, s.endMode, s.maxOccurrences, s.endDate],
  );

  return (
    <>
      <Field>
        <FieldLabel>Repeat every</FieldLabel>
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            className="w-24"
            value={s.intervalCount}
            onChange={(e) => s.setIntervalCount(e.target.value)}
            required
          />
          <Select
            value={s.intervalUnit}
            items={UNIT_LABELS}
            onValueChange={(v) => s.setIntervalUnit((v ?? "MONTH") as RecurInterval)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(UNIT_LABELS) as RecurInterval[]).map((u) => (
                <SelectItem key={u} value={u}>
                  {UNIT_LABELS[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Field>

      <Field>
        <FieldLabel>Ends</FieldLabel>
        <Select
          value={s.endMode}
          items={END_LABELS}
          onValueChange={(v) => s.setEndMode((v ?? "NEVER") as RecurEndMode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(END_LABELS) as RecurEndMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {END_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {s.endMode === "AFTER_OCCURRENCES" ? (
        <Field>
          <FieldLabel htmlFor="rec-max">Number of occurrences</FieldLabel>
          <Input
            id="rec-max"
            type="number"
            min="1"
            value={s.maxOccurrences}
            onChange={(e) => s.setMaxOccurrences(e.target.value)}
            required
          />
        </Field>
      ) : null}

      {s.endMode === "ON_DATE" ? (
        <Field>
          <FieldLabel htmlFor="rec-end">End date</FieldLabel>
          <Input
            id="rec-end"
            type="date"
            value={s.endDate}
            onChange={(e) => s.setEndDate(e.target.value)}
            required
          />
        </Field>
      ) : null}

      <div className="rounded-xl border bg-secondary/40 p-4">
        <p className="text-xs font-semibold text-muted-foreground">
          Upcoming bookings{s.endMode === "NEVER" ? " (next 12)" : ""}
        </p>
        {preview.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Set a cadence to preview dates.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {preview.map((d) => (
              <li key={d.toISOString()} className="rounded-md bg-card px-2 py-0.5 font-mono text-xs tabular-nums">
                {formatDate(d)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// Validate the end-condition inputs; returns an error message or null.
export function validateRecurring(
  endMode: RecurEndMode,
  maxOccurrences: string,
  endDate: string,
): string | null {
  if (endMode === "AFTER_OCCURRENCES" && !(Number(maxOccurrences) > 0)) {
    return "Set how many occurrences";
  }
  if (endMode === "ON_DATE" && !endDate) return "Pick an end date";
  return null;
}
