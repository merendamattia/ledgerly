# Frontend image. Build context must be the REPO ROOT (bun workspace).
#   docker build -f src/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example .
# NEXT_PUBLIC_API_URL is baked into the client bundle at build time.
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY src/backend/package.json ./src/backend/package.json
COPY src/frontend/package.json ./src/frontend/package.json
RUN bun install --frozen-lockfile
COPY CHANGELOG.md ./CHANGELOG.md
# Backend source is needed for the typed RPC import + its generated Prisma types.
COPY src/backend ./src/backend
COPY src/frontend ./src/frontend
WORKDIR /app/src/backend
RUN bunx prisma generate
WORKDIR /app/src/frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN bun run build

FROM oven/bun:1.3 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app/src/frontend
EXPOSE 3000
CMD ["bun", "run", "start"]
