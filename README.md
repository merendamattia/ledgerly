<div align="center">
  <img src="images/logo.png" alt="Ledgerly logo" width="180" height="180" />
  <h1>Ledgerly</h1>
  <p><strong>Self-hosted personal net worth &amp; expense tracker</strong><br/>
  Assets, investments and cash flow in one dashboard.</p>
</div>

---

Ledgerly is a self-hosted app for tracking personal net worth and expenses. Accounts, investments
and cash flow live in one place. Daily price and FX history is stored in Postgres, while Redis
caches frequently requested data. Background jobs fetch provider data, so normal reads do not call
providers directly.

<p align="center">
  <img src="images/ad.webp" alt="Ledgerly overview, wealth, cash flow and activity dashboards on desktop and mobile" width="900" />
</p>

## App sections

The main UI has four sections. See [`DESIGN.md`](./DESIGN.md) for the "modern ledger" design notes.

- Overview shows net worth trends, asset allocation, liquidity, investments, monthly cash flow,
  savings rate, recent movements, and scheduled job history. Administrators can also run jobs
  manually.
- Assets & Investments covers portfolio performance and allocation. The interface is currently
  scaffolded, while tickers, holdings, and daily price and FX history are already in place.
- Expenses & Cash Flow shows income, expenses, monthly cash flow, category breakdowns, and
  cumulative savings.
- Transactions keeps income and expenses in one table with filters and a period selector. The same
  table is intended to include investment trades in the future.

## Features

- Net worth combines cash accounts and investments in one base currency and keeps a daily snapshot
  history.
- Investments can be added by ticker, such as `CSSPX.MI`, `AAPL`, or `BTC`. Ledgerly downloads the
  available daily closing-price history and tracks each holding's value and gain.
- Transactions use categories managed by the user and appear in both the ledger and cash-flow
  reports.
- A nightly job fetches missing daily closes. Reads check Redis first and fall back to Postgres;
  only backfills and scheduled jobs call external providers.

## Stack

| Area      | Choice                                                                 |
| --------- | --------------------------------------------------------------------- |
| Frontend  | Next.js (App Router), TanStack Query, shadcn/ui, Recharts             |
| Backend   | Hono (typed RPC), Prisma 7 + Postgres, Redis (ioredis), Better Auth   |
| Tooling   | Bun (workspaces, test runner), TypeScript                            |
| Providers | Yahoo Finance (equity/ETF/crypto), Frankfurter (FX)                  |

## Architecture

```
src/
  backend/   Hono API — sole owner of the DB, Redis and external providers
             routes → services → repositories → core/db   (one-way layers)
  frontend/  Next.js UI — talks ONLY to the backend over /api/* (typed RPC client)
```

The frontend never accesses the database or external services directly. Every request goes through
the backend, and the exported `AppType` carries request and response types to the frontend.

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
- Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the initial admin is created on first start).

### Accounts

Public registration is disabled. An administrator creates member accounts from Settings with an
email address and temporary password. New members must choose a permanent password before they
can use the application. Each account has independent financial data, categories and settings;
new accounts receive a copy of the administrator's current settings when they are created.

### Useful scripts (run from the repo root)

| Command                 | What it does                            |
| ----------------------- | --------------------------------------- |
| `bun run dev`           | Run backend + frontend                  |
| `bun run dev:backend`   | Run the backend only                    |
| `bun run dev:frontend`  | Run the frontend only                   |
| `bun run db:migrate`    | Create/apply a Prisma migration (dev)   |
| `bun run db:seed`       | Seed system cron job definitions         |

Database changes must go through Prisma migrations, never `db push`.

## Tests & checks

```bash
cd src/backend  && bunx tsc --noEmit && bun test
cd src/frontend && bun run lint && bun run build
```

CI (`.github/workflows/ci.yml`) runs all of these on every push/PR with Postgres + Redis
services, so broken code never lands on the main branch.

## Deployment (Coolify)

Deploy [`docker-compose.prod.yml`](./docker-compose.prod.yml). It builds the backend and frontend
from the repository root. Postgres and Redis are managed Coolify resources passed in through
environment variables.

- Backend: `src/backend/Dockerfile` runs `prisma migrate deploy` and the seed command on start.
- Frontend: `src/frontend/Dockerfile` bakes the `NEXT_PUBLIC_API_URL` build argument into the bundle,
  so it must contain the public backend URL.

Set the environment variables (see [`.env.production.example`](./.env.production.example)):

- Set `DATABASE_URL` from the PostgreSQL resource (internal host, port 5432).
- Set `REDIS_URL` from the Redis resource (internal host).
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_SECRET`,
  `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`.

The nightly price job runs inside the backend process with croner. Its default schedule is 02:20
in `Europe/Rome`; seeded `CronJob` rows define each job schedule, and `CRON_TIMEZONE` sets the
timezone. Coolify does not need a separate scheduled task. The HTTP endpoint remains available to
the cron secret and to administrators who run it manually:

```bash
curl -X POST "$BACKEND_URL/api/cron/nightly-prices/run" -H "x-cron-secret: $CRON_SECRET"
```
