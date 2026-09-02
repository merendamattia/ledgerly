# Backend image. Build context must be the REPO ROOT (bun workspace).
#   docker build -f src/backend/Dockerfile -t ledgerly-backend .
FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY src/backend/package.json ./src/backend/package.json
COPY src/frontend/package.json ./src/frontend/package.json
RUN bun install --frozen-lockfile

FROM oven/bun:1.3 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
COPY src/backend ./src/backend
# Push notifications reuse the canonical localized catalogs from the frontend.
COPY src/frontend/src/i18n ./src/frontend/src/i18n
# bun installs workspace deps into the workspace folder (no root hoisting), so the
# backend's node_modules live under src/backend. Copy it AFTER the source so the
# host COPY (node_modules is dockerignored) doesn't shadow it.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/backend/node_modules ./src/backend/node_modules
WORKDIR /app/src/backend
RUN bunx prisma generate
EXPOSE 3001
# Apply migrations, run the idempotent seed, then start the server.
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run db:seed && bun start"]
