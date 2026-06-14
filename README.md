# Ledgerly

Self-hosted web app for tracking your **personal net worth and expenses**. It gives a
centralized view of accounts, investments and cash flow, and **minimizes external provider
calls** by storing all daily price/FX history in Postgres and caching hot reads in Redis.

## Features

- **Net worth** — cash accounts + investments valued in a single base currency, with a daily
  snapshot history.
- **Investments** — add an asset by ticker (e.g. `CSSPX.MI`, `AAPL`, `BTC`); Ledgerly
  downloads the **full daily closing-price history** automatically and tracks your holdings'
  value and gain.
- **Expenses** — income/expense transactions with user-managed categories, filters and a
  cash-flow chart.
- **Dashboard** — net worth trend, asset allocation, monthly cash flow, recent transactions
  and a **scheduled-jobs section** with run history and a manual "Run now".
- **Caching** — a nightly job refreshes only the missing daily closes; reads are served
  cache-first from Redis, then Postgres. External providers are only hit by backfill/cron.

## Stack

| Area      | Choice                                                                 |
| --------- | --------------------------------------------------------------------- |
| Frontend  | Next.js (App Router), TanStack Query, shadcn/ui, Recharts             |
| Backend   | Hono (typed RPC), Prisma 7 + Postgres, Redis (ioredis), Better Auth   |
| Tooling   | Bun (workspaces, test runner), TypeScript                            |
| Providers | Yahoo Finance (equity/ETF), CoinGecko (crypto), Frankfurter (FX)     |

## Architecture

```
src/
  backend/   Hono API — sole owner of the DB, Redis and external providers
             routes → services → repositories → core/db   (one-way layers)
  frontend/  Next.js UI — talks ONLY to the backend over /api/* (typed RPC client)
```

The frontend never accesses the database or external services directly: every request goes
through the backend. Types flow end-to-end via the backend's exported `AppType`.

## Run locally

Prerequisites: [Bun](https://bun.com) and Docker.

```bash
# 1. Configure the backend environment
cp .env.example src/backend/.env        # defaults already match docker-compose

# 2. Start Postgres (5432) and Redis (6380)
docker compose up -d

# 3. Install workspace dependencies
bun install

# 4. Apply migrations and seed base data
bun run db:migrate
bun run db:seed

# 5. Start both apps
bun run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the admin user is created on first start).

### Useful scripts (run from the repo root)

| Command                 | What it does                            |
| ----------------------- | --------------------------------------- |
| `bun run dev`           | Run backend + frontend                  |
| `bun run dev:backend`   | Run the backend only                    |
| `bun run dev:frontend`  | Run the frontend only                   |
| `bun run db:migrate`    | Create/apply a Prisma migration (dev)   |
| `bun run db:seed`       | Seed settings, categories and cron jobs |

Database changes must always go through **Prisma migrations** (never `db push`).

## Tests & checks

```bash
cd src/backend  && bunx tsc --noEmit && bun test
cd src/frontend && bun run lint && bun run build
```

CI (`.github/workflows/ci.yml`) runs all of these on every push/PR with Postgres + Redis
services, so broken code never lands on the main branch.

## Deployment (Coolify)

Deploy [`docker-compose.prod.yml`](./docker-compose.prod.yml) — it builds **backend + frontend**
only (repo root as build context, using the existing Dockerfiles). Postgres and Redis are managed
Coolify resources passed in via env.

- Backend: `src/backend/Dockerfile` (runs `prisma migrate deploy` + seed on start).
- Frontend: `src/frontend/Dockerfile` (`NEXT_PUBLIC_API_URL` build-arg, baked into the bundle →
  must be the **public** backend URL).

Set the environment variables (see [`.env.production.example`](./.env.production.example)):

- From the **PostgreSQL** resource → `DATABASE_URL` (internal host, port 5432).
- From the **Redis** resource → `REDIS_URL` (internal host).
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_SECRET`,
  `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`.

The **nightly price job runs in-process** in the backend (croner, 02:00 `Europe/Rome` by default;
override with `CRON_SCHEDULE` / `CRON_TIMEZONE`). **No Coolify scheduled task is required.** The
HTTP endpoint stays available for a manual trigger:

```bash
curl -X POST "$BACKEND_URL/api/cron/nightly-prices/run" -H "x-cron-secret: $CRON_SECRET"
```
