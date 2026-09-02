import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { config } from "../../core/config.ts";
import { BadRequestError } from "../../core/errors.ts";
import { notificationRepository } from "../../repositories/notification.ts";
import { pushSubscriptionSchema } from "../../schemas/index.ts";
import { sendTestPush } from "../../services/webPush.ts";
import { requireAuth } from "../middlewares/auth.ts";
import type { AppEnv } from "../types.ts";

export const notificationsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const result = await notificationRepository.list(c.get("user").id);
    return c.json({
      unreadCount: result.unreadCount,
      items: result.items.map((notification) => ({
        id: notification.id,
        kind: notification.kind,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        transactionId: notification.transactionId,
        note: notification.transaction?.note ?? null,
        amount: notification.transaction ? Number(notification.transaction.amount) : null,
        currency: result.currency,
        url: notification.transactionId
          ? `/transactions?transaction=${encodeURIComponent(notification.transactionId)}&edit=1`
          : null,
      })),
    });
  })
  .patch("/:id/read", async (c) => {
    await notificationRepository.markRead(c.get("user").id, c.req.param("id"));
    return c.json({ ok: true as const });
  })
  .post("/read-all", async (c) => {
    await notificationRepository.markAllRead(c.get("user").id);
    return c.json({ ok: true as const });
  })
  .get("/push/config", async (c) => {
    const { settings, subscriptionCount } = await notificationRepository.pushConfiguration(c.get("user").id);
    return c.json({
      available: !!config.VAPID_PUBLIC_KEY,
      publicKey: config.VAPID_PUBLIC_KEY ?? null,
      enabled: settings?.pushNotificationsEnabled ?? false,
      subscribed: subscriptionCount > 0,
    });
  })
  .post("/push/test", async (c) => {
    if ((await sendTestPush(c.get("user").id)) === 0) {
      throw new BadRequestError("Push notifications are not enabled");
    }
    return c.json({ ok: true as const });
  })
  .post("/push/subscriptions", zValidator("json", pushSubscriptionSchema), async (c) => {
    const subscription = c.req.valid("json");
    await notificationRepository.saveSubscription(c.get("user").id, {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
    return c.json({ ok: true as const }, 201);
  })
  .delete("/push/subscriptions", async (c) => {
    await notificationRepository.removeSubscriptions(c.get("user").id);
    return c.json({ ok: true as const });
  });
