import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { cashAccountRepository } from "../../repositories/cashAccount.ts";
import { cashSnapshotRepository } from "../../repositories/cashSnapshot.ts";
import {
  createCashSnapshot,
  deleteCashSnapshot,
  deleteCashSnapshotsByCategory,
} from "../../services/snapshot.ts";
import {
  cashCategorySchema,
  createAccountSchema,
  createCashSnapshotSchema,
  updateAccountSchema,
} from "../../schemas/index.ts";
import { serializeAccount, serializeCashSnapshot } from "../../utils/serialize.ts";
import { BadRequestError, NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const accountsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const accounts = await cashAccountRepository.list(c.get("user").id);
    return c.json(accounts.map(serializeAccount));
  })
  .get("/snapshots", async (c) => {
    const snapshots = await cashSnapshotRepository.history(c.get("user").id);
    return c.json(snapshots.map(serializeCashSnapshot));
  })
  .post("/snapshots", zValidator("json", createCashSnapshotSchema), async (c) => {
    const { date, entries } = c.req.valid("json");
    const snapshots = await createCashSnapshot(c.get("user").id, date, entries);
    return c.json(snapshots.map(serializeCashSnapshot), 201);
  })
  .delete("/snapshots/categories/:category", async (c) => {
    const parsed = cashCategorySchema.safeParse(c.req.param("category"));
    if (!parsed.success) throw new BadRequestError("Invalid cash snapshot category");
    const result = await deleteCashSnapshotsByCategory(c.get("user").id, parsed.data);
    return c.json(result);
  })
  .delete("/snapshots/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await deleteCashSnapshot(c.get("user").id, id);
    if (!deleted) throw new NotFoundError("Cash snapshot not found");
    return c.json({ ok: true });
  })
  .post("/", zValidator("json", createAccountSchema), async (c) => {
    const input = c.req.valid("json");
    // Keep `type` identifiable per section (LIQUIDITY/CREDIT/OTHER_ASSET), except
    // for BROKER accounts, whose type drives investment-cash exclusion logic.
    if (input.type !== "BROKER") input.type = input.category;
    const account = await cashAccountRepository.create(c.get("user").id, input);
    return c.json(serializeAccount(account), 201);
  })
  .put("/:id", zValidator("json", updateAccountSchema), async (c) => {
    const id = c.req.param("id");
    const existing = await cashAccountRepository.findById(c.get("user").id, id);
    if (!existing) throw new NotFoundError("Account not found");
    const input = c.req.valid("json");
    // Reclassifying a (non-broker) account to another section renames its type too.
    if (input.category !== undefined && existing.type !== "BROKER") {
      input.type = input.category;
    }
    const account = await cashAccountRepository.update(c.get("user").id, id, input);
    if (!account) throw new NotFoundError("Account not found");
    return c.json(serializeAccount(account));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await cashAccountRepository.findById(c.get("user").id, id);
    if (!existing) throw new NotFoundError("Account not found");
    await cashAccountRepository.delete(c.get("user").id, id);
    return c.json({ ok: true });
  });
