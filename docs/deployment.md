# Deployment and operations

[Documentation index](README.md) · [First-use workflow](getting-started.md)

## Production services

Deploy [docker-compose.prod.yml](../docker-compose.prod.yml) in Coolify, or with a Compose-capable
container host configured with equivalent routing and external resources. It builds three services
from the repository root:

- **Backend** (port 3001): Hono API, authentication and in-process scheduler. The image applies
  `prisma migrate deploy` and runs the seed before starting.
- **Worker**: the backend image with a separate BullMQ worker command. It applies migrations before
  `start:worker`. Keep this process running for Wallet imports, forecasts and interpretations.
- **Frontend** (port 3000): Next.js browser interface. Its public API URL and Shortcut URL are
  baked into the bundle at build time.

PostgreSQL and Redis are external production resources; the production Compose file does not
provision them. Local [docker-compose.yml](../docker-compose.yml) supplies PostgreSQL 17 and
Redis 7 for development only. Keep their data persistent and back up PostgreSQL before upgrades.
Redis is the BullMQ delivery store as well as a cache; losing it can interrupt queued work.

Configure HTTPS routes for the frontend and backend, network access to the managed resources,
and appropriate restart/monitoring policies. The production file exposes service ports internally;
it does not publish host ports or configure a reverse proxy for you. Verify startup logs and an
actual sign-in after deployment; do not treat container start order as service readiness.

## Environment configuration

Use [.env.production.example](../.env.production.example) as the variable checklist and
[src/backend/src/core/config.ts](../src/backend/src/core/config.ts) as the validation source.
Replace all template credentials; never commit real values.

| Variables | Purpose |
| --- | --- |
| `DATABASE_URL`, `REDIS_URL` | Internal PostgreSQL and Redis connection URLs from managed resources |
| `BETTER_AUTH_SECRET` | Strong random authentication secret; use at least 32 characters |
| `BETTER_AUTH_URL` | Public HTTPS backend URL |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Initial administrator bootstrap credentials |
| `CRON_SECRET` | Secret for authenticated manual scheduler HTTP triggers |
| `FRONTEND_URL` | Public frontend origin allowed by backend CORS |
| `NEXT_PUBLIC_API_URL` | Public backend URL, supplied as a frontend build argument |
| `NEXT_PUBLIC_APPLE_PAY_SHORTCUT_URL` | Shared iCloud Shortcut URL, supplied as a frontend build argument |
| `APP_ENV` | Queue namespace; use the same value for backend and worker and separate instances/environments |
| `OPENAI_API_KEY` | Worker OpenAI credential for Wallet normalization and optional forecast interpretation |
| `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` | Current repository defaults: `gpt-5.6-luna` and `low`; configure for your available model |
| `APPLE_PAY_WORKER_CONCURRENCY` | Wallet worker parallelism; default 1, allowed 1–20 |
| `FINANCIAL_FORECAST_WORKER_CONCURRENCY`, `FINANCIAL_ANALYSIS_WORKER_CONCURRENCY` | Forecast and interpretation parallelism; default 1 each, allowed 1–4 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional Web Push; configure matching keys on backend and worker and a public contact subject |
| `CRON_TIMEZONE` | Scheduler timezone; default `Europe/Rome` |

`PORT` defaults to 3001; Compose fixes the backend port at 3001. `CRON_ENABLED` controls scheduler
startup, while schedules come from seeded database rows. `CRON_SCHEDULE` is legacy and unused.
Use the documented default `true` unless testing a deployment-specific override; configuration
currently coerces strings with Zod, so the literal string `false` must not be assumed to disable it.

Keep OpenAI credentials on the worker. Never put secrets in `NEXT_PUBLIC_*`: those values are
public browser configuration. Rebuild the frontend when public URLs change. Generate VAPID keys
once with `bunx web-push generate-vapid-keys` if enabling push; keep the private key secret and
use a real public contact for `VAPID_SUBJECT`. See [Integrations](integrations.md) for data flows.

## Scheduled operations

The backend registers croner tasks from enabled, seeded `CronJob` rows. No separate Coolify
scheduled task is needed. Seeded schedules, in `CRON_TIMEZONE`, are:

| Key | Default time | Effect |
| --- | --- | --- |
| `recurring-expenses` | Daily 01:10 | Book due recurring income/expenses |
| `fx-rates` | Daily 02:00 | Refresh EUR/USD and user valuation currency pairs |
| `nightly-prices` | Daily 02:20 | Fetch missing daily closes for tracked provider assets |
| `snapshots` | Daily 03:00 | Record cash/debt balances and net worth after FX/prices |
| `weekly-financial-forecast` | Monday 04:00 | Enqueue one 20-year forecast per user |
| `backfill` | Manual only | Full provider-price history repair |

Schedules and handlers are defined in [seed.ts](../src/backend/prisma/seed.ts) and
[cron jobs](../src/backend/src/services/cron/jobs.ts). Re-running the seed restores those schedule
definitions. Runs are recorded in `CronRun`; administrators can inspect history and run jobs
manually from the app. The protected HTTP trigger also remains available:

```bash
curl -X POST "$BACKEND_URL/api/cron/nightly-prices/run" -H "x-cron-secret: $CRON_SECRET"
```

Use variables from your private runtime environment; do not paste secrets into shared terminals
or logs. The endpoint accepts a cron secret or an administrator session. The weekly task produces
queued work; the worker performs the forecast, never the page request.

## Upgrades and recovery

Back up the database and retain the previous release/configuration before applying migrations.
Deploy compatible backend and worker versions together. For the recurring locking change, stop
older backend/worker processes before starting the new version so no old generator writes outside
the locking protocol. Deployment performs no automatic duplicate cleanup or history rewrite;
follow [Recurring transactions](recurring-transactions.md) for reviewed recovery.

If jobs stop progressing, check Redis reachability, matching `APP_ENV`, worker logs and durable
job state. Inspect scheduler run history for price/FX/snapshot failures. Never run durable Wallet
or forecast jobs inline as a workaround. See [Architecture](architecture.md) for the distinction
between scheduled handlers and worker-owned queues. For capped image builds, use
[Development → Container builds](development.md#container-builds).
