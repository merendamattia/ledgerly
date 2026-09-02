import { createHash } from "node:crypto";
import { prisma } from "../core/db.ts";

export const notificationRepository = {
  async list(userId: string) {
    const [items, unreadCount, settings] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        include: { transaction: { select: { note: true, amount: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.settings.findUnique({ where: { userId }, select: { baseCurrency: true } }),
    ]);
    return { items, unreadCount, currency: settings?.baseCurrency ?? "EUR" };
  },

  markRead(userId: string, id: string) {
    return prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  subscriptions(userId: string) {
    return prisma.pushSubscription.findMany({ where: { userId } });
  },

  async pushConfiguration(userId: string) {
    const [settings, subscriptionCount] = await Promise.all([
      prisma.settings.upsert({ where: { userId }, update: {}, create: { userId } }),
      prisma.pushSubscription.count({ where: { userId } }),
    ]);
    return { settings, subscriptionCount };
  },

  async saveSubscription(userId: string, subscription: { endpoint: string; p256dh: string; auth: string }) {
    const endpointHash = createHash("sha256").update(subscription.endpoint).digest("hex");
    await prisma.$transaction([
      prisma.pushSubscription.upsert({
        where: { endpointHash },
        create: { userId, endpointHash, ...subscription },
        update: { userId, ...subscription },
      }),
      prisma.settings.update({
        where: { userId },
        data: { pushNotificationsEnabled: true },
      }),
    ]);
  },

  async removeSubscriptions(userId: string) {
    await prisma.$transaction([
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.settings.update({
        where: { userId },
        data: { pushNotificationsEnabled: false },
      }),
    ]);
  },

  removeSubscription(endpointHash: string) {
    return prisma.pushSubscription.deleteMany({ where: { endpointHash } });
  },
};
