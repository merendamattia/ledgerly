"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { TickerSearch, type SelectedTicker } from "@/components/ticker-search";
import { useAccounts, useCreateAccount, type Account } from "@/hooks/use-accounts";
import {
  useParseInvestmentImport,
  useCommitInvestmentImport,
  type ParsedInvestmentRow,
} from "@/hooks/use-investment-import";
import { INVESTMENT_SIDE_LABELS, formatMoney } from "@/lib/format";

type Side = "BUY" | "SELL";
// A preview row: the parsed CSV row plus the (defaulted, editable) side.
type PreviewRow = ParsedInvestmentRow & { side: Side };

// Shared column template for the preview editor: labeled stack on phones, an
// aligned ledger grid from sm up.
const PREVIEW_COLS =
  "sm:grid-cols-[minmax(72px,1fr)_minmax(72px,1fr)_92px_146px_104px_104px_minmax(84px,0.9fr)_auto]";

// A field that shows its column label only on mobile (header row is hidden
// there), keeping each stacked control identifiable.
function Cell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground sm:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

// One editable preview row. Memoized so editing a field only re-renders its own
// row, keeping a large import responsive. Ticker/broker are resolved via the
// mapping panel above, so here they are read-only labels.
const PreviewRowEditor = memo(function PreviewRowEditor({
  row,
  index,
  tickerLabel,
  brokerLabel,
  onChange,
  onRemove,
}: {
  row: PreviewRow;
  index: number;
  tickerLabel: string;
  brokerLabel: string;
  onChange: (index: number, patch: Partial<PreviewRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-2 border-b p-3 last:border-b-0 sm:grid sm:items-center sm:gap-2 sm:p-2",
        PREVIEW_COLS,
      )}
    >
      <Cell label="Ticker">
        <span className="block truncate font-mono text-sm">{tickerLabel}</span>
      </Cell>
      <Cell label="Broker">
        <span className="block truncate text-sm">{brokerLabel}</span>
      </Cell>
      <Cell label="Side">
        <Select
          value={row.side}
          items={INVESTMENT_SIDE_LABELS}
          onValueChange={(v) => onChange(index, { side: (v ?? "BUY") as Side })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BUY">Buy</SelectItem>
            <SelectItem value="SELL">Sell</SelectItem>
          </SelectContent>
        </Select>
      </Cell>
      <Cell label="Date">
        <Input
          type="date"
          className="w-full"
          value={row.date}
          onChange={(e) => onChange(index, { date: e.target.value })}
        />
      </Cell>
      <Cell label="Qty">
        <Input
          type="number"
          step="0.0000001"
          className="w-full text-right"
          value={row.quantity}
          onChange={(e) => onChange(index, { quantity: Number(e.target.value) })}
        />
      </Cell>
      <Cell label="Price">
        <Input
          type="number"
          step="0.01"
          className="w-full text-right"
          value={row.price}
          onChange={(e) => onChange(index, { price: Number(e.target.value) })}
        />
      </Cell>
      <Cell label="Total" className="sm:text-right">
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {formatMoney(row.quantity * row.price, "EUR")}
        </span>
      </Cell>
      <div className="col-span-2 flex justify-end sm:col-span-1">
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label="Remove row">
          <Trash2 />
        </Button>
      </div>
    </div>
  );
});

type ImportField = "ticker" | "price" | "quantity" | "total" | "date" | "broker";
type DefaultableField = "ticker" | "date" | "broker";

const IMPORT_FIELDS: Array<{
  key: ImportField;
  label: string;
  required: boolean;
  defaultable: boolean;
  optional: boolean;
}> = [
  { key: "ticker", label: "Ticker", required: true, defaultable: true, optional: false },
  { key: "price", label: "Price", required: true, defaultable: false, optional: false },
  { key: "quantity", label: "Quantity", required: true, defaultable: false, optional: false },
  { key: "total", label: "Total", required: false, defaultable: false, optional: true },
  { key: "date", label: "Date", required: true, defaultable: true, optional: false },
  { key: "broker", label: "Broker", required: true, defaultable: true, optional: false },
];

