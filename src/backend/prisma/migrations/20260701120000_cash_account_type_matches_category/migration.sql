-- Make each cash account's `type` identify its section instead of the generic
-- "BANK". Non-broker accounts get their category name as the type; BROKER
-- accounts keep BROKER (their type drives investment-cash exclusion logic).
UPDATE "cash_account"
SET "type" = "category"::text
WHERE "type" <> 'BROKER';
