import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ConflictError } from "../../core/errors.ts";
import { logger } from "../../core/logger.ts";
import { personalApiTokenRepository } from "../../repositories/personalApiToken.ts";
import { AppleWalletEnqueueError, queueAppleWalletImport } from "../../services/appleWalletImport.ts";
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
    zValidator("json", integrationTransactionSchema, (result, c) => {
      if (result.success) return;

      const appContext = c as unknown as Context<AppEnv>;

      logger.warn("Apple Wallet integration payload validation failed", {
        requestId: appContext.get("requestId"),
        integrationUserId: appContext.get("integrationUserId"),
        issues: result.error.issues.map(({ code, path, message }) => ({ code, path, message })),
      });
      return appContext.json(
        {
          error: "Invalid Wallet payload",
          code: "INTEGRATION_PAYLOAD_INVALID",
          requestId: appContext.get("requestId"),
        },
        400,
      );
    }),
    async (c) => {
      const requestId = c.get("requestId");
      const integrationUserId = c.get("integrationUserId");

      try {
        const queued = await queueAppleWalletImport(
          integrationUserId,
          c.req.valid("json"),
          c.req.header("Idempotency-Key"),
          undefined,
          c.get("integrationTokenHint"),
        );
        logger.info("Apple Wallet integration request queued", {
          requestId,
          integrationUserId,
          importId: queued.id,
          status: queued.status,
          duplicate: queued.duplicate,
        });
        return c.json(queued, 202);
      } catch (error) {
        if (!(error instanceof AppleWalletEnqueueError)) throw error;

        logger.error("Apple Wallet integration queue handoff failed", {
          requestId,
          integrationUserId,
          importId: error.importId,
          error: error.message,
        });
        return c.json(
          {
            error: "Apple Wallet import could not be queued",
            code: "INTEGRATION_QUEUE_FAILED",
            requestId,
          },
          503,
        );
      }
    },
  );
