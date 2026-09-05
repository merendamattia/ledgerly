import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { NotFoundError } from "../../core/errors.ts";
import { appleWalletImportRepository } from "../../repositories/appleWalletImport.ts";
import { walletRequestFiltersSchema } from "../../schemas/index.ts";
import { requireAdmin, requireAuth } from "../middlewares/auth.ts";
import type { AppEnv } from "../types.ts";

function noStore(c: { header: (name: string, value: string) => void }) {
  c.header("Cache-Control", "no-store");
}

/** Makes a date-only filter include the whole selected calendar day. */
function inclusiveEndOfDay(date: Date | undefined) {
  return date ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined;
}

/** Admin-only read surface for Wallet AI request history and exact usage. */
export const walletRequestsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .use("*", requireAdmin)
  .get("/", zValidator("query", walletRequestFiltersSchema), async (c) => {
    noStore(c);
    const query = c.req.valid("query");
    return c.json(
      await appleWalletImportRepository.listAdmin({
        ...query,
        to: inclusiveEndOfDay(query.to),
      }),
    );
  })
  .get("/:id", async (c) => {
    noStore(c);
    const item = await appleWalletImportRepository.findAdminById(c.req.param("id"));
    if (!item) throw new NotFoundError("Wallet request not found");
    return c.json(item);
  });
