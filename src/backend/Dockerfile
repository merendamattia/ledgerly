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
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src/backend ./src/backend
WORKDIR /app/src/backend
RUN bunx prisma generate
EXPOSE 3001
# Apply migrations, run the idempotent seed, then start the server.
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run db:seed && bun start"]
