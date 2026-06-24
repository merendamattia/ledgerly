"use client";

import { useMemo } from "react";
import { addTagToNote, extractTags, removeTagFromNote } from "@/lib/tags";
import { useExpenses } from "@/hooks/use-expenses";
import { useRecurringExpenses } from "@/hooks/use-recurring";
import { cn } from "@/lib/utils";

// Tag picker that edits the note string (tags = #hashtags in the note). There's
// no text box: you type #tags directly in the note, and here every existing tag
// is shown as a chip — clicking one toggles it in/out of the note. This keeps it
// clean and lets you reuse tags instead of retyping them.
export function TagInput({
  note,
  onNoteChange,
}: {
  note: string;
  onNoteChange: (next: string) => void;
}) {
  const expenses = useExpenses({ limit: 5000 });
  const recurring = useRecurringExpenses();
  const noteTags = extractTags(note);

  // Distinct tags already used anywhere (notes of movements + recurring rules),
  // excluding ones already in the current note (those render first, as active).
  const suggestions = useMemo(() => {
    const seen = new Set(extractTags(note).map((t) => t.toLowerCase()));
    const out: string[] = [];
    const add = (n?: string | null) => {
      for (const tag of extractTags(n)) {
        const key = tag.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(tag);
        }
      }
    };
    for (const t of expenses.data ?? []) add(t.note);
    for (const r of recurring.data ?? []) add(r.note);
    return out;
  }, [expenses.data, recurring.data, note]);

  const all = [...noteTags, ...suggestions];

  if (all.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Type <span className="font-mono">#name</span> in the note to create a tag.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((tag) => {
        const active = noteTags.some((t) => t.toLowerCase() === tag.toLowerCase());
        return (
          <button
            key={tag.toLowerCase()}
            type="button"
            onClick={() =>
              onNoteChange(active ? removeTagFromNote(note, tag) : addTagToNote(note, tag))
            }
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-muted",
            )}
          >
            #{tag}
          </button>
        );
      })}
    </div>
  );
}

// Read-only tag chips for list rows / detail views. Optional onTagClick wires a
// chip to the search (so tapping it filters the movements by that tag).
export function TagChips({
  note,
  onTagClick,
  className,
}: {
  note?: string | null;
  onTagClick?: (tag: string) => void;
  className?: string;
}) {
  const tags = extractTags(note);
  if (tags.length === 0) return null;
  return (
    <div className={className ?? "flex flex-wrap gap-1"}>
      {tags.map((tag) =>
        onTagClick ? (
          // A real <button> can't be used here: these chips render inside the
          // clickable transaction row (itself a <button>), so use a span with a
          // button role to avoid invalid nested-button hydration errors.
          <span
            key={tag.toLowerCase()}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(tag);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onTagClick(tag);
              }
            }}
            className="cursor-pointer rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-muted"
          >
            #{tag}
          </span>
        ) : (
          <span
            key={tag.toLowerCase()}
            className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
          >
            #{tag}
          </span>
        ),
      )}
    </div>
  );
}
