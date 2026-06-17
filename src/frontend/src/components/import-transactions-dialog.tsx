"use client";

import { memo, useCallback, useEffect, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { DIRECTION_LABELS } from "@/lib/format";
import { useParseImport, useCommitImport, type ImportRow } from "@/hooks/use-import";

// One editable preview row. Memoized so editing a field only re-renders its own
// row, keeping a ~2000-row import responsive.
const ImportRowEditor = memo(function ImportRowEditor({
  row,
  index,
  onChange,
  onRemove,
}: {
  row: ImportRow;
  index: number;
  onChange: (index: number, patch: Partial<ImportRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <Select
          value={row.direction}
          items={DIRECTION_LABELS}
          onValueChange={(v) => onChange(index, { direction: (v ?? "EXPENSE") as ImportRow["direction"] })}
        >
          <SelectTrigger className="h-8 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          className="h-8 w-[130px]"
          value={row.category ?? ""}
          onChange={(e) => onChange(index, { category: e.target.value || null })}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          className="h-8 w-[150px]"
          value={row.date}
          onChange={(e) => onChange(index, { date: e.target.value })}
        />
      </TableCell>
      <TableCell align="right">
        <Input
          type="number"
          step="0.01"
          className="h-8 w-[100px] text-right"
          value={row.amount}
          onChange={(e) => onChange(index, { amount: Number(e.target.value) })}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8 min-w-[200px]"
          value={row.note ?? ""}
          onChange={(e) => onChange(index, { note: e.target.value || null })}
        />
      </TableCell>
      <TableCell align="right">
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function ImportTransactionsDialog({
  trigger,
  open: openProp,
  onOpenChange,
  initialFile,
}: {
  trigger?: ReactElement;
  // Optional controlled mode: lets the Add drawer open this with a dropped file.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialFile?: File | null;
}) {
  const [openState, setOpenState] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);

  const parse = useParseImport();
  const commit = useCommitImport();

  const reset = useCallback(() => {
    setRows(null);
    setErrors([]);
  }, []);

  const setOpen = useCallback(
    (o: boolean) => {
      if (!isControlled) setOpenState(o);
      onOpenChange?.(o);
      if (!o) reset();
    },
    [isControlled, onOpenChange, reset],
  );

  const parseFile = useCallback(
    (file: File) => {
      parse.mutate(file, {
        onSuccess: (res) => {
          setRows(res.rows);
          setErrors(res.errors);
        },
        onError: (err) => toast.error(err.message),
      });
    },
    [parse],
  );

  // Controlled open with a preloaded file (handed off from the Add drawer).
  useEffect(() => {
    if (open && initialFile) parseFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
  }

  const update = useCallback((index: number, patch: Partial<ImportRow>) => {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  }, []);

  const remove = useCallback((index: number) => {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  function confirm() {
    if (!rows || rows.length === 0) return;
    commit.mutate(rows, {
      onSuccess: (res) => {
        toast.success(
          `Imported ${res.imported} · skipped ${res.skipped}` +
            (res.createdCategories ? ` · ${res.createdCategories} new categories` : ""),
        );
        setOpen(false);
        reset();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? (
        <DialogTrigger
          render={
            trigger ?? (
              <Button variant="outline">
                <Download data-icon="inline-start" />
                Import
              </Button>
            )
          }
        />
      ) : null}
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import transactions</DialogTitle>
          <DialogDescription>
            Upload a Budjet CSV export. Review and edit the rows, then confirm. Duplicates are
            skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="flex flex-col gap-3 py-4">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              disabled={parse.isPending}
            />
            {parse.isPending && <p className="text-sm text-muted-foreground">Parsing…</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rows.length} transaction{rows.length === 1 ? "" : "s"}
                {errors.length > 0 ? ` · ${errors.length} row(s) skipped while parsing` : ""}
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                Choose another file
              </Button>
            </div>
            {errors.length > 0 && (
              <div className="max-h-24 overflow-y-auto rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                {errors.map((e, i) => (
                  <div key={i}>
                    Line {e.line}: {e.message}
                  </div>
                ))}
              </div>
            )}
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-popover">
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <ImportRowEditor
                      key={i}
                      row={row}
                      index={i}
                      onChange={update}
                      onRemove={remove}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter showCloseButton>
          {rows && (
            <Button onClick={confirm} disabled={commit.isPending || rows.length === 0}>
              {commit.isPending ? "Importing…" : `Import ${rows.length}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
