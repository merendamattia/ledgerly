"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTickerSearch, useAddAsset, type SearchCandidate } from "@/hooks/use-investments";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SelectedTicker {
  tickerId: string;
  symbol: string;
  name: string;
  type: "EQUITY" | "ETF" | "CRYPTO";
  currency?: string;
  price?: number;
}

const TYPE_TINT: Record<string, string> = {
  EQUITY: "bg-accent text-accent-foreground",
  ETF: "bg-[#EEF6DC] text-[#5b7d10]",
  CRYPTO: "bg-[#FDF1DD] text-[#b07415]",
};

// Debounced instrument search. On select, the asset is created (idempotently) so
// its price backfill starts in the background; the resolved ticker is lifted up.
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

  const addAsset = useAddAsset();
  const { data, isFetching } = useTickerSearch(debounced);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(id);
  }, [term]);

  async function choose(candidate: SearchCandidate) {
    setResolving(candidate.symbol);
    try {
      // Idempotent: creates the ticker if new and kicks off the price backfill.
      const ticker = await addAsset.mutateAsync({
        symbol: candidate.symbol,
        type: candidate.type,
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
        className="h-10 pl-9"
        autoComplete="off"
      />
      {(isFetching || addAsset.isPending) && (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {debounced.trim().length >= 2 && (
        <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border bg-popover shadow-card">
          {isFetching && !data ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Searching…</p>
          ) : (data ?? []).length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matches.</p>
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
    </div>
  );
}