const COLUMN_DEFAULT_TOKEN = "__default__";
const COLUMN_IGNORE_TOKEN = "__ignore__";

function detectDelimiter(headerLine: string): RegExp {
  if (headerLine.includes("\t")) return /\t/;
  if (headerLine.includes(";")) return /;/;
  if (headerLine.includes(",")) return /,/;
  return /\s{2,}/;
}

function splitLine(line: string, delimiter: RegExp): string[] {
  return line.split(delimiter).map((cell) => cell.trim());
}

function normalizeColumnName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function createEmptyFieldColumns(): Record<ImportField, number | null> {
  return {
    ticker: null,
    price: null,
    quantity: null,
    total: null,
    date: null,
    broker: null,
  };
}

function createEmptyColumnAssignments(columnCount: number): Array<ImportField | null> {
  return Array.from({ length: columnCount }, () => null);
}

function suggestFieldColumns(columns: string[]): Record<ImportField, number | null> {
  const normalized = columns.map((column) => normalizeColumnName(column));
  const synonyms: Record<ImportField, string[]> = {
    ticker: ["ticker", "ticket", "symbol", "isin"],
    price: ["price", "prezzo", "unitprice", "rate"],
    quantity: ["quantity", "quantita", "qty", "amount"],
    total: ["total", "value", "countervalue", "importo"],
    date: ["date", "data"],
    broker: ["broker", "account", "intermediary"],
  };

  const result = createEmptyFieldColumns();
  for (const field of IMPORT_FIELDS) {
    const matches = synonyms[field.key];
    const index = normalized.findIndex((column) =>
      matches.some((synonym) => column === synonym || column.includes(synonym) || synonym.includes(column)),
    );
    result[field.key] = index >= 0 ? index : null;
  }
  return result;
}

function suggestColumnAssignments(columns: string[]): Array<ImportField | null> {
  const fieldColumns = suggestFieldColumns(columns);
  const assignments = createEmptyColumnAssignments(columns.length);
  for (const field of IMPORT_FIELDS) {
    const index = fieldColumns[field.key];
    if (index !== null && index < assignments.length && assignments[index] === null) {
      assignments[index] = field.key;
    }
  }
  return assignments;
}

function inspectInvestmentFile(text: string): { columns: string[]; sampleRows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { columns: [], sampleRows: [] };
  const delimiter = detectDelimiter(lines[0]);
  return {
    columns: splitLine(lines[0], delimiter),
    sampleRows: lines.slice(1, 4).map((line) => splitLine(line, delimiter)),
  };
}

// Maps one raw broker string to a CashAccount: pick an existing one or create a
// new account inline (pre-filled with the raw label).
function BrokerMapper({
  raw,
  accounts,
  value,
  onMap,
}: {
  raw: string;
  accounts: Account[];
  value?: string;
  onMap: (cashAccountId: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(raw);
  const [currency, setCurrency] = useState("EUR");
  const createAccount = useCreateAccount();

  const items = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, `${a.name} · ${a.currency}`])),
    [accounts],
  );

  async function create() {
    const acc = await createAccount.mutateAsync({
      name: name.trim() || raw,
      type: "BROKER",
      currency: currency.trim().toUpperCase() || "EUR",
      balance: 0,
    });
    onMap(acc.id);
    setCreating(false);
    toast.success(`Account "${acc.name}" created`);
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Broker <span className="font-mono font-semibold text-foreground">{raw}</span>
      </p>
      {creating ? (
        <div className="flex items-end gap-2">
          <Input
            className="h-9"
            placeholder="Account name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="h-9 w-20"
            placeholder="EUR"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
          <Button size="sm" onClick={create} disabled={createAccount.isPending}>
            {createAccount.isPending ? "…" : "Create"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={value ?? ""} items={items} onValueChange={(v) => v && onMap(v)}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            New
          </Button>
        </div>
      )}
    </div>
  );
}

