// FX rates provider backed by Frankfurter (ECB data, free, keyless).
// FX has a (base, quote) shape rather than a single symbol, so it is kept
// separate from the PriceProvider interface.
const BASE_URL = "https://api.frankfurter.dev/v1";

// ECB series start in 1999.
const INCEPTION = "1999-01-04";

export interface FxBar {
  date: Date;
  rate: number;
}

/**
 * Daily FX closes for base -> quote, from `from` (or inception) to today.
 * Returns an empty array for base === quote (handled by the caller as rate 1).
 */
export async function fetchFxHistory(base: string, quote: string, from?: Date): Promise<FxBar[]> {
  if (base === quote) return [];

  const start = from ? from.toISOString().slice(0, 10) : INCEPTION;
  const url = `${BASE_URL}/${start}..?base=${base}&symbols=${quote}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter request failed (${res.status})`);
  const data = (await res.json()) as { rates: Record<string, Record<string, number>> };

  const bars: FxBar[] = [];
  for (const [day, rates] of Object.entries(data.rates ?? {})) {
    const rate = rates[quote];
    if (rate != null) {
      bars.push({ date: new Date(`${day}T00:00:00Z`), rate });
    }
  }
  bars.sort((a, b) => a.date.getTime() - b.date.getTime());
  return bars;
}
