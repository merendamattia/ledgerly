import { afterAll, beforeAll, expect, test } from "bun:test";
import { app } from "../src/api/app.ts";
import { auth } from "../src/core/auth.ts";
import { prisma } from "../src/core/db.ts";
import { provisionUser } from "../src/services/userProvisioning.ts";

const suffix = `${Date.now()}-${process.pid}`;
const ownerEmail = `integration-token-owner-${suffix}@example.com`;
const otherEmail = `integration-token-other-${suffix}@example.com`;
const password = "integration-password-123";
let ownerId = "";
let otherUserId = "";
let sessionCookie = "";
let token = "";
let tokenCreatedAt = "";

async function signIn(): Promise<string> {
  const response = await auth.handler(
    new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.49" },
      body: JSON.stringify({ email: ownerEmail, password }),
    }),
  );
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Better Auth did not return a session cookie");
  return setCookie.split(";", 1)[0];
}

async function request(path: string, init: RequestInit = {}, cookie = sessionCookie) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  return app.fetch(new Request(`http://localhost${path}`, { ...init, headers }));
}

beforeAll(async () => {
  const { user: owner } = await auth.api.createUser({
    body: { email: ownerEmail, password, name: "Integration Owner" },
  });
  ownerId = owner.id;
  await prisma.user.update({ where: { id: ownerId }, data: { mustChangePassword: false } });
  await provisionUser(ownerId);

  const { user: other } = await auth.api.createUser({
    body: { email: otherEmail, password, name: "Other Owner" },
  });
  otherUserId = other.id;
  await prisma.user.update({ where: { id: otherUserId }, data: { mustChangePassword: false } });
  await provisionUser(otherUserId);

  sessionCookie = await signIn();
});

afterAll(async () => {
  if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => undefined);
  if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } }).catch(() => undefined);
});

test("a user can generate a token and queue raw Wallet data idempotently", async () => {
  const generated = await request("/api/integrations/token", { method: "POST" });
  expect(generated.status).toBe(201);
  const generatedBody = (await generated.json()) as {
    token: string;
    metadata: { prefix: string; suffix: string; createdAt: string };
  };
  token = generatedBody.token;
  tokenCreatedAt = generatedBody.metadata.createdAt;
  expect(generatedBody.token).toMatch(/^ledgerly_[A-Za-z0-9_-]+$/);
  expect(generatedBody.metadata.prefix).toBe(generatedBody.token.slice(0, 10));
  expect(generatedBody.metadata.suffix).toBe(generatedBody.token.slice(-4));

  const duplicate = await request("/api/integrations/token", { method: "POST" });
  expect(duplicate.status).toBe(409);

  const status = await request("/api/integrations/token");
  expect(status.status).toBe(200);
  const statusBody = (await status.json()) as { token: Record<string, unknown> };
  expect(statusBody.token).not.toHaveProperty("token");
  expect(statusBody.token.prefix).toBe(generatedBody.metadata.prefix);

  const transactionResponse = await request("/api/integrations/transactions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${generatedBody.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      merchant: "Test merchant",
      amount: "€12.50",
      transactionDate: "1 September 2026",
    }),
  }, "");
  expect(transactionResponse.status).toBe(202);
  const queued = (await transactionResponse.json()) as { id: string; status: string; duplicate: boolean };
  expect(queued.status).toBe("QUEUED");
  expect(queued.duplicate).toBe(false);
  const importRow = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: queued.id } });
  expect(importRow.userId).toBe(ownerId);
  expect(importRow.rawPayload).toEqual({
    merchant: "Test merchant",
    amount: "€12.50",
    transactionDate: "1 September 2026",
  });

  const retry = await request("/api/integrations/transactions", {
    method: "POST",
    headers: { authorization: `Bearer ${generatedBody.token}`, "content-type": "application/json" },
    body: JSON.stringify({ transactionDate: "1 September 2026", amount: "€12.50", merchant: "Test merchant" }),
  }, "");
  expect(retry.status).toBe(202);
  expect((await retry.json()) as { id: string; duplicate: boolean }).toEqual(
    expect.objectContaining({ id: queued.id, duplicate: true }),
  );
});

