"use client";

import type { ReactNode } from "react";
import { groupByDay } from "@/lib/format";
import { cn } from "@/lib/utils";

// The divider stays attached to the previous day's last row (a row `border-b`);
// the gap is top padding on the next group, so the order reads: previous rows →
// divider → whitespace → date → that day's rows. Padding lives on the group
// wrapper (not the header) so `first:` targets only the first group, which sits
// tight under the card title.
const GROUP = "pt-5 first:pt-0";
const HEADER = "pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
// Each row: soft round icon + texts + trailing figure. `text-sm` here sizes the
// whole row (including the amount) consistently.
const ROW = "flex w-full items-center gap-3 py-3 text-left text-sm";

/**
 * Renders a flat list of movements bucketed into day groups (newest-first),
 * each under an uppercase date header. Every row carries an inset bottom divider
 * except the very last, so a day's separator sits against its last row; the gap
 * before the next date comes from the group's top padding (see GROUP).
 *
 * Horizontal padding is intentionally left to the caller's container so the
 * dividers inset to its content box (card `p-5`, or a `px-5` wrapper). Pass
 * `onItemClick` to make rows clickable (renders a `<button>`); omit it for a
 * static list (renders a `<div>`).
 */
export function DayGroupedList<T>({
  items,
  getKey,
  getDate,
  renderItem,
  onItemClick,
}: {
  items: T[];
  getKey: (item: T) => string;
  getDate: (item: T) => string | Date;
  renderItem: (item: T) => ReactNode;
  onItemClick?: (item: T) => void;
}) {
  const groups = groupByDay(items, getDate);
  return (
    <div>
      {groups.map((group, gi) => (
        <div key={group.key} className={GROUP}>
          <p className={HEADER}>{group.label}</p>
          {group.items.map((item, ri) => {
            const isLast = gi === groups.length - 1 && ri === group.items.length - 1;
            const className = cn(
              ROW,
              !isLast && "border-b",
              onItemClick && "transition-colors hover:bg-muted/50",
            );
            return onItemClick ? (
              <button
                key={getKey(item)}
                type="button"
                onClick={() => onItemClick(item)}
                className={className}
              >
                {renderItem(item)}
              </button>
            ) : (
              <div key={getKey(item)} className={className}>
                {renderItem(item)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
