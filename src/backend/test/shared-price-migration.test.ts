import { afterAll, beforeAll, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDirectory = join(import.meta.dir, "../prisma/migrations");
const ownershipMigration = "20260829190000_multi_user_ownership";
const sharedPriceMigration = "20260830100000_shared_provider_prices";
const suffix = `${Date.now()}_${process.pid}`;
const legacyUserId = `migration-legacy-${suffix}`;
const secondUserId = `migration-second-${suffix}`;
const legacyTickerId = `migration-bond-legacy-${suffix}`;
const secondTickerId = `migration-bond-second-${suffix}`;
const bondSymbol = `MIGRATION.BOND.${suffix}`;
const databaseName = `ledgerly_migration_${suffix}`;

const sourceDatabaseUrl = process.env.DATABASE_URL;
if (!sourceDatabaseUrl) throw new Error("DATABASE_URL is required for migration tests");

const migrationDatabaseUrl = new URL(sourceDatabaseUrl);
migrationDatabaseUrl.pathname = `/${databaseName}`;

function text(output: Uint8Array | null): string {
  return output ? new TextDecoder().decode(output) : "";
}

function runPsql(databaseUrl: string, args: string[]): string {
  const result = Bun.spawnSync([
    "psql",
    "--no-psqlrc",
    "--dbname",
    databaseUrl,
    "--set",
    "ON_ERROR_STOP=1",
    ...args,
  ], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`psql failed: ${text(result.stderr) || text(result.stdout)}`);
  }
  return text(result.stdout).trim();
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function migrationPath(name: string): string {
  return join(migrationsDirectory, name, "migration.sql");
}

function applyMigrationsThrough(name: string): void {
  const migrationNames = readdirSync(migrationsDirectory)
    .filter((entry) => entry < name)
    .sort();
  for (const migrationName of migrationNames) {
    runPsql(migrationDatabaseUrl.toString(), ["--file", migrationPath(migrationName)]);
  }
}

function createLegacyRows(): void {
  runPsql(migrationDatabaseUrl.toString(), [
    "--command",
    `
      INSERT INTO "user" ("id", "name", "email", "updatedAt")
      VALUES (${sqlString(legacyUserId)}, 'Legacy Admin', ${sqlString(`${legacyUserId}@example.com`)}, CURRENT_TIMESTAMP);
      INSERT INTO "ticker" ("id", "symbol", "isin", "name", "type", "currency", "provider")
      VALUES (${sqlString(legacyTickerId)}, ${sqlString(bondSymbol)}, 'LEGACY-ISIN', 'Legacy Bond', 'BOND', 'EUR', 'yahoo-bond');
      INSERT INTO "price_history" ("id", "tickerId", "date", "close")
      VALUES (${sqlString(`${legacyTickerId}-anchor`)}, ${sqlString(legacyTickerId)}, '2026-01-01', 77);
    `,
  ]);
}

function createSecondUserRows(): void {
  runPsql(migrationDatabaseUrl.toString(), [
    "--command",
    `
      INSERT INTO "user" ("id", "name", "email", "updatedAt")
      VALUES (${sqlString(secondUserId)}, 'Second User', ${sqlString(`${secondUserId}@example.com`)}, CURRENT_TIMESTAMP);
      INSERT INTO "ticker" ("id", "userId", "symbol", "isin", "name", "type", "currency", "provider")
      VALUES (${sqlString(secondTickerId)}, ${sqlString(secondUserId)}, ${sqlString(bondSymbol)}, 'SECOND-ISIN', 'Second Bond', 'BOND', 'EUR', 'yahoo-bond');
      INSERT INTO "price_history" ("id", "tickerId", "date", "close")
      VALUES (${sqlString(`${secondTickerId}-anchor`)}, ${sqlString(secondTickerId)}, '2026-01-01', 91);
    `,
  ]);
}

beforeAll(() => {
  runPsql(sourceDatabaseUrl, ["--command", `CREATE DATABASE \"${databaseName}\"`]);
  applyMigrationsThrough(ownershipMigration);
  createLegacyRows();
  runPsql(migrationDatabaseUrl.toString(), ["--file", migrationPath(ownershipMigration)]);
  createSecondUserRows();
  runPsql(migrationDatabaseUrl.toString(), ["--file", migrationPath(sharedPriceMigration)]);
});

afterAll(() => {
  runPsql(sourceDatabaseUrl, ["--command", `DROP DATABASE IF EXISTS \"${databaseName}\" WITH (FORCE)`]);
});

test("keeps legacy bond purchase anchors local to each ticker during price sharing migration", () => {
  const anchors = runPsql(migrationDatabaseUrl.toString(), [
    "--tuples-only",
    "--no-align",
    "--command",
    `
      SELECT p."tickerId", p."close"
      FROM "price_history" p
      JOIN "ticker" t ON t."id" = p."tickerId"
      WHERE t."symbol" = ${sqlString(bondSymbol)}
      ORDER BY p."tickerId";
    `,
  ])
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);

  expect(anchors).toEqual([
    `${legacyTickerId}|77.00000000`,
    `${secondTickerId}|91.00000000`,
  ]);
  expect(
    runPsql(migrationDatabaseUrl.toString(), [
      "--tuples-only",
      "--no-align",
      "--command",
      `SELECT COUNT(*) FROM "provider_price_history" WHERE "provider" = 'yahoo-bond' AND "symbol" = ${sqlString(bondSymbol)};`,
    ]),
  ).toBe("0");
});
