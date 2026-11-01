# Development

[Documentation index](README.md) · [Contribution process](../CONTRIBUTING.md)

Ledgerly uses Bun workspaces with a root `bun.lock`. The current CI pins Bun **1.3.14**.
Application dependencies are installed with Bun; Python is used only for Git hooks.

## Local setup

Requirements: Bun, Docker with Compose, and Git. Run these from the repository root:

```bash
cp .env.example src/backend/.env
```

Edit that local file before starting. The example is a template, not a working local configuration:
set `DATABASE_URL` to your local Compose PostgreSQL instance (host port **5432**, database/user
`ledgerly`, password matching the local Compose file), and `REDIS_URL` to `redis://localhost:6380`.
Set `BETTER_AUTH_URL` to `http://localhost:3001`, `FRONTEND_URL` to `http://localhost:3000`,
and choose your own `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `BETTER_AUTH_SECRET` and `CRON_SECRET`.
Use a strong random auth secret (at least 32 characters) and a password/cron secret of at least
8 characters. Keep credentials out of Git.

```bash
docker compose up -d
bun install --frozen-lockfile
bun run db:generate
bun run db:migrate
bun run db:seed
bun run dev
```

The frontend is at <http://localhost:3000> and backend at <http://localhost:3001>.
`bun run dev` starts the backend, BullMQ workers and frontend. Sign in with your configured admin
credentials; see [Getting started](getting-started.md) for onboarding and financial records.
The frontend defaults to the local backend; if overriding public frontend settings, configure
`src/frontend/.env.local`. A backend-only environment file is not loaded by the frontend.

OpenAI is needed for Wallet normalization and optional forecast interpretation, not for ordinary
manual bookkeeping. Configure it on the worker as described in [Deployment](deployment.md).

## Commands and migrations

| Root command | Purpose |
| --- | --- |
| `bun run dev` | Backend + worker + frontend |
| `bun run dev:backend` | Backend only |
| `bun run dev:frontend` | Frontend only |
| `bun run dev:worker` | BullMQ workers only |
| `bun run db:generate` | Generate Prisma client (also needed by frontend RPC types) |
| `bun run db:migrate` | Create/apply development migrations |
| `bun run db:deploy` | Apply committed migrations |
| `bun run db:seed` | Seed system cron definitions idempotently |
| `bun run typecheck` | Backend TypeScript check |
| `bun run lint` | Frontend ESLint |
| `bun run test` | Both workspace test suites |
| `bun run verify` | Typecheck, lint and tests |
| `bun run build` | Both workspace builds; Next.js also checks frontend types |
| `bun run docker:build` | Production images with the capped builder below |

Database changes must use committed Prisma migrations, never `db push`. Prisma 7 uses the pg
adapter in `core/db.ts`; the connection URL is configured in `src/backend/prisma.config.ts`.
The seed provisions cron definitions; backend bootstrap provisions the admin and user defaults.

## Validation

Install dependencies and generate Prisma before the first check. Tests are colocated with code
as `*.test.ts` and `*.test.tsx`. Use one relevant behavior regression test for non-trivial changes,
then reproduce the applicable CI checks before pushing:

```bash
pre-commit run --all-files
bun run db:deploy
bun run verify
bun run build
```

Run against an isolated local test database and Redis, never production. Export the environment
required by [CI](../.github/workflows/ci.yml): `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_SECRET`, `FRONTEND_URL`, `PORT`, and
frontend `NEXT_PUBLIC_API_URL`. Use local test credentials and URLs. CI uses PostgreSQL 17 and
Redis 7; its Redis host port is **6379**, whereas local Compose exposes **6380**.

The CI backend job generates Prisma, deploys migrations, typechecks, tests and builds.
The frontend job generates Prisma, lints, tests and builds. The separate
[pre-commit workflow](../.github/workflows/conventional-commits-check.yaml) runs all hooks and
validates Conventional Commits. The `commit-msg` hook runs at commit time, not in the all-files pass.

Also exercise the affected API or UI path: authenticate where necessary, confirm actual responses,
and check for validation/client contract mismatches rather than treating an empty screen as success.
For visible UI changes, check desktop/mobile layouts, interactions, errors and console output.
For documentation, check relative links, image paths, anchors and rendered desktop/mobile navigation.

## Container builds

When Dockerfiles or Compose change, build both images with repository-root context, matching the
[image workflow](../.github/workflows/check-docker-image.yaml):

```bash
docker build -f src/backend/Dockerfile .
docker build -f src/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 .
```

For local/CI Compose builds, create the capped BuildKit builder once:

```bash
docker buildx create --name ledgerly-max3 --driver docker-container \
  --buildkitd-config docker/buildkitd.toml --use --bootstrap
bun run docker:build
```

The builder caps solver parallelism at three and the root script caps concurrent Compose service
build calls at three. See [Deployment](deployment.md) for runtime configuration and operations.
