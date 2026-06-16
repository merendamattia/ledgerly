import { config } from "../../../core/config.ts";
import { cacheGet, cacheSet } from "../../../core/redis.ts";
import type { Bar, InstrumentMeta, PriceProvider, SearchCandidate } from "./types.ts";

const BASE_URL = "https://api.coingecko.com/api/v3";
const VS_CURRENCY = "usd";
const ID_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

function headers(): Record<string, string> {
  return config.COINGECKO_API_KEY
    ? { "x-cg-demo-api-key": config.COINGECKO_API_KEY }
    : {};
}

interface SearchCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
}

/**
 * Resolve a user-entered symbol (e.g. "BTC") or id (e.g. "bitcoin") to a
 * CoinGecko coin id. Cached in Redis to avoid repeated lookups.
 */
async function resolveCoinId(symbol: string): Promise<{ id: string; name: string }> {
  const cacheKey = `coingecko:id:${symbol.toLowerCase()}`;
  const cached = await cacheGet<{ id: string; name: string }>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(symbol)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`CoinGecko search failed (${res.status})`);
  const data = (await res.json()) as { coins: SearchCoin[] };
  const coins = data.coins ?? [];
  if (coins.length === 0) throw new Error(`Unknown crypto symbol: ${symbol}`);

  const lower = symbol.toLowerCase();
  // Prefer an exact id or symbol match; among matches, the highest market cap.
  const ranked = [...coins].sort(
    (a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity),
  );
  const match =
    ranked.find((c) => c.id.toLowerCase() === lower) ??
    ranked.find((c) => c.symbol.toLowerCase() === lower) ??
    ranked[0]!;

  const resolved = { id: match.id, name: match.name };
  await cacheSet(cacheKey, resolved, ID_CACHE_TTL);
  return resolved;
}

/** Reduce raw [timestampMs, price] points to one closing price per UTC day. */
function toDailyBars(points: [number, number][]): Bar[] {
  const byDay = new Map<string, Bar>();
  for (const [ms, price] of points) {
    const date = new Date(ms);
    const key = date.toISOString().slice(0, 10);
    // Later points within the same day overwrite earlier ones (use the last as close).
    byDay.set(key, { date: new Date(`${key}T00:00:00Z`), close: price });
  }
  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// CoinGecko provider for crypto assets (priced in USD).
export const coingeckoProvider: PriceProvider = {
  name: "coingecko",

  async fetchMeta(symbol: string): Promise<InstrumentMeta> {
    const { id, name } = await resolveCoinId(symbol);
    return { symbol: id, name, currency: VS_CURRENCY.toUpperCase() };
  },

  async fetchHistory(symbol: string, from?: Date): Promise<Bar[]> {
    const { id } = await resolveCoinId(symbol);

    let url: string;
    if (from) {
      const fromSec = Math.floor(from.getTime() / 1000);
      const toSec = Math.floor(Date.now() / 1000);
      url = `${BASE_URL}/coins/${id}/market_chart/range?vs_currency=${VS_CURRENCY}&from=${fromSec}&to=${toSec}`;
    } else {
      url = `${BASE_URL}/coins/${id}/market_chart?vs_currency=${VS_CURRENCY}&days=max`;
    }

    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`CoinGecko market_chart failed (${res.status})`);
    const data = (await res.json()) as { prices: [number, number][] };
    return toDailyBars(data.prices ?? []);
  },

  async search(query: string): Promise<SearchCandidate[]> {
    const res = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(query)}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`CoinGecko search failed (${res.status})`);
    const data = (await res.json()) as { coins: SearchCoin[] };
    const coins = (data.coins ?? [])
      .sort((a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity))
      .slice(0, 10);
    if (coins.length === 0) return [];

    // Attach live USD prices via the markets endpoint (best effort).
    const ids = coins.map((c) => c.id).join(",");
    const prices = new Map<string, number>();
    try {
      const mres = await fetch(
        `${BASE_URL}/coins/markets?vs_currency=${VS_CURRENCY}&ids=${encodeURIComponent(ids)}`,
        { headers: headers() },
      );
      if (mres.ok) {
        const markets = (await mres.json()) as { id: string; current_price: number }[];
        for (const m of markets) prices.set(m.id, m.current_price);
      }
    } catch {
      // Prices are optional; the candidate is still selectable without one.
    }

    return coins.map((c) => ({
      // The CoinGecko id is the canonical symbol we persist (see fetchMeta).
      symbol: c.id,
      name: `${c.name} (${c.symbol.toUpperCase()})`,
      type: "CRYPTO" as const,
      currency: VS_CURRENCY.toUpperCase(),
      price: prices.get(c.id),
    }));
  },
};
