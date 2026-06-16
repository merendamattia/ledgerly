import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { debtRepository } from "../../repositories/debt.ts";
import { debtSnapshotRepository } from "../../repositories/debtSnapshot.ts";
import { createDebtSnapshot } from "../../services/snapshot.ts";
import {
  createDebtSchema,
  createDebtSnapshotSchema,
  updateDebtSchema,
} from "../../schemas/index.ts";
import { serializeDebt, serializeDebtSnapshot } from "../../utils/serialize.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const debtsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const debts = await debtRepository.list();
    return c.json(debts.map(serializeDebt));
  })
  .get("/snapshots", async (c) => {
    const snapshots = await debtSnapshotRepository.history();
    return c.json(snapshots.map(serializeDebtSnapshot));
  })
  .post("/snapshots", zValidator("json", createDebtSnapshotSchema), async (c) => {
    const { date, entries } = c.req.valid("json");
    const snapshots = await createDebtSnapshot(date, entries);
    return c.json(snapshots.map(serializeDebtSnapshot), 201);
  })
  .post("/", zValidator("json", createDebtSchema), async (c) => {
    const debt = await debtRepository.create(c.req.valid("json"));
    return c.json(serializeDebt(debt), 201);
  })
  .put("/:id", zValidator("json", updateDebtSchema), async (c) => {
    const id = c.req.param("id");
    const existing = await debtRepository.findById(id);
    if (!existing) throw new NotFoundError("Debt not found");
    const debt = await debtRepository.update(id, c.req.valid("json"));
    return c.json(serializeDebt(debt));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await debtRepository.findById(id);
    if (!existing) throw new NotFoundError("Debt not found");
    await debtRepository.delete(id);
    return c.json({ ok: true });
  });
