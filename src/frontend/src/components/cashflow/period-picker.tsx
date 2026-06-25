"use client";

import { Calendar, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Period } from "./periods";

/**
 * Renders the calendar-style period selector used by the cashflow topbar.
 */
export function PeriodPicker({
  value,
  label,
  options,
  onChange,
  triggerClassName,
}: {
  value: Period;
  label: string;
  options: { value: Period; label: string }[];
  onChange: (value: Period) => void;
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-card transition-colors hover:border-muted-foreground/40 sm:w-auto sm:min-w-[208px]",
              triggerClassName,
            )}
          >
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-left">{label}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[224px] p-1.5">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as Period)}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="py-2 text-sm font-medium">
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
