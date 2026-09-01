import { afterAll, beforeAll, expect, test } from "bun:test";
import { app } from "../src/api/app.ts";
import { auth } from "../src/core/auth.ts";
import { prisma } from "../src/core/db.ts";
import { provisionUser } from "../src/services/userProvisioning.ts";

const suffix = `${Date.now()}-${process.pid}`;
const password = "notifications-password-123";
const ownerEmail = `notifications-owner-${suffix}@example.com`;
const otherEmail = `notifications-other-${suffix}@example.com`;
let ownerId = "";
let otherId = "";
let ownerCookie = "";
let otherCookie = "";
let notificationId = "";
let transactionId = "";

async function signIn(email: string) {
  const response = await auth.handler(new Request("http://localhost:3001/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }));
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("Better Auth did not return a session cookie");
  return cookie.split(";", 1)[0];
}

function request(path: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  return app.fetch(new Request(`http://localhost${path}`, { ...init, headers }));
}

beforeAll(async () => {
  const owner = await auth.api.createUser({ body: { email: ownerEmail, password, name: "Notification Owner" } });
  const other = await auth.api.createUser({ body: { email: otherEmail, password, name: "Notification Other" } });
  ownerId = owner.user.id;
  otherId = other.user.id;
  await prisma.user.updateMany({
    where: { id: { in: [ownerId, otherId] } },
    data: { mustChangePassword: false },
  });
  await provisionUser(ownerId);
  await provisionUser(otherId);
  ownerCookie = await signIn(ownerEmail);
  otherCookie = await signIn(otherEmail);

  const transaction = await prisma.transaction.create({
    data: { userId: ownerId, date: new Date("2026-09-01"), amount: 12.5, direction: "EXPENSE", note: "Caffè Roma" },
  });
  transactionId = transaction.id;
  notificationId = (
    await prisma.notification.create({
      data: { userId: ownerId, kind: "APPLE_WALLET_IMPORT_COMPLETED", transactionId },
    })
  ).id;
});

afterAll(async () => {
  if (ownerId || otherId) {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId].filter(Boolean) } } });
  }
});

test("notification API returns an unread deep link only to its owner", async () => {
  const ownerResponse = await request("/api/notifications", ownerCookie);
  expect(ownerResponse.status).toBe(200);
  expect(await ownerResponse.json()).toEqual(expect.objectContaining({
    unreadCount: 1,
    items: [expect.objectContaining({
      id: notificationId,
      transactionId,
      note: "Caffè Roma",
      url: `/transactions?transaction=${transactionId}&edit=1`,
      readAt: null,
    })],
  }));

  const otherResponse = await request("/api/notifications", otherCookie);
  expect(otherResponse.status).toBe(200);
  expect(await otherResponse.json()).toEqual({ unreadCount: 0, items: [] });
});

test("read state and push subscriptions stay scoped to the authenticated user", async () => {
  expect((await request(`/api/notifications/${notificationId}/read`, otherCookie, { method: "PATCH" })).status).toBe(200);
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: notificationId } })).readAt).toBeNull();

  expect((await request(`/api/notifications/${notificationId}/read`, ownerCookie, { method: "PATCH" })).status).toBe(200);
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: notificationId } })).readAt).not.toBeNull();

  const subscription = {
    endpoint: `https://push.example.com/${suffix}`,
    keys: { p256dh: "owner-p256dh", auth: "owner-auth" },
  };
  expect((await request("/api/notifications/push/subscriptions", ownerCookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription),
  })).status).toBe(201);
  expect((await request("/api/notifications/push/subscriptions", otherCookie, { method: "DELETE" })).status).toBe(200);
  expect(await prisma.pushSubscription.count({ where: { userId: ownerId } })).toBe(1);
  expect(await prisma.pushSubscription.count({ where: { userId: otherId } })).toBe(0);
});
