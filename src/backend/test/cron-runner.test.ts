import { test, expect, beforeAll } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { runTrackedJob } from "../src/services/cron/runner.ts";

// Integration test (requires Postgres). Verifies the cron runner opens/closes a
// CronRun with the right status and captures errors.
beforeAll(async () => {
  await prisma.cronJob.upsert({
    where: { key: "nightly-prices" },
    update: {},
    create: { key: "nightly-prices", name: "Nightly price update" },
  });
});

test("successful job records SUCCESS with the processed count", async () => {
  const run = await runTrackedJob("nightly-prices", async () => 7, "MANUAL");
  expect(run.status).toBe("SUCCESS");
  expect(run.itemsProcessed).toBe(7);
  expect(run.finishedAt).not.toBeNull();
  expect(run.triggeredBy).toBe("MANUAL");
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
