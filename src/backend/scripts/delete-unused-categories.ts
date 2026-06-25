import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One-off maintenance: delete every category with no transactions attached
// (e.g. the old seeded defaults). Safe — Transaction.category is onDelete: SetNull.
// Run with: bun scripts/delete-unused-categories.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Deletes categories that are no longer referenced by any transaction. */
async function main() {
  const { count } = await prisma.category.deleteMany({ where: { transactions: { none: {} } } });
  console.log(`Deleted ${count} unused categories.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
