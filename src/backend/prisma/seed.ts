import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { defaultEmojiForCategory } from "../src/utils/category.ts";

// Idempotent seed: base settings, default categories, and cron job definitions.
// The single admin user is created at backend startup (see src/core/auth bootstrap),
// not here, because it requires the Better Auth instance.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Categories are created on demand (manually in Settings or via CSV import using
// the file's own names), so no defaults are seeded.
const DEFAULT_CATEGORIES: { name: string; kind: "INCOME" | "EXPENSE" }[] = [];

const CRON_JOBS: { key: string; name: string; description: string; schedule: string | null }[] = [
  {
    key: "nightly-prices",
    name: "Nightly price update",
    description: "Downloads the missing daily closes for every tracked ticker.",
    schedule: "20 2 * * *",
  },
  {
    key: "fx-rates",
    name: "FX rates update",
    description: "Refreshes FX rates (EUR/USD plus every holding currency vs the base currency).",
    schedule: "0 2 * * *",
  },
  {
    key: "snapshots",
    name: "Daily snapshots",
    description: "Records the daily net worth, cash and debt snapshots.",
    schedule: "0 3 * * *",
  },
  {
    key: "recurring-expenses",
    name: "Recurring expenses",
    description: "Books a movement for every due recurring expense/income occurrence.",
    schedule: "10 1 * * *",
  },
  {
    key: "backfill",
    name: "Asset backfill",
    description: "One-shot full price history download triggered when a new asset is added.",
    schedule: null,
  },
];

/** Seeds idempotent application defaults required after migrations. */
async function main() {
  // Settings singleton.
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", baseCurrency: "EUR" },
  });

  // Default categories (skip if a category with the same name+kind already exists).
  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { name: category.name, kind: category.kind },
    });
    if (!existing) {
      await prisma.category.create({ data: category });
    }
  }

  // Backfill a default emoji for any existing category that has none, so the UI
  // shows a real emoji instead of the generic fallback.
  const withoutEmoji = await prisma.category.findMany({ where: { emoji: null } });
  for (const category of withoutEmoji) {
    await prisma.category.update({
      where: { id: category.id },
      data: { emoji: defaultEmojiForCategory(category.name) },
    });
  }

  // Cron job definitions.
  for (const job of CRON_JOBS) {
    await prisma.cronJob.upsert({
      where: { key: job.key },
      update: { name: job.name, description: job.description, schedule: job.schedule },
      create: job,
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
