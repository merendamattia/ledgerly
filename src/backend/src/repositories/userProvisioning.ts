import { prisma } from "../core/db.ts";
import type { UserSettingsDefaults } from "../services/userProvisioning.ts";

/** Persistence adapter for the atomic per-user settings/category snapshot. */
export const userProvisioningRepository = {
  findSettings(userId: string) {
    return prisma.settings.findUnique({ where: { userId } });
  },

  listCategories(userId: string) {
    return prisma.category.findMany({
      where: { userId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  },

  async createIfMissing(userId: string, defaults: UserSettingsDefaults): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.settings.findUnique({ where: { userId } });
      if (existing) return;

      await tx.settings.create({
        data: { userId, baseCurrency: defaults.baseCurrency },
      });
      if (defaults.categories.length === 0) return;

      await tx.category.createMany({
        data: defaults.categories.map((category) => ({ ...category, userId })),
      });
    });
  },
};