test("missing, malformed and unknown tokens are rejected without widening session routes", async () => {
  const before = await prisma.appleWalletImport.count({ where: { userId: ownerId } });
  const cases = [
    {},
    { authorization: "Basic not-a-bearer-token" },
    { authorization: "Bearer malformed" },
    { authorization: "Bearer ledgerly_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  ];

  for (const headers of cases) {
    const response = await request(
      "/api/integrations/transactions",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({
          merchant: "Rejected merchant",
        }),
      },
      "",
    );
    expect(response.status).toBe(401);
  }

  const sessionRoute = await request(
    "/api/expenses",
    { headers: { authorization: `Bearer ${token}` } },
    "",
  );
  expect(sessionRoute.status).toBe(401);
  const tokenManagement = await request(
    "/api/integrations/token",
    { headers: { authorization: `Bearer ${token}` } },
    "",
  );
  expect(tokenManagement.status).toBe(401);
  expect(await prisma.appleWalletImport.count({ where: { userId: ownerId } })).toBe(before);
});

test("raw owner-like fields cannot change the token-derived owner", async () => {
  const otherBefore = await prisma.appleWalletImport.count({ where: { userId: otherUserId } });
  const response = await request(
    "/api/integrations/transactions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        merchant: "Owner boundary",
        userId: otherUserId,
      }),
    },
    "",
  );
  expect(response.status).toBe(202);
  const body = (await response.json()) as { id: string };
  expect((await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: body.id } })).userId).toBe(ownerId);
  expect(await prisma.appleWalletImport.count({ where: { userId: otherUserId } })).toBe(otherBefore);
});

test("rotation invalidates the previous token immediately and keeps only a verifier", async () => {
  const rotated = await request("/api/integrations/token/rotate", { method: "POST" });
  expect(rotated.status).toBe(200);
  const rotatedBody = (await rotated.json()) as { token: string };
  expect(rotatedBody.token).not.toBe(token);
  const rotatedMetadata = await request("/api/integrations/token");
  expect(rotatedMetadata.status).toBe(200);
  const rotatedMetadataBody = (await rotatedMetadata.json()) as { token: { createdAt: string } };
  expect(new Date(rotatedMetadataBody.token.createdAt).getTime()).toBeGreaterThanOrEqual(
    new Date(tokenCreatedAt).getTime(),
  );

  const oldToken = await request(
    "/api/integrations/transactions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        merchant: "Old token",
      }),
    },
    "",
  );
  expect(oldToken.status).toBe(401);

  const newToken = await request(
    "/api/integrations/transactions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${rotatedBody.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        merchant: "New token",
      }),
    },
    "",
  );
  expect(newToken.status).toBe(202);

  token = rotatedBody.token;
  const stored = await prisma.personalApiToken.findUnique({ where: { userId: ownerId } });
  expect(stored?.tokenHash).toHaveLength(64);
  expect(stored?.tokenHash).not.toBe(token);
});

test("revocation removes the token and blocks further transaction writes", async () => {
  const revoked = await request("/api/integrations/token", { method: "DELETE" });
  expect(revoked.status).toBe(200);

  const response = await request(
    "/api/integrations/transactions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        merchant: "Revoked token",
      }),
    },
    "",
  );
  expect(response.status).toBe(401);

  const status = await request("/api/integrations/token");
  expect(status.status).toBe(200);
  expect((await status.json()) as { token: unknown }).toEqual({ token: null });
  expect(
    await prisma.appleWalletImport.findFirst({
      where: { userId: ownerId, rawPayload: { equals: { merchant: "Revoked token" } } },
    }),
  ).toBeNull();
});
