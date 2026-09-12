import { expect, test } from "bun:test";
import { queueForecastsSequentially } from "./jobs.ts";

test("weekly forecast producer queues users sequentially and skips active generations", async () => {
  const events: string[] = [];
  let active = 0;
  let peak = 0;
  const queued = await queueForecastsSequentially(
    [{ id: "one" }, { id: "two" }, { id: "three" }],
    async (userId) => {
      active += 1;
      peak = Math.max(peak, active);
      events.push(`start:${userId}`);
      await Promise.resolve();
      events.push(`end:${userId}`);
      active -= 1;
      return { status: userId === "two" ? "ALREADY_RUNNING" : "QUEUED" };
    },
  );

  expect(peak).toBe(1);
  expect(queued).toBe(2);
  expect(events).toEqual([
    "start:one",
    "end:one",
    "start:two",
    "end:two",
    "start:three",
    "end:three",
  ]);
});
