# Ledgerly — project guide for Claude

> **ALWAYS, before any task: review ALL available skills and use the relevant ones.**
> There may be a skill that solves the problem better (e.g. `bun`, `hono`, `shadcn`,
> `tanstack-query`, `better-auth`, `frontend-design`). This applies to every change.

## What this is
Ledgerly is a self-hosted personal **net worth + expense tracker**. It gives a centralized
view of assets, investments and cash flow, and **minimizes external provider calls** by
persisting all price/FX history in Postgres and caching hot reads in Redis.

## UI sections (the "modern ledger" design — see `DESIGN.md`)
The app shell is a dark ink sidebar + 12-column content grid with four sections:
1. **Overview** (`/`) — net worth, KPIs, allocation, cash-flow + recent movements.
2. **Assets & Investments** (`/investments`) — portfolio (currently a styled scaffold; full build later).
3. **Expenses & Cash Flow** (`/cashflow`) — income/expense analytics.
4. **Transactions** (`/transactions`) — one unified table of all movements. Income/expense exist
   today; investment buy/sell is a placeholder filter until the schema records them.
Admin pages (`/settings`, `/database`, `/accounts`) live in the sidebar footer.

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
- **External providers** (Yahoo for equity/ETF/crypto, Frankfurter for FX) are called **only** from the backfill
  and nightly-cron services, never on a read path. Reads are cache-first (Redis → Postgres).
- **Database changes go through Prisma migrations** (`bun run db:migrate`), never `db push`.

## Local development
1. `cp .env.example src/backend/.env` and fill values (defaults work with docker-compose).
2. `docker compose up -d` (Postgres on 5432, Redis on 6380).
3. `bun install`
4. `bun run db:migrate && bun run db:seed`
5. `bun run dev` → frontend http://localhost:3000, backend http://localhost:3001
6. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (created on first backend start).

## Verify after EVERY change (not optional)
At the end of **every** change, before reporting it done, you MUST verify it actually works
end-to-end — not just that it compiles. A green build is not proof the feature works.
- Run the checks below (types + tests + lint + build).
- Then exercise the affected path at runtime: hit the API endpoint (log in, `curl` it) and/or
  load the page, and confirm real data comes back. Watch for client/server contract mismatches
  (e.g. a query param that exceeds a Zod `max()` returns 400 and the UI silently shows "no data").
- If anything is broken, fix it before moving on. Never report work as complete unverified.

## Checks before pushing
- Backend: `cd src/backend && bunx tsc --noEmit && bun test`
- Frontend: `cd src/frontend && bun run lint && bun run build`
- CI (`.github/workflows/ci.yml`) runs all of the above with Postgres + Redis services.

## Deployment (Coolify)
Deploy with `docker-compose.prod.yml` (backend + frontend only). Postgres and Redis are managed
Coolify resources — copy their internal credentials into `DATABASE_URL` / `REDIS_URL` (see
`.env.production.example`). `NEXT_PUBLIC_API_URL` is baked into the frontend bundle at build, so
it must be the public backend URL.

The nightly jobs run **in-process** in the backend (`services/cron/scheduler.ts`, croner). The
scheduler registers one croner per seeded `CronJob` that has a schedule + a handler: `nightly-prices`
(prices, 02:00), `fx-rates` (FX incl. EUR/USD, 02:00) and `snapshots` (net worth + cash + debt,
03:00, after prices/FX). Per-job schedules live in the DB seed; `CRON_TIMEZONE` (`Europe/Rome`)
applies to all (`CRON_SCHEDULE` is legacy/unused). **No Coolify scheduled task is needed.**
`POST /api/cron/:key/run` (with `x-cron-secret` or a user session) remains only for manual triggers.
