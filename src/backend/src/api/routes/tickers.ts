import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { tickerRepository } from "../../repositories/ticker.ts";
import { priceRepository } from "../../repositories/price.ts";
import { addAsset, addManualAsset, removeAsset, setManualPrice } from "../../services/tickers.ts";
import { searchInstruments } from "../../services/market/search.ts";
import {
  addAssetSchema,
  addManualAssetSchema,
  setManualPriceSchema,
  tickerSearchSchema,
} from "../../schemas/index.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const tickersRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const tickers = await tickerRepository.list();
    // Attach the stored price count so the UI can show backfill progress.
    const withCounts = await Promise.all(
      tickers.map(async (t) => ({ ...t, priceCount: await priceRepository.count(t.id) })),
    );
    return c.json(withCounts);
  })
  .get("/search", zValidator("query", tickerSearchSchema), async (c) => {
    const { q, type } = c.req.valid("query");
    const candidates = await searchInstruments(q, type);
    return c.json(candidates);
  })
  .post("/", zValidator("json", addAssetSchema), async (c) => {
    const { symbol, type, isin } = c.req.valid("json");
    const ticker = await addAsset(symbol, type, isin);
    return c.json(ticker, 201);
  })
  .post("/manual", zValidator("json", addManualAssetSchema), async (c) => {
    const ticker = await addManualAsset(c.req.valid("json"));
    return c.json(ticker, 201);
  })
  .post("/:id/price", zValidator("json", setManualPriceSchema), async (c) => {
    const id = c.req.param("id");
    const { price, date } = c.req.valid("json");
    await setManualPrice(id, price, date);
    return c.json({ ok: true });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await tickerRepository.findById(id);
    if (!existing) throw new NotFoundError("Asset not found");
    await removeAsset(id);
    return c.json({ ok: true });
  });
