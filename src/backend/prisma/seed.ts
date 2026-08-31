import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Idempotent seed for system-level cron job definitions. Users and their
// settings/categories are provisioned by the backend after Better Auth starts.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
    description: "One-shot full price history repair for every provider-backed asset.",
    schedule: null,
  },
];

/** Seeds idempotent application defaults required after migrations. */
async function main() {
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
