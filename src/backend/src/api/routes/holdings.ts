import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middlewares/auth.ts";
import { holdingRepository } from "../../repositories/holding.ts";
import { tickerRepository } from "../../repositories/ticker.ts";
import {
  createHoldingSchema,
  updateHoldingSchema,
  holdingReturnsQuerySchema,
} from "../../schemas/index.ts";
import { serializeHolding } from "../../utils/serialize.ts";
import { computeInvestmentHistory } from "../../services/investmentHistory.ts";
import { computeBenchmarkComparison } from "../../services/benchmark.ts";
import { computeHoldingReturns } from "../../services/holdingReturns.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const holdingsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const holdings = await holdingRepository.list();
    return c.json(holdings.map(serializeHolding));
  })
  .get("/history", async (c) => {
    const points = await computeInvestmentHistory();
    return c.json(points);
  })
  .get("/benchmark", async (c) => {
    const comparison = await computeBenchmarkComparison();
    return c.json(comparison);
  })
  .get("/returns", zValidator("query", holdingReturnsQuerySchema), async (c) => {
    const fromStr = c.req.valid("query").from;
    const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : undefined;
    const returns = await computeHoldingReturns(from);
    return c.json(returns);
  })
  .post("/", zValidator("json", createHoldingSchema), async (c) => {
    const input = c.req.valid("json");
    const ticker = await tickerRepository.findById(input.tickerId);
    if (!ticker) throw new NotFoundError("Ticker not found");
    const holding = await holdingRepository.create({
      quantity: input.quantity,
      avgCost: input.avgCost,
      ticker: { connect: { id: input.tickerId } },
      cashAccount: input.cashAccountId ? { connect: { id: input.cashAccountId } } : undefined,
    });
    return c.json(serializeHolding(holding), 201);
  })
  .put("/:id", zValidator("json", updateHoldingSchema), async (c) => {
    const id = c.req.param("id");
    const existing = await holdingRepository.findById(id);
    if (!existing) throw new NotFoundError("Holding not found");
    const input = c.req.valid("json");
    const data: Prisma.HoldingUpdateInput = {};
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.avgCost !== undefined) data.avgCost = input.avgCost;
    if (input.cashAccountId !== undefined) {
      data.cashAccount = input.cashAccountId
        ? { connect: { id: input.cashAccountId } }
        : { disconnect: true };
    }
    const holding = await holdingRepository.update(id, data);
    return c.json(serializeHolding(holding));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await holdingRepository.findById(id);
    if (!existing) throw new NotFoundError("Holding not found");
    await holdingRepository.delete(id);
    return c.json({ ok: true });
  });
