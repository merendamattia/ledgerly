import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
    description:
      "Downloads the missing daily closes for every tracked ticker, updates FX rates, and records a net worth snapshot.",
    schedule: "0 2 * * *",
  },
  {
    key: "backfill",
    name: "Asset backfill",
    description: "One-shot full price history download triggered when a new asset is added.",
    schedule: null,
  },
];

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
