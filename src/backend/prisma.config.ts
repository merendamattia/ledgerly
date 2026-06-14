import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 configuration. The config file is evaluated by the Prisma CLI's own
// loader, so we load `.env` explicitly to make DATABASE_URL available here.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Connection URL used by the CLI for migrate / introspect commands.
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "bun prisma/seed.ts",
  },
});
