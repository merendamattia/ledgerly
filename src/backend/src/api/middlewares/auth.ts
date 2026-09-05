import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "../../core/auth.ts";
import { config } from "../../core/config.ts";
import { logger } from "../../core/logger.ts";
import { personalApiTokenRepository } from "../../repositories/personalApiToken.ts";
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
  if (data.user.mustChangePassword && c.req.path !== "/api/users/password") {
    return c.json(
      { error: "Password change required", code: "PASSWORD_CHANGE_REQUIRED" as const },
      403,
    );
  }
  await next();
});

/** Require an authenticated user with the Better Auth admin role. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
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
  if (data.user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("user", data.user);
  c.set("session", data.session);
  await next();
});

const bearerTokenPattern = /^ledgerly_[A-Za-z0-9_-]{43}$/;

function readBearerToken(value: string | undefined): string | null {
  const match = value?.match(/^Bearer[ \t]+([^ \t]+)$/i);
  if (!match || !bearerTokenPattern.test(match[1])) return null;
  return match[1];
}

function integrationAuthenticationFailure(
  c: Context<AppEnv>,
  reason: "missing_authorization" | "invalid_bearer_format" | "unknown_token",
) {
  const requestId = c.get("requestId");
  logger.warn("Apple Wallet integration authentication failed", { requestId, reason });
  return c.json(
    {
      error: "Unauthorized",
      code: "INTEGRATION_AUTHENTICATION_FAILED",
      requestId,
    },
    401,
  );
}

/** Authenticates only the narrow external integration surface. User role is intentionally not consulted. */
export const requireIntegrationToken = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization) return integrationAuthenticationFailure(c, "missing_authorization");

  const token = readBearerToken(authorization);
  if (!token) return integrationAuthenticationFailure(c, "invalid_bearer_format");

  const record = await personalApiTokenRepository.findUserBySecret(token);
  if (!record) return integrationAuthenticationFailure(c, "unknown_token");

  c.set("integrationUserId", record.userId);
  await next();
});
