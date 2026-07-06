import { prisma } from "../src/core/db.ts";
import { runFullPriceBackfill } from "../src/services/cron/jobs.ts";

// One-off data migration: refetch and overwrite full provider price histories.
// Run with: bun scripts/backfill-prices.ts
try {
  const count = await runFullPriceBackfill();
  console.log(`Backfilled ${count} provider tickers.`);
} finally {
  await prisma.$disconnect();
}
