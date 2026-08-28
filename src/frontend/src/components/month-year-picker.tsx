"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const MIN_YEAR = 1900;

function selectedMonth(value: string, fallback: Date): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match
    ? { year: Number(match[1]), month: Number(match[2]) }
    : { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };
}

/** Selects any calendar month while preserving optional route-specific shortcuts. */
export function MonthYearPicker({
  value,
  label,
  onChange,
  options = [],
  triggerClassName,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  triggerClassName?: string;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const initial = selectedMonth(value, now);
  const [open, setOpen] = useState(false);
  const [yearInput, setYearInput] = useState(String(initial.year));
  const [month, setMonth] = useState(initial.month);
  const year = Number(yearInput);
  const validYear = Number.isInteger(year) && year >= MIN_YEAR && year <= currentYear;

  function handleOpenChange(next: boolean) {
    if (next) {
      const selected = selectedMonth(value, new Date());
      setYearInput(String(selected.year));
      setMonth(selected.month);
    }
    setOpen(next);
  }

  function moveYear(direction: -1 | 1) {
    const nextYear = Math.min(currentYear, Math.max(MIN_YEAR, (validYear ? year : currentYear) + direction));
    setYearInput(String(nextYear));
    if (nextYear === currentYear && month > currentMonth) setMonth(currentMonth);
  }

  function applyMonth() {
    if (!validYear || (year === currentYear && month > currentMonth)) return;
    onChange(`${year}-${String(month).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn("w-full min-w-0 justify-start bg-card sm:w-auto", triggerClassName)}
          />
        }
      >
        <CalendarDays data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDown data-icon="inline-end" className="text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1rem))] gap-4 p-4"
      >
        <PopoverHeader className="pr-8">
          <PopoverTitle className="font-display text-base font-semibold">Choose a period</PopoverTitle>
          <PopoverDescription>Select a shortcut or find any month by year.</PopoverDescription>
        </PopoverHeader>

        {options.length ? (
          <div className="flex flex-wrap gap-1" aria-label="Quick periods">
            {options.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="xs"
                variant={value === option.value ? "secondary" : "ghost"}
                aria-pressed={value === option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); applyMonth(); }}>
          <Field>
            <FieldLabel htmlFor="month-year-search">Year</FieldLabel>
            <InputGroup className="h-10 bg-card">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupButton
                aria-label="Previous year"
                onClick={() => moveYear(-1)}
                disabled={validYear && year <= MIN_YEAR}
              >
                <ChevronLeft />
              </InputGroupButton>
              <InputGroupInput
                id="month-year-search"
                type="search"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={yearInput}
                aria-invalid={!validYear}
                autoComplete="off"
                onChange={(event) => setYearInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <InputGroupButton
                aria-label="Next year"
                onClick={() => moveYear(1)}
                disabled={validYear && year >= currentYear}
              >
                <ChevronRight />
              </InputGroupButton>
            </InputGroup>
          </Field>

          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Month">
            {MONTHS.map((name, index) => {
              const number = index + 1;
              const disabled = !validYear || (year === currentYear && number > currentMonth);
              return (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={number === month ? "secondary" : "ghost"}
                  aria-pressed={number === month}
                  disabled={disabled}
                  onClick={() => setMonth(number)}
                >
                  {name.slice(0, 3)}
                </Button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">Press Enter to apply</p>
            <Button type="submit" size="sm" disabled={!validYear || (year === currentYear && month > currentMonth)}>
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
