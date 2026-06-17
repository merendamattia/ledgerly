"use client";

import { memo, useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2 } from "lucide-react";
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
    <TableRow>
      <TableCell className="font-mono text-xs">{tickerLabel}</TableCell>
      <TableCell className="text-xs">{brokerLabel}</TableCell>
      <TableCell>
        <Select
          value={row.side}
          items={INVESTMENT_SIDE_LABELS}
          onValueChange={(v) => onChange(index, { side: (v ?? "BUY") as Side })}
        >
          <SelectTrigger className="h-8 w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BUY">Buy</SelectItem>
            <SelectItem value="SELL">Sell</SelectItem>
          </SelectContent>
        </Select>
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
          step="0.0000001"
          className="h-8 w-[110px] text-right"
          value={row.quantity}
          onChange={(e) => onChange(index, { quantity: Number(e.target.value) })}
        />
      </TableCell>
      <TableCell align="right">
        <Input
          type="number"
          step="0.01"
          className="h-8 w-[110px] text-right"
          value={row.price}
          onChange={(e) => onChange(index, { price: Number(e.target.value) })}
        />
      </TableCell>
      <TableCell align="right" className="font-mono text-xs tabular-nums text-muted-foreground">
        {formatMoney(row.quantity * row.price, "EUR")}
      </TableCell>
      <TableCell align="right">
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
});

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
  value: string | undefined;
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
  // Raw CSV value -> resolved app entity.
  const [tickerMap, setTickerMap] = useState<Record<string, SelectedTicker>>({});
  const [brokerMap, setBrokerMap] = useState<Record<string, string>>({});

  const parse = useParseInvestmentImport();
  const commit = useCommitInvestmentImport();
  const { data: accounts } = useAccounts();

  const reset = useCallback(() => {
    setRows(null);
    setErrors([]);
    setTickerMap({});
    setBrokerMap({});
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
          setRows(res.rows.map((r) => ({ ...r, side: "BUY" as const })));
          setErrors(res.errors);
          setTickerMap({});
          setBrokerMap({});
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

  const distinctTickers = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.ticker))] : []),
    [rows],
  );
  const distinctBrokers = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.broker))] : []),
    [rows],
  );

  const allMapped =
    distinctTickers.every((t) => tickerMap[t]) && distinctBrokers.every((b) => brokerMap[b]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
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
            Upload a broker CSV/TSV export. Map each ticker and broker to an app record, review the
            rows, then confirm. Duplicates are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="flex flex-col gap-3 py-4">
            <Input
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={onFile}
              disabled={parse.isPending}
            />
            {parse.isPending && <p className="text-sm text-muted-foreground">Parsing…</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
              <Table>
                <TableHeader className="sticky top-0 bg-popover">
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Broker</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
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
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter showCloseButton>
          {rows && (
            <Button onClick={confirm} disabled={commit.isPending || rows.length === 0 || !allMapped}>
              {commit.isPending
                ? "Importing…"
                : !allMapped
                  ? "Map all tickers & brokers"
                  : `Import ${rows.length}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
