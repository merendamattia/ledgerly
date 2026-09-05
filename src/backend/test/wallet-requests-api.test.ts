import { afterAll, beforeAll, expect, test } from "bun:test";
import { app } from "../src/api/app.ts";
import { auth } from "../src/core/auth.ts";
import { prisma } from "../src/core/db.ts";
import { provisionUser } from "../src/services/userProvisioning.ts";

const suffix = `${Date.now()}-${process.pid}`;
const password = "wallet-requests-password-123";
const adminEmail = `wallet-requests-admin-${suffix}@example.com`;
const memberEmail = `wallet-requests-member-${suffix}@example.com`;
let adminId = "";
let memberId = "";
let adminCookie = "";
let memberCookie = "";
let completedImportId = "";
let completedTransactionId = "";
let signInCount = 0;

async function signIn(email: string) {
  const response = await auth.handler(new Request("http://localhost:3001/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${++signInCount}`,
    },
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
  const admin = await auth.api.createUser({
    body: { email: adminEmail, password, name: "Wallet Requests Admin" },
  });
  const member = await auth.api.createUser({
    body: { email: memberEmail, password, name: "Wallet Requests Member" },
  });
  adminId = admin.user.id;
  memberId = member.user.id;
  await prisma.user.update({ where: { id: adminId }, data: { role: "admin", mustChangePassword: false } });
  await prisma.user.update({ where: { id: memberId }, data: { mustChangePassword: false } });
  await provisionUser(adminId);
  await provisionUser(memberId);
  adminCookie = await signIn(adminEmail);
  memberCookie = await signIn(memberEmail);

  const transaction = await prisma.transaction.create({
    data: {
      userId: adminId,
      date: new Date("2026-09-02"),
      amount: 12.5,
      direction: "EXPENSE",
      note: "Eurospin",
      reviewRequired: true,
    },
  });
  completedTransactionId = transaction.id;
  const completed = await prisma.appleWalletImport.create({
    data: {
      userId: adminId,
      rawPayload: { merchant: "Eurospin, spesa intelligente", amount: "€12.50" },
      idempotencyKey: `completed-${suffix}`,
      status: "COMPLETED",
      aiModel: "gpt-5.6-luna",
      aiInputTokens: 101,
      aiOutputTokens: 23,
      aiTotalTokens: 124,
      normalizedResult: {
        amount: 12.5,
        direction: "EXPENSE",
        date: "2026-09-02",
        note: "Eurospin",
        categoryId: null,
      },
      integrationTokenPrefix: "ledgerly_ab",
      integrationTokenSuffix: "wxyz",
      transactionId: transaction.id,
      completedAt: new Date("2026-09-02T12:01:00.000Z"),
    },
  });
  completedImportId = completed.id;

  await prisma.appleWalletImport.create({
    data: {
      userId: memberId,
      rawPayload: { merchant: "Failed merchant" },
      idempotencyKey: `failed-${suffix}`,
      status: "FAILED",
      aiInputTokens: 7,
      aiOutputTokens: 3,
      aiTotalTokens: 10,
      lastError: "OpenAI unavailable",
      failedAt: new Date("2026-09-03T12:01:00.000Z"),
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId].filter(Boolean) } } });
});

test("admin Wallet request telemetry is filterable and aggregates exact usage", async () => {
  const response = await request(
    "/api/admin/wallet-requests?status=COMPLETED&userId=" + encodeURIComponent(adminId) + "&limit=10&offset=0",
    adminCookie,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    items: Array<Record<string, unknown>>;
    total: number;
    summary: { requestCount: number; inputTokens: number; outputTokens: number; totalTokens: number };
  };
  expect(body.total).toBe(1);
  expect(body.summary).toEqual({ requestCount: 1, inputTokens: 101, outputTokens: 23, totalTokens: 124 });
  expect(body.items[0]).toEqual(expect.objectContaining({
    id: completedImportId,
    userId: adminId,
    status: "COMPLETED",
    aiModel: "gpt-5.6-luna",
    aiInputTokens: 101,
    aiOutputTokens: 23,
    aiTotalTokens: 124,
    integrationTokenPrefix: "ledgerly_ab",
    integrationTokenSuffix: "wxyz",
    transaction: expect.objectContaining({ id: completedTransactionId }),
  }));
  expect(JSON.stringify(body)).not.toContain("tokenHash");

  const detailResponse = await request(`/api/admin/wallet-requests/${completedImportId}`, adminCookie);
  expect(detailResponse.status).toBe(200);
  const detail = (await detailResponse.json()) as Record<string, unknown>;
  expect(detail.rawPayload).toEqual({ merchant: "Eurospin, spesa intelligente", amount: "€12.50" });
  expect(detail.normalizedResult).toEqual(expect.objectContaining({ note: "Eurospin", categoryId: null }));
  expect(detail.transaction).toEqual(expect.objectContaining({ id: completedTransactionId, reviewRequired: true }));
  expect(JSON.stringify(detail)).not.toContain("Bearer");

  const today = new Date().toISOString().slice(0, 10);
  const dateResponse = await request(
    `/api/admin/wallet-requests?from=${today}&to=${today}&userId=${encodeURIComponent(adminId)}&limit=10&offset=0`,
    adminCookie,
  );
  expect(dateResponse.status).toBe(200);
  expect((await dateResponse.json()).total).toBe(1);
});

test("admin Wallet request telemetry is protected from non-admin sessions", async () => {
  const list = await request("/api/admin/wallet-requests", memberCookie);
  expect(list.status).toBe(403);
  const detail = await request(`/api/admin/wallet-requests/${completedImportId}`, memberCookie);
  expect(detail.status).toBe(403);
});

test("date filters use the browser calendar day in its timezone", async () => {
  const midnightRequest = await prisma.appleWalletImport.create({
    data: {
      userId: adminId,
      rawPayload: { merchant: "Rome midnight" },
      idempotencyKey: `rome-midnight-${suffix}`,
      status: "FAILED",
      createdAt: new Date("2026-09-05T23:30:00.000Z"),
    },
  });

  const response = await request(
    `/api/admin/wallet-requests?status=FAILED&userId=${encodeURIComponent(adminId)}&from=2026-09-06&to=2026-09-06&timezone=Europe%2FRome&limit=10&offset=0`,
    adminCookie,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { items: Array<{ id: string }>; total: number };
  expect(body.total).toBe(1);
  expect(body.items[0]?.id).toBe(midnightRequest.id);
});

test("the transaction review endpoint clears the AI review marker for its owner", async () => {
  const response = await request(`/api/expenses/${completedTransactionId}/review`, adminCookie, {
    method: "POST",
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { reviewRequired: boolean; reviewedAt: string | null };
  expect(body.reviewRequired).toBe(false);
  expect(body.reviewedAt).not.toBeNull();
  expect((await prisma.transaction.findUniqueOrThrow({ where: { id: completedTransactionId } })).reviewRequired).toBe(false);

  const edited = await prisma.transaction.create({
    data: {
      userId: adminId,
      date: new Date("2026-09-04"),
      amount: 8,
      direction: "EXPENSE",
      note: "Before edit",
      reviewRequired: true,
    },
  });
  const editResponse = await request(`/api/expenses/${edited.id}`, adminCookie, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ note: "After edit" }),
  });
  expect(editResponse.status).toBe(200);
  expect((await editResponse.json()) as { reviewRequired: boolean }).toEqual(
    expect.objectContaining({ reviewRequired: false }),
  );
  expect((await prisma.transaction.findUniqueOrThrow({ where: { id: edited.id } })).reviewRequired).toBe(false);
});
