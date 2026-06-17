import { app } from "./api/app.ts";
import { config } from "./core/config.ts";
import { ensureAdminUser } from "./core/bootstrap.ts";
import { startScheduler } from "./services/cron/scheduler.ts";
import { logger } from "./core/logger.ts";

// Ensure the single admin user exists before accepting traffic.
await ensureAdminUser();

// Start the in-process nightly scheduler (no external Coolify task needed).
if (config.CRON_ENABLED) await startScheduler();

logger.info("Backend started", { port: config.PORT });

// Bun serves the default export's `fetch` handler on the given port.
export default {
  port: config.PORT,
  fetch: app.fetch,
};
