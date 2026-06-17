import { test, expect, beforeAll } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { runTrackedJob } from "../src/services/cron/runner.ts";

// Integration test (requires Postgres). Verifies the cron runner opens/closes a
// CronRun with the right status and captures errors.
beforeAll(async () => {
  for (const key of ["nightly-prices", "fx-rates", "snapshots"]) {
    await prisma.cronJob.upsert({
      where: { key },
      update: {},
      create: { key, name: key },
    });
  }
});

test("successful job records SUCCESS with the processed count", async () => {
  const run = await runTrackedJob("nightly-prices", async () => 7, "MANUAL");
  expect(run.status).toBe("SUCCESS");
  expect(run.itemsProcessed).toBe(7);
  expect(run.finishedAt).not.toBeNull();
  expect(run.triggeredBy).toBe("MANUAL");
});

test("records runs for the fx-rates and snapshots jobs", async () => {
  const fx = await runTrackedJob("fx-rates", async () => 3, "CRON");
  expect(fx.status).toBe("SUCCESS");
  expect(fx.itemsProcessed).toBe(3);

  const snap = await runTrackedJob("snapshots", async () => 1, "CRON");
  expect(snap.status).toBe("SUCCESS");
  expect(snap.itemsProcessed).toBe(1);
});

test("failing job records FAILED with the error message", async () => {
  const run = await runTrackedJob(
    "nightly-prices",
    async () => {
      throw new Error("boom");
    },
    "CRON",
  );
  expect(run.status).toBe("FAILED");
  expect(run.error).toContain("boom");
  expect(run.finishedAt).not.toBeNull();
});