export function ImportInvestmentTransactionsDialog({
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
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([]);
  const [stage, setStage] = useState<"upload" | "mapping" | "preview">("upload");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [columnAssignments, setColumnAssignments] = useState<Array<ImportField | null>>([]);
  const [fieldDefaults, setFieldDefaults] = useState<Record<DefaultableField, string>>({
    ticker: "",
    date: "",
    broker: "",
  });
  const [fileInputKey, setFileInputKey] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  // Raw CSV value -> resolved app entity.
  const [tickerMap, setTickerMap] = useState<Record<string, SelectedTicker>>({});
  const [brokerMap, setBrokerMap] = useState<Record<string, string>>({});

  const parse = useParseInvestmentImport();
  const commit = useCommitInvestmentImport();
  const { data: accounts } = useAccounts();

  const reset = useCallback(() => {
    setRows(null);
    setErrors([]);
    setStage("upload");
    setSourceFile(null);
    setSourceColumns([]);
    setSampleRows([]);
    setColumnAssignments([]);
    setFieldDefaults({ ticker: "", date: "", broker: "" });
    setInspecting(false);
    setTickerMap({});
    setBrokerMap({});
    setFileInputKey((key) => key + 1);
  }, []);

  const setOpen = useCallback(
    (o: boolean) => {
      if (!isControlled) setOpenState(o);
      onOpenChange?.(o);
      if (!o) reset();
    },
    [isControlled, onOpenChange, reset],
  );

  const inspectFile = useCallback(async (file: File) => {
    setSourceFile(file);
    setStage("mapping");
    setInspecting(true);
    try {
      const preview = inspectInvestmentFile(await file.text());
      setSourceColumns(preview.columns);
      setSampleRows(preview.sampleRows);
      setColumnAssignments(suggestColumnAssignments(preview.columns));
      setFieldDefaults({ ticker: "", date: "", broker: "" });
      setTickerMap({});
      setBrokerMap({});
      setRows(null);
      setErrors([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to inspect file");
      reset();
    } finally {
      setInspecting(false);
    }
  }, [reset]);

  // Controlled open with a preloaded file (handed off from the Add drawer).
  useEffect(() => {
    if (!open || !initialFile) return;
    const timeout = window.setTimeout(() => {
      void inspectFile(initialFile);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, initialFile, inspectFile]);

  const mappedFieldColumns = useMemo(() => {
    const result = createEmptyFieldColumns();
    columnAssignments.forEach((field, index) => {
      if (field !== null) result[field] = index;
    });
    return result;
  }, [columnAssignments]);

  const canProceed =
    mappedFieldColumns.price !== null &&
    mappedFieldColumns.quantity !== null &&
    (mappedFieldColumns.ticker !== null || fieldDefaults.ticker.trim().length > 0) &&
    (mappedFieldColumns.date !== null || fieldDefaults.date.trim().length > 0) &&
    (mappedFieldColumns.broker !== null || fieldDefaults.broker.trim().length > 0);

  const parsePayload = useMemo(
    () => ({
      ticker: mappedFieldColumns.ticker,
      price: mappedFieldColumns.price,
      quantity: mappedFieldColumns.quantity,
      total: mappedFieldColumns.total,
      date: mappedFieldColumns.date,
      broker: mappedFieldColumns.broker,
      defaults: {
        ticker: fieldDefaults.ticker.trim() || undefined,
        date: fieldDefaults.date.trim() || undefined,
        broker: fieldDefaults.broker.trim() || undefined,
      },
      skipHeader: true,
    }),
    [mappedFieldColumns, fieldDefaults],
  );

  const distinctTickers = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.ticker))] : []),
    [rows],
  );
  const distinctBrokers = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.broker))] : []),
    [rows],
  );

  const allMapped = distinctTickers.every((t) => tickerMap[t]) && distinctBrokers.every((b) => brokerMap[b]);
  const previewRows = rows ?? [];

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void inspectFile(file);
  }

  function confirmMapping() {
    if (!sourceFile || !canProceed) return;
    parse.mutate(
      { file: sourceFile, mapping: parsePayload },
      {
        onSuccess: (res) => {
          setRows(res.rows.map((r) => ({ ...r, side: "BUY" as const })));
          setErrors(res.errors);
          setStage("preview");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  const update = useCallback((index: number, patch: Partial<PreviewRow>) => {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  }, []);

  const remove = useCallback((index: number) => {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  function confirm() {
    if (!rows || rows.length === 0 || !allMapped) return;
    const payload = rows.map((r) => ({
      tickerId: tickerMap[r.ticker]!.tickerId,
      cashAccountId: brokerMap[r.broker]!,
      date: r.date,
      side: r.side,
      quantity: r.quantity,
      price: r.price,
    }));
    commit.mutate(payload, {
      onSuccess: (res) => {
        toast.success(`Imported ${res.imported} · skipped ${res.skipped}`);
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
          <DialogTitle>Import investment transactions</DialogTitle>
          <DialogDescription>
            Upload a broker CSV/TSV export. First map the file columns to the app fields, then
            parse the rows, review the result, and confirm. Duplicates are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {stage !== "preview" ? (
          <div className="flex flex-col gap-4 py-2">
            {stage === "upload" ? (
              <div className="flex flex-col gap-3">
                <Input
                  key={fileInputKey}
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  onChange={onFile}
                  disabled={inspecting}
                />
                {inspecting && <p className="text-sm text-muted-foreground">Inspecting file…</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{sourceFile?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Map the file columns below. Fields without a source column can use a default
                      value for this import.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    Choose another file
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {sourceColumns.map((column) => (
                    <span key={column} className="rounded-full border bg-muted px-2 py-1">
                      {column}
                    </span>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Backend schema mapping
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pick which uploaded file column feeds each backend field. Each file column
                        can be assigned once.
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader className="bg-popover">
                          <TableRow>
                            <TableHead className="w-[180px]">Backend field</TableHead>
                            <TableHead>File column</TableHead>
                            <TableHead className="w-[240px]">Notes / default</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {IMPORT_FIELDS.map((field) => {
                            const defaultField = field.key as DefaultableField;
                            const current = mappedFieldColumns[field.key];
                            const selectedLabel =
                              current !== null
                                ? sourceColumns[current] ?? "Select file column"
                                : field.defaultable
                                  ? "Use default value"
                                  : field.optional
                                    ? "Ignore"
                                    : "Select file column";
                            const selectValue =
                              current !== null
                                ? String(current)
                                : field.defaultable
                                  ? COLUMN_DEFAULT_TOKEN
                                  : field.optional
                                    ? COLUMN_IGNORE_TOKEN
                                    : "";
                            return (
                              <TableRow key={field.key}>
                                <TableCell className="align-top">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">{field.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {field.defaultable
                                        ? "Text field"
                                        : field.optional
                                          ? "Optional numeric field"
                                          : "Numeric field"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <Select
                                    value={selectValue}
                                    onValueChange={(value) => {
                                      setColumnAssignments((prev) => {
                                        const next = [...prev];
                                        if (
                                          value === COLUMN_DEFAULT_TOKEN ||
                                          value === COLUMN_IGNORE_TOKEN
                                        ) {
                                          next.forEach((assignment, assignmentIndex) => {
                                            if (assignment === field.key) next[assignmentIndex] = null;
                                          });
                                          return next;
                                        }
                                        const fileIndex = Number(value);
                                        const duplicateIndex = next.findIndex(
                                          (assignment, assignmentIndex) =>
                                            assignment === field.key && assignmentIndex !== fileIndex,
                                        );
                                        if (duplicateIndex >= 0) next[duplicateIndex] = null;
                                        next[fileIndex] = field.key;
                                        return next;
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-9 w-full">
                                      <span className="truncate">{selectedLabel}</span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sourceColumns.map((column, index) => (
                                        <SelectItem
                                          key={column}
                                          value={String(index)}
                                          disabled={
                                            columnAssignments[index] !== null &&
                                            columnAssignments[index] !== field.key
                                          }
                                        >
                                          {column}
                                        </SelectItem>
                                      ))}
                                      {field.defaultable ? (
                                        <SelectItem value={COLUMN_DEFAULT_TOKEN}>Use default value</SelectItem>
                                      ) : null}
                                      {field.optional ? (
                                        <SelectItem value={COLUMN_IGNORE_TOKEN}>Ignore</SelectItem>
                                      ) : null}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="align-top">
                                  {field.defaultable && current === null ? (
                                    <Input
                                      placeholder={
                                        field.key === "date"
                                          ? "15/01/2024"
                                          : `Default ${field.label.toLowerCase()}`
                                      }
                                      value={fieldDefaults[defaultField]}
                                      onChange={(event) =>
                                        setFieldDefaults((prev) => ({
                                          ...prev,
                                          [defaultField]: event.target.value,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      {field.defaultable
                                        ? "Optional if the file does not provide a column"
                                        : field.optional
                                          ? "Leave blank if not needed"
                                          : "Required from file"}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Missing text values can still use defaults later if the file does not contain a
                      column for them.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Sample rows</p>
                      <p className="text-xs text-muted-foreground">
                        A quick preview of the file structure before parsing.
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-popover">
                          <TableRow>
                            {sourceColumns.map((column) => (
                              <TableHead key={column}>{column}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sampleRows.length > 0 ? (
                            sampleRows.map((row, rowIndex) => (
                              <TableRow key={rowIndex}>
                                {sourceColumns.map((_, cellIndex) => (
                                  <TableCell key={cellIndex} className="text-xs">
                                    {row[cellIndex] ?? ""}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={Math.max(sourceColumns.length, 1)} className="py-6 text-center text-xs text-muted-foreground">
                                No sample rows detected.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {previewRows.length} transaction{previewRows.length === 1 ? "" : "s"}
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

            {/* Mapping panel: raw CSV values -> real app records. */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Tickers</p>
                {distinctTickers.map((t) => (
                  <div key={t} className="rounded-lg border bg-card p-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      File symbol <span className="font-mono font-semibold text-foreground">{t}</span>
                    </p>
                    <TickerSearch
                      initialTerm={t}
                      selected={tickerMap[t] ?? null}
                      onSelect={(sel) => setTickerMap((m) => ({ ...m, [t]: sel }))}
                      onClear={() =>
                        setTickerMap((m) => {
                          const next = { ...m };
                          delete next[t];
                          return next;
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Brokers</p>
                {distinctBrokers.map((b) => (
                  <BrokerMapper
                    key={b}
                    raw={b}
                    accounts={accounts ?? []}
                    value={brokerMap[b]}
                    onMap={(id) => setBrokerMap((m) => ({ ...m, [b]: id }))}
                  />
                ))}
              </div>
            </div>

            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              <div
                className={cn(
                  "sticky top-0 z-10 hidden gap-2 border-b bg-popover px-2 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:grid sm:items-center",
                  PREVIEW_COLS,
                )}
              >
                <span>Ticker</span>
                <span>Broker</span>
                <span>Side</span>
                <span>Date</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {previewRows.map((row, i) => (
                <PreviewRowEditor
                  key={i}
                  row={row}
                  index={i}
                  tickerLabel={tickerMap[row.ticker]?.symbol ?? row.ticker}
                  brokerLabel={
                    accounts?.find((a) => a.id === brokerMap[row.broker])?.name ?? row.broker
                  }
                  onChange={update}
                  onRemove={remove}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter showCloseButton>
          {stage === "mapping" ? (
            <Button onClick={confirmMapping} disabled={!canProceed || parse.isPending || inspecting}>
              {parse.isPending ? "Parsing…" : "Proceed"}
            </Button>
          ) : rows ? (
            <Button onClick={confirm} disabled={commit.isPending || previewRows.length === 0 || !allMapped}>
              {commit.isPending
                ? "Importing…"
                : !allMapped
                  ? "Map all tickers & brokers"
                  : `Import ${previewRows.length}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
