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

# 5. Start the backend, Apple Wallet worker, and frontend
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

### iPhone Wallet automation

Settings → Advanced lets each user create one personal integration token for an Apple Shortcuts
Wallet automation. The full secret is returned only when it is generated or rotated; Ledgerly
stores a verifier and only shows the token's short prefix, suffix and creation date afterward.
Treat the secret like a password. Revoke or rotate it in Ledgerly if it is exposed.

The narrow integration endpoint accepts the complete raw Wallet transaction and queues it:

```http
POST /api/integrations/transactions
Authorization: Bearer <personal-token>
Content-Type: application/json
```

The request body is the Shortcut's raw Wallet input; no amount, merchant, category, direction, or
date mapping is required on the phone. Ledgerly persists the request, enqueues it in BullMQ, and a
dedicated worker uses GPT-5.6 Luna Structured Outputs to create the transaction. Repeated identical
payloads are idempotent; callers may also send an `Idempotency-Key` header. The minimal Wallet
`Run Immediately` setup is documented in Settings → Advanced.

After import, Ledgerly stores an in-app notification linked directly to the new transaction. Web
Push is optional: configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`, then enable
notifications in Settings. After enabling them, use **Send test notification** in Settings → Advanced
to verify the complete server-to-browser delivery path. This is Wallet-triggered automation, not bank-account synchronization,
so the backend must be reachable from the iPhone and the authorized amount may differ from the final
amount posted by the card issuer.

### Useful scripts (run from the repo root)

| Command                 | What it does                            |
| ----------------------- | --------------------------------------- |
| `bun run dev`           | Run backend + worker + frontend         |
| `bun run dev:backend`   | Run the backend only                    |
| `bun run dev:frontend`  | Run the frontend only                   |
| `bun run dev:worker`    | Run the Apple Wallet worker only        |
| `bun run docker:build` | Build Docker images with a three-worker cap |
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

For local or CI builds, create the capped BuildKit builder once, then use `bun run docker:build`:

```bash
docker buildx create --name ledgerly-max3 --driver docker-container \
  --buildkitd-config docker/buildkitd.toml --use --bootstrap
bun run docker:build
```

The builder caps BuildKit solver parallelism at three and Compose also caps concurrent service
build calls at three.

- Backend: `src/backend/Dockerfile` runs `prisma migrate deploy` and the seed command on start.
- Worker: the backend image runs a separate BullMQ process with configurable concurrency (default 1).
- Frontend: `src/frontend/Dockerfile` bakes the `NEXT_PUBLIC_API_URL` build argument into the bundle,
  so it must contain the public backend URL.

Set the environment variables (see [`.env.production.example`](./.env.production.example)):

- Set `DATABASE_URL` from the PostgreSQL resource (internal host, port 5432).
- Set `REDIS_URL` from the Redis resource (internal host).
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_SECRET`,
  `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`.
- `OPENAI_API_KEY` for the worker; `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` default to
  `gpt-5.6-luna` and `low`. Worker concurrency defaults to `1`.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to enable Web Push.

The nightly price job runs inside the backend process with croner. Its default schedule is 02:20
in `Europe/Rome`; seeded `CronJob` rows define each job schedule, and `CRON_TIMEZONE` sets the
timezone. Coolify does not need a separate scheduled task. The HTTP endpoint remains available to
the cron secret and to administrators who run it manually:

```bash
curl -X POST "$BACKEND_URL/api/cron/nightly-prices/run" -H "x-cron-secret: $CRON_SECRET"
```
