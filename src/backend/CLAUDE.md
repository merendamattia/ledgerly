# Backend (Hono) — guide for Claude

> **ALWAYS, before any task: review ALL available skills and use the relevant ones**
> (`hono`, `bun`, `better-auth`, ...). There may be a skill that solves the problem better.

The backend is the **only** owner of the database, Redis and external market-data providers.

## Layered architecture (one-way dependencies)
```
api/        Hono app + routes (transport-only) + middlewares
            -> validate input, delegate to a service, shape the response. NO business logic.
core/       config (validated env), db (Prisma client), redis, logger, errors, auth, bootstrap
schemas/    Zod schemas used by @hono/zod-validator at the route boundary
repositories/  the ONLY place that issues Prisma queries (one module per entity)
services/   domain logic; orchestrate repositories + providers + cache
  market/   providers/ (yahoo, frankfurter), backfill, fx, quotes
  cron/     runner (opens/closes a CronRun), jobs (registry of runnable jobs)
utils/      pure helpers (no I/O)
```
**Rules**
- Routes must not touch Prisma directly — go through a repository via a service.
- Providers are called only by `services/market` (backfill + nightly cron). Read paths
  (`quotes.latestPrice`, `fx.getFxRate`) are cache-first: Redis → Postgres, never a provider.
- Throw `AppError`/`NotFoundError`/`ConflictError` (`core/errors.ts`); `app.onError` maps them.
- Keep every route chained on the exported app so `AppType` stays accurate for the RPC client.

## Database
- Prisma 7 with the **pg driver adapter** (`core/db.ts`). The datasource URL lives in
  `prisma.config.ts`, not the schema.
- **Always** evolve the schema with migrations: `bun run db:migrate` (dev),
  `bun run db:deploy` (prod). Seed: `bun run db:seed`.
- Auth tables (`User/Session/Account/Verification`) are owned by Better Auth; the financial
  account model is `CashAccount` to avoid the name clash.

## Auth
Public sign-up is disabled. The initial administrator is created at startup from
`ADMIN_EMAIL`/`ADMIN_PASSWORD` (`core/bootstrap.ts`); administrators provision member accounts
through the Better Auth admin API, and all financial repositories require the authenticated owner.

## Commands
- `bun run dev` (hot reload) · `bun start` · `bun test` · `bunx tsc --noEmit`
