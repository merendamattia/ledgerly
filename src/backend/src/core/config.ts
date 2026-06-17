import { z } from "zod";

// Centralized, validated environment configuration.
// Fail fast at startup if a required variable is missing or malformed.
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  CRON_SECRET: z.string().min(8),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  // In-process scheduler for the nightly price job (no external Coolify task).
  CRON_ENABLED: z.coerce.boolean().default(true),
  CRON_SCHEDULE: z.string().default("0 2 * * *"),
  CRON_TIMEZONE: z.string().default("Europe/Rome"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
export type Config = typeof config;
