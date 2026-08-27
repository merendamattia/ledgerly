"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTickerSearch,
  useAddAsset,
  useAddManualAsset,
  type SearchCandidate,
} from "@/hooks/use-investments";
import { formatMoney, TICKER_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TickerType = "EQUITY" | "ETF" | "CRYPTO" | "BOND" | "COMMODITY";

export interface SelectedTicker {
  tickerId: string;
  symbol: string;
  name: string;
  type: TickerType;
  currency?: string;
  price?: number;
}

const TYPE_TINT: Record<string, string> = {
  EQUITY: "bg-accent text-accent-foreground",
  ETF: "bg-accent text-accent-foreground",
  CRYPTO: "bg-[#FDF1DD] text-[#8a6516]",
  BOND: "bg-[#E7EEF7] text-[#3a5d8f]",
  COMMODITY: "bg-[#F3E9DC] text-[#836012]",
};

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/**
 * Renders debounced instrument search and idempotently creates the selected asset.
 */
export function TickerSearch({
  selected,
  onSelect,
  onClear,
  initialTerm = "",
}: {
  selected: SelectedTicker | null;
  onSelect: (t: SelectedTicker) => void;
  onClear: () => void;
  /** Pre-fills the search box (e.g. with a raw symbol from a CSV import). */
  initialTerm?: string;
}) {
  const [term, setTerm] = useState(initialTerm);
  const [debounced, setDebounced] = useState(initialTerm);
  const [resolving, setResolving] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const addAsset = useAddAsset();
  const { data, isFetching } = useTickerSearch(debounced);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(id);
  }, [term]);

  /** Creates or resolves a market-backed ticker from a search candidate. */
  async function choose(candidate: SearchCandidate) {
    setResolving(candidate.symbol);
    try {
      // Idempotent: creates the ticker if new and kicks off the price backfill.
      const ticker = await addAsset.mutateAsync({
        symbol: candidate.symbol,
        type: candidate.type,
        ...(candidate.isin ? { isin: candidate.isin } : {}),
      });
      onSelect({
        tickerId: ticker.id,
        symbol: ticker.symbol,
        name: ticker.name,
        type: candidate.type,
        currency: candidate.currency,
        price: candidate.price,
      });
      setTerm("");
      setDebounced("");
    } finally {
      setResolving(null);
    }
  }

  /** Selects a manually created asset and clears the search UI. */
  function selectManual(ticker: { id: string; symbol: string; name: string }, type: TickerType, currency: string, price: number) {
    onSelect({ tickerId: ticker.id, symbol: ticker.symbol, name: ticker.name, type, currency, price });
    setManualOpen(false);
    setTerm("");
    setDebounced("");
  }

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-accent/40 px-3 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary font-display text-xs font-semibold text-primary-foreground">
          {selected.symbol.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {selected.symbol}
            {selected.currency ? ` · ${selected.currency}` : ""}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-positive">
          <Check className="size-3.5" /> updating prices
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Change asset"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search ticker or name (e.g. AAPL, Bitcoin)…"
        className="pl-9"
        autoComplete="off"
      />
      {(isFetching || addAsset.isPending) && (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {debounced.trim().length >= 2 && !manualOpen && (
        <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border bg-popover shadow-card">
          {isFetching && !data ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Searching…</p>
          ) : (data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">No matches.</p>
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-foreground hover:underline"
              >
                <Plus className="size-4" />
                Add manually (bond / commodity)
              </button>
            </div>
          ) : (
            (data ?? []).map((c) => (
              <button
                key={`${c.type}:${c.symbol}`}
                type="button"
                disabled={resolving !== null}
                onClick={() => choose(c)}
                className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{c.symbol}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        TYPE_TINT[c.type] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.type}
                    </span>
                    {c.exchange ? (
                      <span className="truncate text-[11px] text-muted-foreground">{c.exchange}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {c.name}
                    {c.isin ? ` · ${c.isin}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
                  {resolving === c.symbol ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : c.price != null ? (
                    formatMoney(c.price, c.currency ?? "USD")
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {manualOpen ? (
        <ManualAssetForm
          initialTerm={term}
          onCancel={() => setManualOpen(false)}
          onCreated={selectManual}
        />
      ) : null}
    </div>
  );
}

/** Renders the inline form for creating manually priced assets. */
function ManualAssetForm({
  initialTerm,
  onCancel,
  onCreated,
}: {
  initialTerm: string;
  onCancel: () => void;
  onCreated: (
    ticker: { id: string; symbol: string; name: string },
    type: TickerType,
    currency: string,
    price: number,
  ) => void;
}) {
  const looksLikeIsin = ISIN_RE.test(initialTerm.trim().toUpperCase());
  const addManual = useAddManualAsset();
  const [symbol, setSymbol] = useState(initialTerm.trim().toUpperCase());
  const [name, setName] = useState(looksLikeIsin ? "" : initialTerm.trim());
  const [isin, setIsin] = useState(looksLikeIsin ? initialTerm.trim().toUpperCase() : "");
  const [type, setType] = useState<TickerType>("BOND");
  const [currency, setCurrency] = useState("EUR");
  const [price, setPrice] = useState("");

  /** Validates and creates a manually priced asset. */
  async function submit() {
    if (!symbol.trim() || !name.trim() || !price) {
      toast.error("Symbol, name and price are required");
      return;
    }
    try {
      const ticker = await addManual.mutateAsync({
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        type,
        currency: currency.trim().toUpperCase() || "EUR",
        price: Number(price),
        ...(isin.trim() ? { isin: isin.trim().toUpperCase() } : {}),
      });
      onCreated(ticker, type, currency.trim().toUpperCase() || "EUR", Number(price));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Add manual asset</p>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input placeholder="Symbol / code" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
        <Input placeholder="ISIN (optional)" value={isin} onChange={(e) => setIsin(e.target.value.toUpperCase())} maxLength={12} />
      </div>
      <Input placeholder="Name (e.g. BTP Valore 2034)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TickerType)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="BOND">{TICKER_TYPE_LABELS.BOND}</option>
          <option value="COMMODITY">{TICKER_TYPE_LABELS.COMMODITY}</option>
          <option value="EQUITY">{TICKER_TYPE_LABELS.EQUITY}</option>
          <option value="ETF">{TICKER_TYPE_LABELS.ETF}</option>
        </select>
        <Input className="text-center uppercase" placeholder="EUR" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        <Input type="number" step="any" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void submit()} disabled={addManual.isPending}>
          {addManual.isPending ? "Adding…" : "Add asset"}
        </Button>
      </div>
    </div>
  );
}
