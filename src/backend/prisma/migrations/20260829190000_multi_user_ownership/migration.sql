-- Add the Better Auth admin fields and the temporary-password marker.
ALTER TABLE "user"
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "banReason" TEXT,
  ADD COLUMN "banExpires" TIMESTAMP(3),
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "session" ADD COLUMN "impersonatedBy" TEXT;

-- Expand: ownership is nullable only while the legacy rows are assigned below.
ALTER TABLE "Settings" ADD COLUMN "userId" TEXT;
ALTER TABLE "Settings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "cash_account" ADD COLUMN "userId" TEXT;
ALTER TABLE "debt" ADD COLUMN "userId" TEXT;
ALTER TABLE "ticker" ADD COLUMN "userId" TEXT;
ALTER TABLE "holding" ADD COLUMN "userId" TEXT;
ALTER TABLE "investment_transaction" ADD COLUMN "userId" TEXT;
ALTER TABLE "category" ADD COLUMN "userId" TEXT;
ALTER TABLE "transaction" ADD COLUMN "userId" TEXT;
ALTER TABLE "recurring_expense" ADD COLUMN "userId" TEXT;
ALTER TABLE "net_worth_snapshot" ADD COLUMN "userId" TEXT;
ALTER TABLE "rebalance_group" ADD COLUMN "userId" TEXT;
ALTER TABLE "pillar" ADD COLUMN "userId" TEXT;

-- Backfill legacy data only when ownership is deterministic. A production
-- Ledgerly instance created by the old single-user version has one user. A
-- fresh database has no personal rows, so the same migration remains valid
-- before the bootstrap account is created. Refuse ambiguous data rather than
-- assigning it to an arbitrary account.
DO $$
DECLARE
  owner_id TEXT;
  user_count BIGINT;
  personal_row_count BIGINT;
BEGIN
  SELECT count(*) INTO user_count FROM "user";
  SELECT COALESCE((SELECT count(*) FROM "Settings"), 0)
    + COALESCE((SELECT count(*) FROM "cash_account"), 0)
    + COALESCE((SELECT count(*) FROM "debt"), 0)
    + COALESCE((SELECT count(*) FROM "ticker"), 0)
    + COALESCE((SELECT count(*) FROM "holding"), 0)
    + COALESCE((SELECT count(*) FROM "investment_transaction"), 0)
    + COALESCE((SELECT count(*) FROM "category"), 0)
    + COALESCE((SELECT count(*) FROM "transaction"), 0)
    + COALESCE((SELECT count(*) FROM "recurring_expense"), 0)
    + COALESCE((SELECT count(*) FROM "net_worth_snapshot"), 0)
    + COALESCE((SELECT count(*) FROM "rebalance_group"), 0)
    + COALESCE((SELECT count(*) FROM "pillar"), 0)
    INTO personal_row_count;

  IF personal_row_count > 0 AND user_count <> 1 THEN
    RAISE EXCEPTION 'Cannot migrate legacy personal data: expected exactly one user, found %', user_count;
  END IF;

  IF user_count = 1 THEN
    SELECT id INTO owner_id FROM "user" LIMIT 1;

    UPDATE "user"
    SET "role" = 'admin', "mustChangePassword" = false
    WHERE id = owner_id;

    UPDATE "Settings" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "cash_account" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "debt" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "ticker" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "holding" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "investment_transaction" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "category" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "transaction" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "recurring_expense" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "net_worth_snapshot" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "rebalance_group" SET "userId" = owner_id WHERE "userId" IS NULL;
    UPDATE "pillar" SET "userId" = owner_id WHERE "userId" IS NULL;
  END IF;
END $$;

-- Constrain: all personal aggregate roots must have an owner after the
-- deterministic backfill. Empty fresh-install tables can accept the constraint
-- before the bootstrap user exists.
ALTER TABLE "Settings" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "cash_account" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "debt" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ticker" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "holding" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "investment_transaction" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "category" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "transaction" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "recurring_expense" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "net_worth_snapshot" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "rebalance_group" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "pillar" ALTER COLUMN "userId" SET NOT NULL;

-- Tenant-aware uniqueness replaces the old global constraints.
DROP INDEX IF EXISTS "ticker_symbol_key";
DROP INDEX IF EXISTS "category_kind_name_key";
DROP INDEX IF EXISTS "net_worth_snapshot_date_key";
DROP INDEX IF EXISTS "pillar_position_key";
DROP INDEX IF EXISTS "rebalance_member_tickerId_key";

CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
CREATE UNIQUE INDEX "ticker_userId_symbol_key" ON "ticker"("userId", "symbol");
CREATE UNIQUE INDEX "category_userId_kind_name_key" ON "category"("userId", "kind", "name");
CREATE UNIQUE INDEX "net_worth_snapshot_userId_date_key" ON "net_worth_snapshot"("userId", "date");
CREATE UNIQUE INDEX "rebalance_member_tickerId_key" ON "rebalance_member"("tickerId");
CREATE UNIQUE INDEX "rebalance_member_groupId_tickerId_key" ON "rebalance_member"("groupId", "tickerId");
CREATE UNIQUE INDEX "pillar_userId_position_key" ON "pillar"("userId", "position");

CREATE INDEX "cash_account_userId_idx" ON "cash_account"("userId");
CREATE INDEX "debt_userId_idx" ON "debt"("userId");
CREATE INDEX "ticker_userId_idx" ON "ticker"("userId");
CREATE INDEX "holding_userId_idx" ON "holding"("userId");
CREATE INDEX "investment_transaction_userId_idx" ON "investment_transaction"("userId");
CREATE INDEX "category_userId_idx" ON "category"("userId");
CREATE INDEX "transaction_userId_idx" ON "transaction"("userId");
CREATE INDEX "recurring_expense_userId_idx" ON "recurring_expense"("userId");
CREATE INDEX "net_worth_snapshot_userId_idx" ON "net_worth_snapshot"("userId");
CREATE INDEX "rebalance_group_userId_idx" ON "rebalance_group"("userId");
CREATE INDEX "pillar_userId_idx" ON "pillar"("userId");

-- Ownership foreign keys. Child rows keep their existing parent boundary and
-- are scoped through that parent in repositories.
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_account" ADD CONSTRAINT "cash_account_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debt" ADD CONSTRAINT "debt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticker" ADD CONSTRAINT "ticker_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "holding" ADD CONSTRAINT "holding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investment_transaction" ADD CONSTRAINT "investment_transaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category" ADD CONSTRAINT "category_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "net_worth_snapshot" ADD CONSTRAINT "net_worth_snapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rebalance_group" ADD CONSTRAINT "rebalance_group_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pillar" ADD CONSTRAINT "pillar_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
