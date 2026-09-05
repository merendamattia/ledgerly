import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { randomUUID } from "node:crypto";
import { auth } from "../core/auth.ts";
import { config } from "../core/config.ts";
import { logger } from "../core/logger.ts";
import { AppError } from "../core/errors.ts";
import type { AppEnv } from "./types.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { accountsRoutes } from "./routes/accounts.ts";
import { categoriesRoutes } from "./routes/categories.ts";
import { expensesRoutes } from "./routes/expenses.ts";
import { recurringRoutes } from "./routes/recurring.ts";
import { importRoutes } from "./routes/import.ts";
import { tickersRoutes } from "./routes/tickers.ts";
import { holdingsRoutes } from "./routes/holdings.ts";
import { investmentTransactionsRoutes } from "./routes/investment-transactions.ts";
import { investmentImportRoutes } from "./routes/investment-import.ts";
import { snapshotImportRoutes } from "./routes/snapshot-import.ts";
import { debtsRoutes } from "./routes/debts.ts";
import { rebalanceRoutes } from "./routes/rebalance.ts";
import { pillarsRoutes } from "./routes/pillars.ts";
import { cronRoutes } from "./routes/cron.ts";
import { dashboardRoutes } from "./routes/dashboard.ts";
import { databaseRoutes } from "./routes/database.ts";
import { usersRoutes } from "./routes/users.ts";
import { integrationsRoutes } from "./routes/integrations.ts";
import { notificationsRoutes } from "./routes/notifications.ts";

// The Hono app is the backend's only HTTP surface. Routes are transport-only:
// they validate input, delegate to services, and shape responses. All domain
// logic lives in services/, all DB access in repositories/.
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", async (c, next) => {
  const requestId = randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
});
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "x-cron-secret"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// Better Auth owns the public/session endpoints under /api/auth/*. The admin
// plugin remains available to server-side callers, but its HTTP namespace is
// intentionally not exposed: Ledgerly's users route applies onboarding,
// provisioning, and role policy around account creation.
app.on(["GET", "POST"], "/auth/*", (c) => {
  const pathname = new URL(c.req.url).pathname;
  if (
    pathname === "/api/auth/change-password" ||
    pathname === "/api/auth/admin" ||
    pathname.startsWith("/api/auth/admin/")
  ) {
    return c.json({ error: "Not Found" }, 404);
  }
  return auth.handler(c.req.raw);
});

app.onError((err, c) => {
  const requestId = c.get("requestId");
  // Domain errors carry their own HTTP status.
  if (err instanceof AppError) {
    return c.json({ error: err.message, requestId }, err.status as 400);
  }
  // Prisma "record not found" on update/delete.
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2025") {
    return c.json({ error: "Not found", requestId }, 404);
  }
  const integrationUserId = c.get("integrationUserId");
  logger.error("Unhandled error", {
    path: c.req.path,
    requestId,
    ...(integrationUserId ? { integrationUserId } : {}),
    error: String(err),
  });
  return c.json({ error: "Internal Server Error", code: "INTERNAL_SERVER_ERROR", requestId }, 500);
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

// Feature route groups are chained here so the exported AppType stays accurate
// for the frontend's typed Hono RPC client.
const routes = app
  .get("/health", (c) => c.json({ status: "ok" as const }))
  .route("/users", usersRoutes)
  .route("/settings", settingsRoutes)
  .route("/accounts", accountsRoutes)
  .route("/categories", categoriesRoutes)
  .route("/expenses", expensesRoutes)
  .route("/integrations", integrationsRoutes)
  .route("/notifications", notificationsRoutes)
  .route("/recurring-expenses", recurringRoutes)
  .route("/expenses/import", importRoutes)
  .route("/tickers", tickersRoutes)
  .route("/holdings", holdingsRoutes)
  .route("/investment-transactions/import", investmentImportRoutes)
  .route("/investment-transactions", investmentTransactionsRoutes)
  .route("/snapshots/import", snapshotImportRoutes)
  .route("/debts", debtsRoutes)
  .route("/rebalance-groups", rebalanceRoutes)
  .route("/pillars", pillarsRoutes)
  .route("/cron", cronRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/database", databaseRoutes);

export { app };
export type AppType = typeof routes;
