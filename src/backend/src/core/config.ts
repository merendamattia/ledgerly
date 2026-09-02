import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

// Centralized, validated environment configuration.
// Fail fast at startup if a required variable is missing or malformed.
const envSchema = z.object({
  APP_ENV: z.string().trim().min(1).default(process.env.NODE_ENV ?? "development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  CRON_SECRET: z.string().min(8),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  // In-process scheduler (no external Coolify task). Per-job schedules live in the
  // DB (seeded CronJob.schedule); CRON_TIMEZONE applies to all of them. CRON_SCHEDULE
  // is legacy and no longer read by the scheduler.
  CRON_ENABLED: z.coerce.boolean().default(true),
  CRON_SCHEDULE: z.string().default("0 2 * * *"),
  CRON_TIMEZONE: z.string().default("Europe/Rome"),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-5.6-luna"),
  OPENAI_REASONING_EFFORT: z.string().trim().min(1).default("low"),
  APPLE_PAY_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(1),
  VAPID_PUBLIC_KEY: optionalNonEmpty,
  VAPID_PRIVATE_KEY: optionalNonEmpty,
  // Apple rejects VAPID JWTs whose subject points at a local-only host.
  // Keep the development default syntactically public; production should set its own address.
  VAPID_SUBJECT: z.string().trim().default("mailto:admin@example.com"),
}).superRefine((env, ctx) => {
  if (!!env.VAPID_PUBLIC_KEY !== !!env.VAPID_PRIVATE_KEY) {
    ctx.addIssue({
      code: "custom",
      message: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together",
      path: ["VAPID_PUBLIC_KEY"],
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
export type Config = typeof config;
export const appleWalletQueueName = `ledgerly-${config.APP_ENV}-apple-wallet-imports`;
