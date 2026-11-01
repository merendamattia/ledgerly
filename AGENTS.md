# Ledgerly agent rules

Read this file before each task. It is the single source of truth for shared coding-agent
instructions. Also follow applicable nested, scope-specific instructions (currently
[backend](src/backend/CLAUDE.md) and [frontend components](src/frontend/src/components/CLAUDE.md)).
Review available skills and use those relevant to the task.

## Repository and documentation map

| Location | Responsibility |
| --- | --- |
| [README](README.md) | Accurate public product overview; concise links, no technical runbooks |
| [docs index](docs/README.md) | User guides and authoritative technical/operator references |
| [Development](docs/development.md) | Bun setup, migrations, commands, tests and CI validation |
| [Architecture](docs/architecture.md) | Backend/frontend boundaries, providers, caches and job ownership |
| [Deployment](docs/deployment.md) | Environment, services, schedules and operations |
| [Integrations](docs/integrations.md), [Analysis](docs/analysis.md), [Recurring transactions](docs/recurring-transactions.md) | Feature contracts, limitations and recovery |
| [CONTRIBUTING](CONTRIBUTING.md) | Contribution process, commits and PRs targeting `develop` |
| [PRODUCT](PRODUCT.md), [DESIGN](DESIGN.md) | Product principles and canonical interface design system |
| [Backend](src/backend/src), [Prisma](src/backend/prisma) | Hono API, services, repositories, schema and migrations |
| [Frontend](src/frontend/src), [API client](src/frontend/src/lib/api-client.ts) | Next.js UI and typed Hono RPC |
| [Backend tests](src/backend/src/services), [frontend tests](src/frontend/src/components), [CI](.github/workflows/ci.yml) | Colocated `*.test.ts`/`*.test.tsx`; also inspect schemas, utils, lib and i18n tests |

## Implementation and maintenance

- Use Bun workspaces and the root `bun.lock`; reuse existing code and relevant skills.
- Keep frontend data access behind the backend and typed RPC/hooks. Keep backend dependencies
  one-way: routes → services → repositories → core/db. Prisma queries belong in repositories.
- Keep market-provider access in backend market services; price reads use Redis → PostgreSQL.
  Preserve persisted-only forecast reads and worker ownership of durable queued work. See the
  [architecture exceptions and boundaries](docs/architecture.md#providers-and-cache-boundaries).
- Evolve the database through Prisma migrations (`bun run db:migrate`), never `db push`.
- Record new behavior, setup/configuration, architecture and recovery knowledge in the matching
  `docs/` guide. Update public feature claims only in README, product intent in PRODUCT, design
  rules in DESIGN, and contribution workflow in CONTRIBUTING. Update this map when adding guides;
  do not duplicate runbooks or shared rules in CLAUDE files. Keep root CLAUDE as a pointer here.
- Before reporting completion, run the relevant [development checks](docs/development.md#validation)
  and reproduce applicable GitHub Actions locally. Exercise the affected API/UI path with real
  responses; compilation alone is insufficient. For docs, check links, images and rendered desktop/
  mobile navigation. Fix failures and report actual checks and limitations. If Docker/Compose or
  Dockerfiles change, also build both images as described in the development guide.

## Internationalization

- All Ledgerly-owned user-facing copy belongs in `src/frontend/src/i18n/messages/en.json` and `it.json` and must be rendered through `next-intl`. When touching UI copy, update both catalogs in the same change.
- Keep English (`en`) as the default and fallback locale. Register future locales in `src/frontend/src/i18n/config.ts` and validate the same locale in the backend Settings schema.
- Never localize with component-level locale conditionals or duplicate translated JSX strings.
- Keep user-created and external free text unchanged, including account/category names, symbols, notes, and imported descriptions.
- Presentation formatting must follow the active application locale through `src/frontend/src/lib/format.ts`; API values, ISO dates, stored values, and currency semantics stay locale-independent.
- Any touched localization behavior must retain or add the smallest relevant test for catalog fallback, formatting, persistence, or onboarding.
