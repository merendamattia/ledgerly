import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { auth } from "../core/auth.ts";
import { config } from "../core/config.ts";
import { logger } from "../core/logger.ts";
import { AppError } from "../core/errors.ts";
import type { AppEnv } from "./types.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { accountsRoutes } from "./routes/accounts.ts";
import { categoriesRoutes } from "./routes/categories.ts";
import { expensesRoutes } from "./routes/expenses.ts";
import { importRoutes } from "./routes/import.ts";
import { tickersRoutes } from "./routes/tickers.ts";
import { holdingsRoutes } from "./routes/holdings.ts";
import { investmentTransactionsRoutes } from "./routes/investment-transactions.ts";
import { investmentImportRoutes } from "./routes/investment-import.ts";
import { debtsRoutes } from "./routes/debts.ts";
import { cronRoutes } from "./routes/cron.ts";
import { dashboardRoutes } from "./routes/dashboard.ts";
import { databaseRoutes } from "./routes/database.ts";

// The Hono app is the backend's only HTTP surface. Routes are transport-only:
// they validate input, delegate to services, and shape responses. All domain
// logic lives in services/, all DB access in repositories/.
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "x-cron-secret"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// Better Auth owns everything under /api/auth/*.
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.onError((err, c) => {
  // Domain errors carry their own HTTP status.
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status as 400);
  }
  // Prisma "record not found" on update/delete.
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2025") {
    return c.json({ error: "Not found" }, 404);
  }
  logger.error("Unhandled error", { path: c.req.path, error: String(err) });
  return c.json({ error: "Internal Server Error" }, 500);
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

// Feature route groups are chained here so the exported AppType stays accurate
// for the frontend's typed Hono RPC client.
const routes = app
  .get("/health", (c) => c.json({ status: "ok" as const }))
  .route("/settings", settingsRoutes)
  .route("/accounts", accountsRoutes)
  .route("/categories", categoriesRoutes)
  .route("/expenses", expensesRoutes)
  .route("/expenses/import", importRoutes)
  .route("/tickers", tickersRoutes)
  .route("/holdings", holdingsRoutes)
  .route("/investment-transactions/import", investmentImportRoutes)
  .route("/investment-transactions", investmentTransactionsRoutes)
  .route("/debts", debtsRoutes)
  .route("/cron", cronRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/database", databaseRoutes);

export { app };
export type AppType = typeof routes;
