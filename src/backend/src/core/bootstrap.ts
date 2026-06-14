import { auth } from "./auth.ts";
import { prisma } from "./db.ts";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

/**
 * Create the single admin user from ADMIN_EMAIL / ADMIN_PASSWORD if no user
 * exists yet. Idempotent: does nothing once a user is present.
 */
export async function ensureAdminUser(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  await auth.api.signUpEmail({
    body: {
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD,
      name: "Admin",
    },
  });

  logger.info("Admin user created", { email: config.ADMIN_EMAIL });
}
