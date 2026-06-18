import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { cashAccountRepository } from "../../repositories/cashAccount.ts";
import { cashSnapshotRepository } from "../../repositories/cashSnapshot.ts";
import { createCashSnapshot, deleteCashSnapshot } from "../../services/snapshot.ts";
import {
  createAccountSchema,
  createCashSnapshotSchema,
  updateAccountSchema,
} from "../../schemas/index.ts";
import { serializeAccount, serializeCashSnapshot } from "../../utils/serialize.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const accountsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const accounts = await cashAccountRepository.list();
    return c.json(accounts.map(serializeAccount));
  })
  .get("/snapshots", async (c) => {
    const snapshots = await cashSnapshotRepository.history();
    return c.json(snapshots.map(serializeCashSnapshot));
  })
  .post("/snapshots", zValidator("json", createCashSnapshotSchema), async (c) => {
    const { date, entries } = c.req.valid("json");
    const snapshots = await createCashSnapshot(date, entries);
    return c.json(snapshots.map(serializeCashSnapshot), 201);
  })
  .delete("/snapshots/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await deleteCashSnapshot(id);
    if (!deleted) throw new NotFoundError("Cash snapshot not found");
    return c.json({ ok: true });
  })
  .post("/", zValidator("json", createAccountSchema), async (c) => {
    const input = c.req.valid("json");
    const account = await cashAccountRepository.create(input);
    return c.json(serializeAccount(account), 201);
  })
  .put("/:id", zValidator("json", updateAccountSchema), async (c) => {
    const id = c.req.param("id");
    const existing = await cashAccountRepository.findById(id);
    if (!existing) throw new NotFoundError("Account not found");
    const account = await cashAccountRepository.update(id, c.req.valid("json"));
    return c.json(serializeAccount(account));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await cashAccountRepository.findById(id);
    if (!existing) throw new NotFoundError("Account not found");
    await cashAccountRepository.delete(id);
    return c.json({ ok: true });
  });
