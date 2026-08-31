import { prisma } from "../src/core/db.ts";

export const TEST_USER_ID = "ledgerly-test-owner";

/** Ensures the shared integration-test owner exists after migrations. */
export async function ensureTestUser() {
  return prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, name: "Ledgerly Test Owner", email: "ledgerly-test-owner@example.com" },
  });
}
