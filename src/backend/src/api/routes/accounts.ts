import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { cashAccountRepository } from "../../repositories/cashAccount.ts";
import { createAccountSchema, updateAccountSchema } from "../../schemas/index.ts";
import { serializeAccount } from "../../utils/serialize.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const accountsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const accounts = await cashAccountRepository.list();
    return c.json(accounts.map(serializeAccount));
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
