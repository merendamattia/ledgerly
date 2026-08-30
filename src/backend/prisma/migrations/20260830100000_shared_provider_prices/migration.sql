-- Keep provider-backed market data shared while preserving ticker-local
-- manual prices and purchase anchors.
CREATE TABLE "provider_price_history" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,

    CONSTRAINT "provider_price_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_price_history_provider_symbol_date_key"
  ON "provider_price_history"("provider", "symbol", "date");
CREATE INDEX "provider_price_history_provider_symbol_idx"
  ON "provider_price_history"("provider", "symbol");

-- Move legacy provider bars out of the user-owned ticker table. A legacy
-- installation has one owner, while any duplicate provider rows represent the
-- same external source and can safely be represented by one shared close.
INSERT INTO "provider_price_history" ("id", "provider", "symbol", "date", "close")
SELECT p."id", t."provider", t."symbol", p."date", p."close"
FROM "price_history" p
JOIN "ticker" t ON t."id" = p."tickerId"
WHERE t."provider" <> 'manual'
ON CONFLICT ("provider", "symbol", "date") DO NOTHING;

DELETE FROM "price_history" p
USING "ticker" t
WHERE t."id" = p."tickerId"
  AND t."provider" <> 'manual';
