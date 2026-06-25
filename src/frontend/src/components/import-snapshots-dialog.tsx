"use client";

import { useMemo, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/use-accounts";
import { useDebts } from "@/hooks/use-debts";
import {
  useParseSnapshotImport,
  useCommitSnapshotImport,
  type SnapshotParseResp,
  type SnapshotImportColumn,
} from "@/hooks/use-snapshot-import";

// Per-column UI choice. `target` is "skip" | "create" | "cash:<id>" | "debt:<id>".
interface ColumnChoice {
  target: string;
  // Used only when target === "create":
  name: string;
  kind: "LIQUIDITY" | "CREDIT" | "OTHER_ASSET" | "DEBT";
  currency: string;
}

const KIND_LABELS: Record<ColumnChoice["kind"], string> = {
  LIQUIDITY: "Liquidity",
  CREDIT: "Credit",
  OTHER_ASSET: "Other asset",
  DEBT: "Debt",
};

const DATE_HINT = /\b(date|data|giorno)\b/i;

/**
 * Renders the wide-file snapshot importer with per-column account/debt mapping.
 *
 * `lockedKind` scopes the import to one snapshot type and hides the kind picker.
 */
export function ImportSnapshotsDialog({
  trigger,
  lockedKind,
}: {
  trigger?: ReactElement;
  lockedKind?: ColumnChoice["kind"];
}) {
  const [open, setOpen] = useState(false);
  const accounts = useAccounts();
  const debts = useDebts();
  const parse = useParseSnapshotImport();
  const commit = useCommitSnapshotImport();

  const [parsed, setParsed] = useState<SnapshotParseResp | null>(null);
  const [dateColumn, setDateColumn] = useState(0);
  const [choices, setChoices] = useState<Record<number, ColumnChoice>>({});

  const existingOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (lockedKind !== "DEBT") {
      for (const a of accounts.data ?? []) {
        if (lockedKind && a.category !== lockedKind) continue;
        opts.push({ value: `cash:${a.id}`, label: `${a.name} · ${KIND_LABELS[a.category]}` });
      }
    }
    if (!lockedKind || lockedKind === "DEBT") {
      for (const d of debts.data ?? []) {
        opts.push({ value: `debt:${d.id}`, label: `${d.name} · Debt` });
      }
    }
    return opts;
  }, [accounts.data, debts.data, lockedKind]);

  /** Clears parsed file state and column mapping choices. */
  function reset() {
    setParsed(null);
    setChoices({});
    setDateColumn(0);
  }

  /** Parses a snapshot import file and seeds default column mapping choices. */
  async function onFile(file: File) {
    try {
      const res = await parse.mutateAsync(file);
      setParsed(res);
      // Auto-pick the date column from the header, default the rest to "create".
      const dateIdx = res.headers.findIndex((h) => DATE_HINT.test(h));
      const resolvedDate = dateIdx >= 0 ? dateIdx : 0;
      setDateColumn(resolvedDate);
      const defaultKind = lockedKind ?? "LIQUIDITY";
      const next: Record<number, ColumnChoice> = {};
      res.headers.forEach((h, i) => {
        if (i === resolvedDate) return;
        // Auto-match a same-named existing target, scoped to the locked type.
        if (lockedKind === "DEBT") {
          const match = (debts.data ?? []).find((d) => d.name.toLowerCase() === h.toLowerCase());
          next[i] = match
            ? { target: `debt:${match.id}`, name: h, kind: defaultKind, currency: "EUR" }
            : { target: "create", name: h, kind: defaultKind, currency: "EUR" };
          return;
        }
        const match = (accounts.data ?? []).find(
          (a) =>
            a.name.toLowerCase() === h.toLowerCase() &&
            (!lockedKind || a.category === lockedKind),
        );
        next[i] = match
          ? { target: `cash:${match.id}`, name: h, kind: defaultKind, currency: "EUR" }
          : { target: "create", name: h, kind: defaultKind, currency: "EUR" };
      });
      setChoices(next);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  /** Updates one parsed column's import mapping choice. */
  function setChoice(index: number, patch: Partial<ColumnChoice>) {
    setChoices((c) => ({ ...c, [index]: { ...c[index], ...patch } }));
  }

  /** Converts UI mapping choices into the API column-import payload. */
  function buildColumns(): SnapshotImportColumn[] {
    if (!parsed) return [];
    const cols: SnapshotImportColumn[] = [];
    parsed.headers.forEach((_h, index) => {
      if (index === dateColumn) return;
      const ch = choices[index];
      if (!ch || ch.target === "skip") {
        cols.push({ action: "skip", index });
        return;
      }
      if (ch.target === "create") {
        cols.push({
          action: "create",
          index,
          name: ch.name.trim(),
          kind: ch.kind,
          currency: (ch.currency.trim().toUpperCase() || "EUR") as string,
        });
        return;
      }
      const [kind, id] = ch.target.split(":");
      cols.push({ action: "existing", index, kind: kind === "debt" ? "DEBT" : "CASH", id });
    });
    return cols;
  }

  /** Commits the parsed snapshot rows with the configured column mappings. */
  async function submit() {
    if (!parsed) return;
    try {
      const result = await commit.mutateAsync({
        dateColumn,
        columns: buildColumns(),
        rows: parsed.rows,
      });
      toast.success(
        `Imported ${result.snapshotsImported} snapshot(s), created ${result.accountsCreated} account(s)`,
      );
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} row(s) had issues and were skipped`);
      }
      setOpen(false);
      reset();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline">
              <Upload data-icon="inline-start" />
              {lockedKind ? `Import ${KIND_LABELS[lockedKind].toLowerCase()}` : "Import snapshots"}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {lockedKind ? `Import ${KIND_LABELS[lockedKind].toLowerCase()} snapshots` : "Import snapshots"}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV/TSV with a header row: <code>date,account1,account2,…</code>. Map the date
            column and each {lockedKind === "DEBT" ? "debt" : "account"}, then import.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-10 text-center transition-colors hover:bg-secondary">
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {parse.isPending ? "Parsing…" : "Choose a CSV/TSV file"}
            </span>
            <span className="text-xs text-muted-foreground">
              First row: date column + one column per account
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto">
            <Field>
              <FieldLabel>Date column</FieldLabel>
              <select
                value={dateColumn}
                onChange={(e) => setDateColumn(Number(e.target.value))}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {parsed.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Account columns</p>
              {parsed.headers.map((h, i) => {
                if (i === dateColumn) return null;
                const ch = choices[i];
                if (!ch) return null;
                return (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-28 flex-1 truncate text-sm font-medium">
                        {h || `Column ${i + 1}`}
                      </span>
                      <select
                        value={ch.target}
                        onChange={(e) => setChoice(i, { target: e.target.value })}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="create">+ Create new</option>
                        <option value="skip">Skip</option>
                        {existingOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {ch.target === "create" ? (
                      <div
                        className={cn(
                          "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3",
                          lockedKind && "sm:grid-cols-2",
                        )}
                      >
                        <Input
                          placeholder="Name"
                          value={ch.name}
                          onChange={(e) => setChoice(i, { name: e.target.value })}
                        />
                        {lockedKind ? null : (
                          <select
                            value={ch.kind}
                            onChange={(e) =>
                              setChoice(i, { kind: e.target.value as ColumnChoice["kind"] })
                            }
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                          >
                            {(Object.keys(KIND_LABELS) as ColumnChoice["kind"][]).map((k) => (
                              <option key={k} value={k}>
                                {KIND_LABELS[k]}
                              </option>
                            ))}
                          </select>
                        )}
                        <Input
                          className="text-center uppercase"
                          placeholder="EUR"
                          maxLength={3}
                          value={ch.currency}
                          onChange={(e) => setChoice(i, { currency: e.target.value.toUpperCase() })}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {parsed.rows.length} data row(s) detected.
            </p>
          </div>
        )}

        <DialogFooter>
          {parsed ? (
            <>
              <Button variant="ghost" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={() => void submit()} disabled={commit.isPending}>
                {commit.isPending ? "Importing…" : "Import snapshots"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
