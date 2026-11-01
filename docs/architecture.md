# Architecture

[Documentation index](README.md) · [Development](development.md) · [Deployment](deployment.md)

## Stack and ownership

| Area | Implementation |
| --- | --- |
| Frontend | Next.js App Router, React, TanStack Query, Base UI-based shadcn/ui, Recharts/ECharts, next-intl |
| Backend | Hono typed RPC, Better Auth, Zod, Prisma 7 with pg adapter, PostgreSQL |
| Background/cache | BullMQ, Redis via ioredis, croner scheduler |
| Tooling | Bun workspaces, Bun tests, TypeScript |
| Market data | Yahoo Finance for equity/ETF/crypto; Frankfurter for FX |

```text
src/frontend/     Next.js UI → hooks → typed Hono RPC client → /api/*
src/backend/
  src/api/        routes and middleware (transport/validation)
  src/schemas/    Zod request contracts
  src/services/   domain orchestration, market providers, scheduler and workers
  src/repositories/ persistence access
  src/core/       configuration, Prisma, Redis, auth, bootstrap, logging/errors
  src/utils/      pure helpers
  prisma/         schema, committed migrations and seed
```

The backend owns database, Redis and external service access. The frontend imports the exported
`AppType` through [api-client.ts](../src/frontend/src/lib/api-client.ts) to carry request/response
types; it does not query Prisma or providers directly. Keep API routes chained on the exported
app so RPC inference stays accurate. Backend dependencies flow routes → services → repositories
→ core/db; repositories own Prisma queries. Domain errors in `core/errors.ts` are mapped by
the API error handler.

Better Auth owns auth `User`, `Session`, `Account` and `Verification` records. Financial accounts
use the distinct `CashAccount` model. Public registration is disabled; backend bootstrap creates
the administrator and administrators provision members. Financial data is owner-scoped, while
provider price data can be shared across user-owned tickers. See [Getting started](getting-started.md)
for user onboarding and [AGENTS](../AGENTS.md#internationalization) for localization invariants.

## Providers and cache boundaries

Daily price and FX histories live in PostgreSQL. Latest-price reads check Redis, then stored price
history, and never fetch provider prices. Backfills and scheduled jobs populate provider data;
the nightly job deduplicates provider/symbol sources across users. Latest-price cache entries expire
after 15 minutes and price-history writes invalidate them.

FX lookups are Redis-first, then PostgreSQL, with a 12-hour latest-rate cache. Unlike the price
read path, the general `getFxRate` helper can backfill on a cold database miss, and historical FX
lookup can fall back to latest. Keep this exception explicit when diagnosing provider traffic;
do not claim all backend reads are universally provider-free. Forecast workers instead use
persisted-only FX helpers and do not backfill through a provider.

Yahoo/Frankfurter calls stay in backend market services. Wallet normalization and forecast
interpretation use separate OpenAI adapters in backend services; see [Integrations](integrations.md)
and [Analysis](analysis.md) for what data each sends.

## Scheduled and queued work

The API process hosts the croner scheduler and tracks scheduled/manual runs in PostgreSQL.
Price/FX backfills, daily snapshots and recurring generation are scheduled handlers. The weekly
forecast handler is a producer that enqueues one durable job per user; it does not compute forecasts.
See [Deployment schedules](deployment.md#scheduled-operations) for keys and times.

BullMQ backed by `REDIS_URL` is the delivery authority for Wallet imports, financial forecasts and
interpretations. PostgreSQL stores durable business state and results. A separate worker process
claims and executes jobs with guarded transitions; API/page requests only persist/enqueue work.
Queue names include `APP_ENV`. Recovery re-enqueues durable queued work and reconciles interrupted
runs; keep PostgreSQL and Redis distinct from ephemeral UI/query caches.

Recurring edits and generation share a PostgreSQL row lock and update booked movements and
progress atomically. This is a separate mechanism from BullMQ forecast/import delivery; see
[Recurring transactions](recurring-transactions.md) for schedule semantics and recovery safeguards.
