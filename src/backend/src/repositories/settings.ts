import { prisma } from "../core/db.ts";

// Data access for the singleton settings row.
export const settingsRepository = {
  get() {
    return prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
  },

  async baseCurrency(): Promise<string> {
    const settings = await this.get();
    return settings.baseCurrency;
  },

  update(data: { baseCurrency?: string }) {
    return prisma.settings.update({ where: { id: "singleton" }, data });
  },
};
