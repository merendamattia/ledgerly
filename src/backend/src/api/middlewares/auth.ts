import { createMiddleware } from "hono/factory";
import { auth } from "../../core/auth.ts";
import { config } from "../../core/config.ts";
import type { AppEnv } from "../types.ts";

/**
 * Require a valid Better Auth session. On success, exposes the user and session
 * on the Hono context. Responds 401 otherwise.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const data = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!data) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", data.user);
  c.set("session", data.session);
  await next();
});

/**
 * Allow access when either a valid cron secret header is present (used by the
 * external scheduler) or a logged-in user makes the request (manual trigger).
 */
export const requireCronOrAuth = createMiddleware<AppEnv>(async (c, next) => {
  const secret = c.req.header("x-cron-secret");
  if (secret && secret === config.CRON_SECRET) {
    await next();
    return;
  }
  const data = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!data) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", data.user);
  c.set("session", data.session);
  await next();
});
