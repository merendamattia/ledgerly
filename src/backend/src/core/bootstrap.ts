import { auth } from "./auth.ts";
import { prisma } from "./db.ts";
import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { provisionUser } from "../services/userProvisioning.ts";

/**
 * Ensure the configured bootstrap account is the initial admin and has a
 * provisioned settings snapshot. Existing legacy installations keep their
 * account and all personal data; fresh installations create the account via
 * Better Auth's server-side admin API.
 */
export async function ensureAdminUser(): Promise<void> {
  const configured = await prisma.user.findUnique({ where: { email: config.ADMIN_EMAIL } });
  if (configured) {
    await provisionBootstrapAdmin(configured.id);
    return;
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });
  if (existingAdmin) {
    await provisionBootstrapAdmin(existingAdmin.id);
    return;
  }

  if (await prisma.user.count() > 0) return;

  const { user } = await auth.api.createUser({
    body: {
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD,
      name: "Admin",
      role: "admin",
    },
  });
  await provisionBootstrapAdmin(user.id);

  logger.info("Admin user created", { email: config.ADMIN_EMAIL });
}

/** Keeps the bootstrap account blocked until its personal defaults exist. */
async function provisionBootstrapAdmin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role: "admin", mustChangePassword: true },
  });
  await provisionUser(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: false },
  });
}
