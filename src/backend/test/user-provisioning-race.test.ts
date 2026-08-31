import { afterAll, beforeAll, expect, test } from "bun:test";
import { app } from "../src/api/app.ts";
import { auth } from "../src/core/auth.ts";
import { prisma } from "../src/core/db.ts";
import { userRepository } from "../src/repositories/user.ts";
import { userProvisioningRepository } from "../src/repositories/userProvisioning.ts";
import { provisionUser } from "../src/services/userProvisioning.ts";

const suffix = `${Date.now()}-${process.pid}`;
const adminEmail = `provisioning-admin-${suffix}@example.com`;
const raceEmail = `provisioning-race-${suffix}@example.com`;
const retryEmail = `provisioning-retry-${suffix}@example.com`;
const adminPassword = "provisioning-admin-password-123";
const temporaryPassword = "temporary-password-123";
let adminId = "";
let raceUserId = "";
let retryUserId = "";
let adminCookie = "";
let signInCount = 0;

async function signIn(email: string, password: string): Promise<string> {
  const response = await auth.handler(
    new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `10.0.0.${++signInCount}`,
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

async function createUser(email: string) {
  return request("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: temporaryPassword }),
  });
}

beforeAll(async () => {
  const { user } = await auth.api.createUser({
    body: { email: adminEmail, password: adminPassword, name: "Provisioning Admin", role: "admin" },
  });
  adminId = user.id;
  await prisma.user.update({
    where: { id: adminId },
    data: { role: "admin", mustChangePassword: false },
  });
  await provisionUser(adminId);
  adminCookie = await signIn(adminEmail, adminPassword);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [adminId, raceUserId, retryUserId] } } });
});

test("blocks normal access while account onboarding is still being provisioned", async () => {
  let releaseFlagUpdate!: () => void;
  let flagUpdateStarted!: () => void;
  const flagUpdateReached = new Promise<void>((resolve) => {
    flagUpdateStarted = resolve;
  });
  const flagUpdateReleased = new Promise<void>((resolve) => {
    releaseFlagUpdate = resolve;
  });
  const originalSetMustChangePassword = userRepository.setMustChangePassword;

  userRepository.setMustChangePassword = async (userId, mustChangePassword) => {
    if (mustChangePassword) {
      raceUserId = userId;
      flagUpdateStarted();
      await flagUpdateReleased;
    }
    return originalSetMustChangePassword(userId, mustChangePassword);
  };

  const creation = createUser(raceEmail);
  let assertionError: unknown;
  try {
    await flagUpdateReached;
    const created = await prisma.user.findUniqueOrThrow({ where: { id: raceUserId } });
    expect(created.mustChangePassword).toBe(true);

    const raceCookie = await signIn(raceEmail, temporaryPassword);
    const settings = await request("/api/settings", {}, raceCookie);
    expect(settings.status).toBe(403);
    expect(await settings.json()).toEqual({
      error: "Password change required",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  } catch (error) {
    assertionError = error;
  } finally {
    releaseFlagUpdate();
    userRepository.setMustChangePassword = originalSetMustChangePassword;
  }

  const response = await creation;
  if (assertionError) throw assertionError;
  expect(response.status).toBe(201);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: raceUserId } })).mustChangePassword).toBe(true);
});

test("keeps a failed provisioning account blocked and retries it on the next admin request", async () => {
  const originalCreateIfMissing = userProvisioningRepository.createIfMissing;
  let failOnce = true;
  userProvisioningRepository.createIfMissing = async (userId, defaults) => {
    if (failOnce) {
      failOnce = false;
      throw new Error("provisioning failed");
    }
    return originalCreateIfMissing(userId, defaults);
  };

  try {
    const failed = await createUser(retryEmail);
    expect(failed.status).toBe(400);

    const failedUser = await prisma.user.findUniqueOrThrow({ where: { email: retryEmail } });
    retryUserId = failedUser.id;
    expect(failedUser.mustChangePassword).toBe(true);
    expect(await prisma.settings.findUnique({ where: { userId: retryUserId } })).toBeNull();

    const retried = await createUser(retryEmail);
    expect(retried.status).toBe(200);
    expect((await prisma.settings.findUnique({ where: { userId: retryUserId } })).userId).toBe(retryUserId);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: retryUserId } })).mustChangePassword).toBe(true);
  } finally {
    userProvisioningRepository.createIfMissing = originalCreateIfMissing;
  }
});
