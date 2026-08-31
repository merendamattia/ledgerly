import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { rebalanceRepository } from "../../repositories/rebalance.ts";
import {
  createRebalanceGroupSchema,
  updateRebalanceGroupSchema,
} from "../../schemas/index.ts";
import { serializeRebalanceGroup } from "../../utils/serialize.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const rebalanceRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const groups = await rebalanceRepository.list(c.get("user").id);
    return c.json(groups.map(serializeRebalanceGroup));
  })
  .post("/", zValidator("json", createRebalanceGroupSchema), async (c) => {
    const group = await rebalanceRepository.create(c.get("user").id, c.req.valid("json"));
    return c.json(serializeRebalanceGroup(group), 201);
  })
  .put("/:id", zValidator("json", updateRebalanceGroupSchema), async (c) => {
    const id = c.req.param("id");
    const existing = await rebalanceRepository.findById(c.get("user").id, id);
    if (!existing) throw new NotFoundError("Rebalance group not found");
    const group = await rebalanceRepository.update(c.get("user").id, id, c.req.valid("json"));
    if (!group) throw new NotFoundError("Rebalance group not found");
    return c.json(serializeRebalanceGroup(group));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await rebalanceRepository.findById(c.get("user").id, id);
    if (!existing) throw new NotFoundError("Rebalance group not found");
    await rebalanceRepository.delete(c.get("user").id, id);
    return c.json({ ok: true });
  });
