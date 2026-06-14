import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { tickerRepository } from "../../repositories/ticker.ts";
import { priceRepository } from "../../repositories/price.ts";
import { addAsset, removeAsset } from "../../services/tickers.ts";
import { addAssetSchema } from "../../schemas/index.ts";
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
  .post("/", zValidator("json", addAssetSchema), async (c) => {
    const { symbol, type } = c.req.valid("json");
    const ticker = await addAsset(symbol, type);
    return c.json(ticker, 201);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await tickerRepository.findById(id);
    if (!existing) throw new NotFoundError("Asset not found");
    await removeAsset(id);
    return c.json({ ok: true });
  });
