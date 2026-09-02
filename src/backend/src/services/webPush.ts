import webpush from "web-push";
import { getMessages, type Locale } from "../../../frontend/src/i18n/config.ts";
import { config } from "../core/config.ts";
import { logger } from "../core/logger.ts";
import { notificationRepository } from "../repositories/notification.ts";

const PUSH_ICON = "/icons/icon-192.png";

type TransactionPushInput = {
  amount: number;
  currency: string;
  direction: "EXPENSE" | "INCOME";
  locale?: string | null;
};

export function transactionPushCopy(input: TransactionPushInput) {
  const locale: Locale = input.locale === "it" ? "it" : "en";
  const amount = new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-US", {
    style: "currency",
    currency: input.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(input.amount));
  const messages = getMessages(locale).notifications;
  return {
    title: messages.importedTitle,
    body: (input.direction === "EXPENSE" ? messages.expenseAdded : messages.incomeAdded).replace("{amount}", amount),
  };
}

if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
}

async function sendPush(userId: string, payload: Record<string, string>) {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return 0;
  const subscriptions = await notificationRepository.subscriptions(userId);
  const delivered = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
        return true;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await notificationRepository.removeSubscription(subscription.endpointHash);
        } else {
          logger.warn("Web Push delivery failed", { statusCode });
        }
        return false;
      }
    }),
  );
  return delivered.filter(Boolean).length;
}

/** Sends a best-effort Push API notification after the durable notification exists. */
export async function sendTransactionPush(
  userId: string,
  transactionId: string,
  transaction: TransactionPushInput,
) {
  const copy = transactionPushCopy(transaction);
  await sendPush(userId, {
    title: copy.title,
    body: copy.body,
    icon: PUSH_ICON,
    badge: PUSH_ICON,
    url: `/transactions?transaction=${encodeURIComponent(transactionId)}&edit=1`,
    tag: `apple-wallet-${transactionId}`,
  });
}

/** Verifies the full server-to-browser push path without creating domain data. */
export function sendTestPush(userId: string) {
  return sendPush(userId, {
    title: "Ledgerly",
    icon: PUSH_ICON,
    badge: PUSH_ICON,
    url: "/settings",
    tag: "ledgerly-push-test",
  });
}
