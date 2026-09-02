import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { invalidateLedgerQueries, queryKeys } from "@/lib/query-keys";

export type Notifications = InferResponseType<typeof api.notifications.$get, 200>;
export type NotificationItem = Notifications["items"][number];
export type PushConfiguration = InferResponseType<
  (typeof api.notifications.push.config)["$get"],
  200
>;

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => unwrap<Notifications>(await api.notifications.$get()),
    enabled,
    refetchInterval: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ ok: true }>(await api.notifications[":id"].read.$patch({ param: { id } })),
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.notifications]),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap<{ ok: true }>(await api.notifications["read-all"].$post()),
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.notifications]),
  });
}

export function usePushConfiguration() {
  return useQuery({
    queryKey: queryKeys.pushNotifications,
    queryFn: async () =>
      unwrap<PushConfiguration>(await api.notifications.push.config.$get()),
  });
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function useEnablePushNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicKey: string) => {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        throw new Error("unsupported");
      }
      if ((await Notification.requestPermission()) !== "granted") throw new Error("denied");
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) throw new Error("unsupported");
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("invalid");
      return unwrap<{ ok: true }>(
        await api.notifications.push.subscriptions.$post({
          json: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          },
        }),
      );
    },
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.pushNotifications]),
  });
}

export function useDisablePushNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await unwrap<{ ok: true }>(await api.notifications.push.subscriptions.$delete());
      const registration = await navigator.serviceWorker?.ready;
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
    },
    onSuccess: () => invalidateLedgerQueries(queryClient, [queryKeys.pushNotifications]),
  });
}

export function useTestPushNotification() {
  return useMutation({
    mutationFn: async () =>
      unwrap<{ ok: true }>(await api.notifications.push.test.$post()),
  });
}
