import { prisma } from "../core/db.ts";

// Data access for one user's settings row.
export const settingsRepository = {
  findByUserId(userId: string) {
    return prisma.settings.findUnique({ where: { userId } });
  },

  get(userId: string) {
    return prisma.settings.upsert({
      where: { userId },
      update: {},
      create: { user: { connect: { id: userId } } },
    });
  },

  async baseCurrency(userId: string): Promise<string> {
    const settings = await this.get(userId);
    return settings.baseCurrency;
  },

  async update(userId: string, data: { baseCurrency?: string; locale?: "en" | "it" }) {
    const settings = await this.get(userId);
    return prisma.settings.update({ where: { id: settings.id }, data });
  },

  async acknowledgeRelease(userId: string, version: string) {
    const settings = await this.get(userId);
    return prisma.settings.update({
      where: { id: settings.id },
      data: { lastSeenReleaseVersion: version },
    });
  },
};
