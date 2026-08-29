import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { investmentTransactionRepository } from "../../repositories/investmentTransaction.ts";
import {
  recordInvestmentTransaction,
  updateInvestmentTransaction,
  deleteInvestmentTransaction,
} from "../../services/investments.ts";
import {
  createInvestmentTxSchema,
  updateInvestmentTxSchema,
  investmentTxFiltersSchema,
} from "../../schemas/index.ts";
import { serializeInvestmentTransaction } from "../../utils/serialize.ts";
import type { AppEnv } from "../types.ts";

export const investmentTransactionsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", zValidator("query", investmentTxFiltersSchema), async (c) => {
    const filters = c.req.valid("query");
    const txs = await investmentTransactionRepository.list(c.get("user").id, filters);
    return c.json(txs.map(serializeInvestmentTransaction));
  })
  .post("/", zValidator("json", createInvestmentTxSchema), async (c) => {
    const input = c.req.valid("json");
    const tx = await recordInvestmentTransaction(c.get("user").id, input);
    return c.json(serializeInvestmentTransaction(tx), 201);
  })
  .put("/:id", zValidator("json", updateInvestmentTxSchema), async (c) => {
    const id = c.req.param("id");
    const tx = await updateInvestmentTransaction(c.get("user").id, id, c.req.valid("json"));
    return c.json(serializeInvestmentTransaction(tx));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await deleteInvestmentTransaction(c.get("user").id, id);
    return c.json({ ok: true });
  });
