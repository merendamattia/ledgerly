import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { categoryRepository } from "../src/repositories/category.ts";
import { settingsRepository } from "../src/repositories/settings.ts";
import { transactionRepository } from "../src/repositories/transaction.ts";
import { provisionUser } from "../src/services/userProvisioning.ts";

const suffix = `${Date.now()}-${process.pid}`;
const adminId = `isolation-admin-${suffix}`;
const memberId = `isolation-member-${suffix}`;
const laterMemberId = `isolation-later-${suffix}`;
const adminEmail = `isolation-admin-${suffix}@example.com`;
const memberEmail = `isolation-member-${suffix}@example.com`;
const laterMemberEmail = `isolation-later-${suffix}@example.com`;
let transactionId = "";
let adminCategoryId = "";

beforeAll(async () => {
  await prisma.user.createMany({
    data: [
      { id: adminId, name: "Isolation Admin", email: adminEmail, role: "admin" },
      { id: memberId, name: "Isolation Member", email: memberEmail, role: "user" },
      { id: laterMemberId, name: "Later Member", email: laterMemberEmail, role: "user" },
    ],
  });
  await prisma.settings.create({ data: { userId: adminId, baseCurrency: "USD" } });
  adminCategoryId = (
    await prisma.category.create({
      data: { userId: adminId, name: `Shared-looking ${suffix}`, kind: "EXPENSE", emoji: "🧾" },
    })
  ).id;
  await prisma.category.create({
    data: { userId: adminId, name: `Admin-only ${suffix}`, kind: "INCOME", emoji: "💼" },
  });
  const transaction = await transactionRepository.create(adminId, {
    date: new Date("2026-01-01"),
    amount: 25,
    direction: "EXPENSE",
    note: `admin transaction ${suffix}`,
    category: { connect: { id: adminCategoryId } },
  });
  transactionId = transaction.id;
  await provisionUser(memberId, adminId);

  await settingsRepository.update(adminId, { baseCurrency: "EUR" });
  await settingsRepository.acknowledgeRelease(adminId, "1.1.1");
  await categoryRepository.update(adminId, adminCategoryId, { emoji: "🪙" });
  await provisionUser(laterMemberId, adminId);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId, laterMemberId] } } });
});

test("personal reads and writes stay inside the authenticated owner boundary", async () => {
  expect((await transactionRepository.list(memberId)).map((row) => row.id)).toEqual([]);
  expect(await transactionRepository.findById(memberId, transactionId)).toBeNull();
  expect(await transactionRepository.update(memberId, transactionId, { note: "cross-owner" })).toBeNull();
  expect(await transactionRepository.delete(memberId, transactionId)).toBeNull();
  expect((await transactionRepository.list(adminId)).map((row) => row.id)).toEqual([transactionId]);
});

test("provisioning copies a settings snapshot and later defaults remain independent", async () => {
  const memberSettings = await settingsRepository.get(memberId);
  const laterSettings = await settingsRepository.get(laterMemberId);
  expect(memberSettings.baseCurrency).toBe("USD");
  expect(laterSettings.baseCurrency).toBe("EUR");
  expect(memberSettings.lastSeenReleaseVersion).toBeNull();
  expect(laterSettings.lastSeenReleaseVersion).toBeNull();
  expect((await settingsRepository.get(adminId)).lastSeenReleaseVersion).toBe("1.1.1");

  const memberCategory = await categoryRepository.findByNameKind(
    memberId,
    `Shared-looking ${suffix}`,
    "EXPENSE",
  );
  const laterCategory = await categoryRepository.findByNameKind(
    laterMemberId,
    `Shared-looking ${suffix}`,
    "EXPENSE",
  );
  expect(memberCategory?.emoji).toBe("🧾");
  expect(laterCategory?.emoji).toBe("🪙");
  expect(memberCategory?.id).not.toBe(adminCategoryId);
  expect(laterCategory?.id).not.toBe(memberCategory?.id);

  await categoryRepository.update(memberId, memberCategory!.id, { emoji: "🧮" });
  expect((await categoryRepository.findById(adminId, adminCategoryId))?.emoji).toBe("🪙");
  expect((await categoryRepository.findById(laterMemberId, laterCategory!.id))?.emoji).toBe("🪙");
});

test("release acknowledgements remain isolated between existing users", async () => {
  await settingsRepository.acknowledgeRelease(memberId, "1.1.2");

  expect((await settingsRepository.get(memberId)).lastSeenReleaseVersion).toBe("1.1.2");
  expect((await settingsRepository.get(adminId)).lastSeenReleaseVersion).toBe("1.1.1");
  expect((await settingsRepository.get(laterMemberId)).lastSeenReleaseVersion).toBeNull();
});
