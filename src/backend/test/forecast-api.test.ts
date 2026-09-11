import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Prisma } from "@prisma/client";
import { app } from "../src/api/app.ts";
import { auth } from "../src/core/auth.ts";
import { prisma } from "../src/core/db.ts";
import type { ForecastSnapshot } from "../src/services/forecastContract.ts";
import { provisionUser } from "../src/services/userProvisioning.ts";

const suffix = `${Date.now()}-${process.pid}`;
const password = "forecast-password-123";
const ownerEmail = `forecast-owner-${suffix}@example.com`;
const otherEmail = `forecast-other-${suffix}@example.com`;
let ownerId = "";
let otherId = "";
let ownerCookie = "";

const point = { date: "2026-10-01", mean: 110, p10: 90, p25: 100, p50: 110, p75: 120, p90: 130 };
const snapshot: ForecastSnapshot = {
  id: `snapshot-${suffix}`,
  generatedAt: "2026-09-11T09:00:00.000Z",
  sourceDataCutoff: "2026-09-11T08:59:00.000Z",
  currency: "EUR",
  effectiveLookbackMonths: 1,
  observationCount: 1,
  simulationCount: 1_000,
  dataQuality: "MEDIUM",
  assumptions: ["historical-patterns-bootstrap"],
  history: {
    netWorth: [{ date: "2026-09-01", value: 100 }],
    income: [{ date: "2026-09-01", value: 20 }],
    expenses: [{ date: "2026-09-01", value: 10 }],
    investments: [],
  },
  series: {
    netWorth: [point],
    income: [point],
    expenses: [point],
    investments: [point],
    contributions: [point],
  },
  summary: {
    startingNetWorth: 100,
    savingsContribution: 10,
    investmentReturnContribution: 0,
    startingPortfolioValue: 0,
    historicalInvestmentReturnRate: null,
    historicalInvestmentReturnMonths: 0,
  },
};

async function signIn(email: string) {
  const response = await auth.handler(new Request("http://localhost:3001/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }));
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("Better Auth did not return a session cookie");
  return cookie.split(";", 1)[0];
}

function request(cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  return app.fetch(new Request("http://localhost/api/forecast", { ...init, headers }));
}

beforeAll(async () => {
  const owner = await auth.api.createUser({ body: { email: ownerEmail, password, name: "Forecast Owner" } });
  const other = await auth.api.createUser({ body: { email: otherEmail, password, name: "Forecast Other" } });
  ownerId = owner.user.id;
  otherId = other.user.id;
  await prisma.user.updateMany({
    where: { id: { in: [ownerId, otherId] } },
    data: { mustChangePassword: false },
  });
  await provisionUser(ownerId);
  await provisionUser(otherId);
  ownerCookie = await signIn(ownerEmail);
  const otherSnapshot = { ...snapshot, id: `other-${snapshot.id}` };
  await prisma.userForecast.create({
    data: {
      userId: otherId,
      status: "READY",
      snapshotId: otherSnapshot.id,
      payload: otherSnapshot as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(snapshot.generatedAt),
      sourceDataCutoff: new Date(snapshot.sourceDataCutoff),
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId].filter(Boolean) } } });
});

test("forecast reads are authenticated and isolated to the current user", async () => {
  expect((await request("")).status).toBe(401);
  const ownerResponse = await request(ownerCookie);
  expect(ownerResponse.status).toBe(200);
  expect(await ownerResponse.json()).toEqual({ status: "EMPTY", snapshot: null });
});

test("refresh preserves the prior snapshot and rejects duplicate queued work", async () => {
  await prisma.userForecast.create({
    data: {
      userId: ownerId,
      status: "READY",
      snapshotId: snapshot.id,
      payload: snapshot as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(snapshot.generatedAt),
      sourceDataCutoff: new Date(snapshot.sourceDataCutoff),
    },
  });
  const first = await request(ownerCookie, { method: "POST" });
  expect(first.status).toBe(202);
  expect(await first.json()).toEqual({ status: "GENERATING", snapshot });

  const duplicate = await request(ownerCookie, { method: "POST" });
  expect(duplicate.status).toBe(409);
  expect(await duplicate.json()).toEqual(expect.objectContaining({
    error: "A forecast generation is already running",
  }));
});
