# Ledgerly — project guide for Claude

> **ALWAYS, before any task: review ALL available skills and use the relevant ones.**
> There may be a skill that solves the problem better (e.g. `bun`, `hono`, `shadcn`,
> `tanstack-query`, `better-auth`, `frontend-design`). This applies to every change.

## What this is
Ledgerly is a self-hosted personal **net worth + expense tracker**. It gives a centralized
view of assets, investments and cash flow, and **minimizes external provider calls** by
persisting all price/FX history in Postgres and caching hot reads in Redis.

## Monorepo layout (bun workspaces)
```
src/backend    # Hono API (the ONLY owner of the database, Redis and external providers)
src/frontend   # Next.js App Router UI (talks ONLY to the backend over /api/*)
```
- Package manager: **bun**. Lockfile lives at the repo root (`bun.lock`).
- Run both: `bun run dev`. Individually: `bun run dev:backend`, `bun run dev:frontend`.

## Architecture rules (must hold)
- **Frontend → backend only.** The UI never imports Prisma/Redis/providers and never calls
  external services. All data flows through the typed Hono RPC client (`src/lib/api-client.ts`),
  whose types come from the backend's exported `AppType`.
- **Backend is layered**, one-way dependencies: `routes → services → repositories → core/db`.
  See `src/backend/CLAUDE.md`.
- **External providers** (Yahoo, CoinGecko, Frankfurter) are called **only** from the backfill
  and nightly-cron services, never on a read path. Reads are cache-first (Redis → Postgres).
- **Database changes go through Prisma migrations** (`bun run db:migrate`), never `db push`.

## Local development
1. `cp .env.example src/backend/.env` and fill values (defaults work with docker-compose).
2. `docker compose up -d` (Postgres on 5432, Redis on 6380).
3. `bun install`
4. `bun run db:migrate && bun run db:seed`
5. `bun run dev` → frontend http://localhost:3000, backend http://localhost:3001
6. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (created on first backend start).

## Checks before pushing
- Backend: `cd src/backend && bunx tsc --noEmit && bun test`
- Frontend: `cd src/frontend && bun run lint && bun run build`
- CI (`.github/workflows/ci.yml`) runs all of the above with Postgres + Redis services.

## Deployment (Coolify)
Deploy with `docker-compose.prod.yml` (backend + frontend only). Postgres and Redis are managed
Coolify resources — copy their internal credentials into `DATABASE_URL` / `REDIS_URL` (see
`.env.production.example`). `NEXT_PUBLIC_API_URL` is baked into the frontend bundle at build, so
it must be the public backend URL.

The nightly price job runs **in-process** in the backend (`services/cron/scheduler.ts`, croner,
02:00 `Europe/Rome` by default — override via `CRON_SCHEDULE`/`CRON_TIMEZONE`). **No Coolify
scheduled task is needed.** `POST /api/cron/:key/run` (with `x-cron-secret` or a user session)
remains only for manual triggers.
