"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationItem,
} from "@/hooks/use-notifications";
import { formatDateTime, formatMoney } from "@/lib/format";

export function NotificationCenter() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.data?.unreadCount ?? 0;

  function openNotification(notification: NotificationItem) {
    if (!notification.readAt) markRead.mutate(notification.id);
    if (notification.url) router.push(notification.url);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t("badgeLabel", { count: unreadCount })}
          />
        }
      >
        <Bell />
        {unreadCount > 0 ? (
          <Badge className="absolute -top-1 -right-1 min-w-5 justify-center px-1 text-[10px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader className="border-b">
          <div className="flex items-start justify-between gap-3 pr-10">
            <div>
              <SheetTitle>{t("centerTitle")}</SheetTitle>
              <SheetDescription>{t("centerDescription")}</SheetDescription>
            </div>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck data-icon="inline-start" />
                {t("markAllRead")}
              </Button>
            ) : null}
          </div>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">
          {notifications.isPending ? (
            <div className="flex flex-col gap-2 pt-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : notifications.data?.items.length ? (
            notifications.data.items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className="flex min-h-20 w-full items-start gap-3 rounded-xl px-3 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <WalletCards className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {t("importedTitle")}
                    {!notification.readAt ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {notification.amount !== null
                      ? t("expenseAdded", { amount: formatMoney(notification.amount, notification.currency) })
                      : notification.note || t("transactionReady")}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatDateTime(notification.createdAt)}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Bell /></EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
