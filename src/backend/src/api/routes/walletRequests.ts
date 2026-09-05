import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { BadRequestError, NotFoundError } from "../../core/errors.ts";
import { appleWalletImportRepository } from "../../repositories/appleWalletImport.ts";
import { walletRequestFiltersSchema } from "../../schemas/index.ts";
import { requireAdmin, requireAuth } from "../middlewares/auth.ts";
import type { AppEnv } from "../types.ts";

function noStore(c: { header: (name: string, value: string) => void }) {
  c.header("Cache-Control", "no-store");
}

type CalendarDate = { year: number; month: number; day: number };

function parseCalendarDate(value: string): CalendarDate {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestError("Invalid calendar date");
  }
  return { year, month, day };
}

function nextCalendarDate(date: CalendarDate): CalendarDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function localDateTimeFormatter(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new BadRequestError("Invalid timezone");
  }
}

function localParts(formatter: Intl.DateTimeFormat, instant: Date): CalendarDate & {
  hour: number;
  minute: number;
  second: number;
} {
  const values = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localMidnight(date: CalendarDate, formatter: Intl.DateTimeFormat): Date {
  const wallClock = Date.UTC(date.year, date.month - 1, date.day);
  let instant = wallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = localParts(formatter, new Date(instant));
    const timezoneOffset = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - instant;
    const adjusted = wallClock - timezoneOffset;
    if (adjusted === instant) break;
    instant = adjusted;
  }
  return new Date(instant);
}

/** Converts date-only filters into UTC bounds for the browser's calendar day. */
function localDayBounds(
  from: string | undefined,
  to: string | undefined,
  timezone: string,
) {
  const formatter = localDateTimeFormatter(timezone);
  const start = from ? localMidnight(parseCalendarDate(from), formatter) : undefined;
  const end = to
    ? new Date(localMidnight(nextCalendarDate(parseCalendarDate(to)), formatter).getTime() - 1)
    : undefined;
  return { from: start, to: end };
}

/** Admin-only read surface for Wallet AI request history and exact usage. */
export const walletRequestsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .use("*", requireAdmin)
  .get("/", zValidator("query", walletRequestFiltersSchema), async (c) => {
    noStore(c);
    const query = c.req.valid("query");
    const bounds = localDayBounds(query.from, query.to, query.timezone);
    return c.json(
      await appleWalletImportRepository.listAdmin({
        userId: query.userId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
        ...bounds,
      }),
    );
  })
  .get("/:id", async (c) => {
    noStore(c);
    const item = await appleWalletImportRepository.findAdminById(c.req.param("id"));
    if (!item) throw new NotFoundError("Wallet request not found");
    return c.json(item);
  });
