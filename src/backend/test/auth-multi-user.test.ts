import { afterAll, beforeAll, expect, test } from "bun:test";
import { app } from "../src/api/app.ts";
import { auth } from "../src/core/auth.ts";
import { prisma } from "../src/core/db.ts";
import { provisionUser } from "../src/services/userProvisioning.ts";

const suffix = `${Date.now()}-${process.pid}`;
const adminEmail = `auth-admin-${suffix}@example.com`;
const memberEmail = `auth-member-${suffix}@example.com`;
let adminId = "";
let memberId = "";
let adminCookie = "";
let memberCookie = "";
let signInCount = 0;

async function signIn(email: string, password: string): Promise<string> {
  const response = await auth.handler(
    new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.0.1.${++signInCount}`,
      },
      body: JSON.stringify({ email, password }),
    }),
  );
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Better Auth did not return a session cookie");
  return setCookie.split(";", 1)[0];
}

async function request(path: string, init: RequestInit = {}, cookie = adminCookie) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  return app.fetch(new Request(`http://localhost${path}`, { ...init, headers }));
}

beforeAll(async () => {
  const { user } = await auth.api.createUser({
    body: { email: adminEmail, password: "admin-password-123", name: "Auth Admin", role: "admin" },
  });
  adminId = user.id;
  await prisma.user.update({ where: { id: adminId }, data: { role: "admin", mustChangePassword: false } });
  await provisionUser(adminId);
  adminCookie = await signIn(adminEmail, "admin-password-123");
});

afterAll(async () => {
  if (adminId) await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
  if (memberId) await prisma.user.delete({ where: { id: memberId } }).catch(() => undefined);
});

test("admin provisioning creates a forced-change user with copied settings", async () => {
  await prisma.settings.update({ where: { userId: adminId }, data: { baseCurrency: "USD" } });
  const response = await request("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, name: "Auth Member", password: "temporary-123" }),
  });
  expect(response.status).toBe(201);
  const user = await response.json() as { id: string; role: string; mustChangePassword: boolean };
  memberId = user.id;

  expect(user.role).toBe("user");
  expect(user.mustChangePassword).toBe(true);
  expect((await prisma.settings.findUniqueOrThrow({ where: { userId: memberId } })).baseCurrency).toBe("USD");
});

test("direct Better Auth admin endpoints are not exposed", async () => {
  const email = `direct-admin-${suffix}@example.com`;
  const response = await request("/api/auth/admin/create-user", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      name: "Direct Admin",
      password: "direct-admin-password-123",
      role: "admin",
    }),
  });

  expect(response.status).toBe(404);
  expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
});

test("temporary-password users are blocked until they change credentials", async () => {
  memberCookie = await signIn(memberEmail, "temporary-123");
  const otherSessionCookie = await signIn(memberEmail, "temporary-123");

  const directPasswordChange = await request(
    "/api/auth/change-password",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        currentPassword: "temporary-123",
        newPassword: "member-password-123",
        revokeOtherSessions: true,
      }),
    },
    memberCookie,
  );
  expect(directPasswordChange.status).toBe(404);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: memberId } })).mustChangePassword).toBe(true);

  const blocked = await request("/api/settings", {}, memberCookie);
  expect(blocked.status).toBe(403);
  expect(await blocked.json()).toEqual({
    error: "Password change required",
    code: "PASSWORD_CHANGE_REQUIRED",
  });

  const wrongPassword = await request(
    "/api/users/password",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "wrong-password",
        newPassword: "member-password-123",
        confirmation: "member-password-123",
      }),
    },
    memberCookie,
  );
  expect(wrongPassword.status).toBe(400);

  const changed = await request(
    "/api/users/password",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "temporary-123",
        newPassword: "member-password-123",
        confirmation: "member-password-123",
      }),
    },
    memberCookie,
  );
  expect(changed.status).toBe(200);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: memberId } })).mustChangePassword).toBe(false);
  const changedCookie = changed.headers.get("set-cookie");
  if (changedCookie) memberCookie = changedCookie.split(";", 1)[0];
  expect((await request("/api/settings", {}, otherSessionCookie)).status).toBe(401);
  const unresolvedSettings = await request("/api/settings", {}, memberCookie);
  expect(unresolvedSettings.status).toBe(200);
  expect((await unresolvedSettings.json() as { locale: string | null }).locale).toBeNull();

  const selectedLanguage = await request(
    "/api/settings",
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: "it" }),
    },
    memberCookie,
  );
  expect(selectedLanguage.status).toBe(200);
  expect((await selectedLanguage.json() as { locale: string | null }).locale).toBe("it");
  expect((await prisma.settings.findUniqueOrThrow({ where: { userId: memberId } })).locale).toBe("it");
});

test("release acknowledgement is scoped to the authenticated user", async () => {
  const acknowledged = await request(
    "/api/settings/release-acknowledgement",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: "1.1.3", userId: adminId }),
    },
    memberCookie,
  );

  expect(acknowledged.status).toBe(400);

  const validAcknowledgement = await request(
    "/api/settings/release-acknowledgement",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: "1.1.3" }),
    },
    memberCookie,
  );

  expect(validAcknowledgement.status).toBe(200);
  expect((await prisma.settings.findUniqueOrThrow({ where: { userId: memberId } })).lastSeenReleaseVersion).toBe(
    "1.1.3",
  );
  expect((await prisma.settings.findUniqueOrThrow({ where: { userId: adminId } })).lastSeenReleaseVersion).toBeNull();
});

test("normal users cannot use admin surfaces", async () => {
  const users = await request("/api/users", {}, memberCookie);
  expect(users.status).toBe(403);

  const database = await request("/api/database/tables", {}, memberCookie);
  expect(database.status).toBe(403);

  const cron = await request("/api/cron/jobs", {}, memberCookie);
  expect(cron.status).toBe(403);
});

test("public sign-up remains disabled", async () => {
  const response = await auth.handler(
    new Request("http://localhost:3001/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `public-${suffix}@example.com`, password: "public-password-123", name: "Public" }),
    }),
  );
  expect(response.status).not.toBe(200);
});
