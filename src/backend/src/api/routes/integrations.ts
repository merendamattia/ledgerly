import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ConflictError } from "../../core/errors.ts";
import { personalApiTokenRepository } from "../../repositories/personalApiToken.ts";
import { queueAppleWalletImport } from "../../services/appleWalletImport.ts";
import { integrationTransactionSchema } from "../../schemas/index.ts";
import { requireAuth, requireIntegrationToken } from "../middlewares/auth.ts";
import type { AppEnv } from "../types.ts";

function noStore(c: { header: (name: string, value: string) => void }) {
  c.header("Cache-Control", "no-store");
}

export const integrationsRoutes = new Hono<AppEnv>()
  .get("/token", requireAuth, async (c) => {
    noStore(c);
    return c.json({ token: await personalApiTokenRepository.findMetadata(c.get("user").id) });
  })
  .post("/token", requireAuth, async (c) => {
    const userId = c.get("user").id;
    if (await personalApiTokenRepository.findMetadata(userId)) {
      throw new ConflictError("An integration token already exists");
    }
    noStore(c);
    return c.json(await personalApiTokenRepository.create(userId), 201);
  })
  .post("/token/rotate", requireAuth, async (c) => {
    noStore(c);
    return c.json(await personalApiTokenRepository.rotate(c.get("user").id));
  })
  .delete("/token", requireAuth, async (c) => {
    await personalApiTokenRepository.revoke(c.get("user").id);
    return c.json({ ok: true });
  })
  .post(
    "/transactions",
    requireIntegrationToken,
    zValidator("json", integrationTransactionSchema),
    async (c) => {
      const queued = await queueAppleWalletImport(
        c.get("integrationUserId"),
        c.req.valid("json"),
        c.req.header("Idempotency-Key"),
      );
      return c.json(queued, 202);
    },
  );
