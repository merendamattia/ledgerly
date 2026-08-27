"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { TagInput } from "@/components/tag-input";
import { CategoryPicker } from "@/components/add-transaction-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RecurringFields, validateRecurring } from "@/components/recurring-fields";
import { useCategories } from "@/hooks/use-categories";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCreateRecurringExpense,
  useDeleteRecurringExpense,
  useUpdateRecurringExpense,
  type RecurringExpense,
} from "@/hooks/use-recurring";
import { type RecurEndMode, type RecurInterval } from "@/lib/recurring";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

type Direction = "INCOME" | "EXPENSE";

const DIRECTION_OPTIONS = [
  { value: "EXPENSE" as const, label: "Expense", icon: ArrowUpRight },
  { value: "INCOME" as const, label: "Income", icon: ArrowDownLeft },
];

/** Renders the income/expense segmented control used by recurring forms. */
function Segment({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (v: Direction) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {DIRECTION_OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Renders the sheet used to create, edit, or delete a recurring movement. */
export function RecurringExpenseDialog({
  rule,
  trigger,
}: {
  rule?: RecurringExpense;
  trigger?: ReactElement;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button>
              <Plus data-icon="inline-start" />
              New recurring
            </Button>
          )
        }
      />
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex w-full flex-col gap-0 p-0 data-[side=bottom]:h-[92dvh] data-[side=right]:w-[88%] sm:max-w-xl"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle className="font-display text-xl font-semibold tracking-tight">
            {rule ? "Edit recurring" : "New recurring"}
          </SheetTitle>
          <SheetDescription>
            A movement booked automatically on a fixed cadence.
          </SheetDescription>
        </SheetHeader>
        {/* Remount per rule so the form re-seeds from props. */}
        <RecurringForm key={rule?.id ?? "new"} rule={rule} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

/** Renders the recurring movement form, seeded from an optional existing rule. */
function RecurringForm({ rule, onDone }: { rule?: RecurringExpense; onDone: () => void }) {
  const [direction, setDirection] = useState<Direction>(rule?.direction ?? "EXPENSE");
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [amount, setAmount] = useState(rule ? String(rule.amount) : "");
  const [note, setNote] = useState(rule?.note ?? "");
  const [intervalUnit, setIntervalUnit] = useState<RecurInterval>(rule?.intervalUnit ?? "MONTH");
  const [intervalCount, setIntervalCount] = useState(rule ? String(rule.intervalCount) : "1");
  const [startDate, setStartDate] = useState(rule ? rule.startDate.slice(0, 10) : todayISO());
  const [endMode, setEndMode] = useState<RecurEndMode>(rule?.endMode ?? "NEVER");
  const [maxOccurrences, setMaxOccurrences] = useState(
    rule?.maxOccurrences != null ? String(rule.maxOccurrences) : "12",
  );
  const [endDate, setEndDate] = useState(rule?.endDate ? rule.endDate.slice(0, 10) : "");

  const categories = useCategories(direction);
  const create = useCreateRecurringExpense();
  const update = useUpdateRecurringExpense();
  const del = useDeleteRecurringExpense();
  const submitting = create.isPending || update.isPending;

  /** Validates and persists the recurring movement rule. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateRecurring(endMode, maxOccurrences, endDate);
    if (err) {
      toast.error(err);
      return;
    }
    const payload = {
      categoryId: categoryId || null,
      amount: Number(amount),
      direction,
      note: note || null,
      intervalUnit,
      intervalCount: Number(intervalCount),
      startDate,
      endMode,
      maxOccurrences: endMode === "AFTER_OCCURRENCES" ? Number(maxOccurrences) : null,
      endDate: endMode === "ON_DATE" ? endDate : null,
    };
    const onSettled = {
      onSuccess: () => {
        toast.success(rule ? "Recurring updated" : "Recurring created");
        onDone();
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (rule) update.mutate({ id: rule.id, ...payload }, onSettled);
    else create.mutate(payload, onSettled);
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <FieldGroup className="flex-1 overflow-y-auto px-6 py-5">
        <Field>
          <FieldLabel>Type</FieldLabel>
          <Segment
            value={direction}
            onChange={(v) => {
              setDirection(v);
              setCategoryId("");
            }}
          />
        </Field>

        <Field>
          <FieldLabel>Category</FieldLabel>
          <CategoryPicker
            categories={categories.data ?? []}
            isLoading={categories.isLoading}
            value={categoryId}
            onChange={setCategoryId}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="rec-amount">Amount</FieldLabel>
          <Input
            id="rec-amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="rec-start">Start date</FieldLabel>
          <Input
            id="rec-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>

        <RecurringFields
          startDate={startDate}
          intervalUnit={intervalUnit}
          setIntervalUnit={setIntervalUnit}
          intervalCount={intervalCount}
          setIntervalCount={setIntervalCount}
          endMode={endMode}
          setEndMode={setEndMode}
          maxOccurrences={maxOccurrences}
          setMaxOccurrences={setMaxOccurrences}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="rec-note">Note</FieldLabel>
            <Textarea id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Tags</FieldLabel>
            <TagInput note={note} onNoteChange={setNote} />
          </Field>
        </FieldGroup>
      </FieldGroup>

      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-card/95 px-6 py-4 backdrop-blur-sm">
        {rule ? (
          <ConfirmDialog
            title="Delete recurring?"
            description="This stops future bookings. Movements already created stay."
            confirmLabel="Delete"
            onConfirm={() =>
              del.mutate(rule.id, {
                onSuccess: () => {
                  toast.success("Deleted");
                  onDone();
                },
                onError: (e) => toast.error(e.message),
              })
            }
            trigger={
              <Button type="button" variant="outline" size="lg" aria-label="Delete recurring">
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            }
          />
        ) : null}
        <Button type="submit" size="lg" className="flex-1" disabled={submitting || !amount}>
          {rule ? "Save changes" : "Create recurring"}
        </Button>
      </div>
    </form>
  );
}
