-- Normalize category names to trimmed lowercase and merge case-duplicates
-- (e.g. "Investments" + "investments" -> single "investments" row), then
-- enforce uniqueness of (kind, name) so duplicates cannot recur.

-- 1. Repoint transactions of duplicate categories to the canonical row
--    (earliest created per kind + normalized name).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY kind, lower(btrim(name))
      ORDER BY "createdAt", id
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY kind, lower(btrim(name))
      ORDER BY "createdAt", id
    ) AS keep_id
  FROM "category"
)
UPDATE "transaction" t
SET "categoryId" = r.keep_id
FROM ranked r
WHERE t."categoryId" = r.id AND r.rn > 1;

-- 2. Delete the now-orphaned duplicate categories.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY kind, lower(btrim(name))
      ORDER BY "createdAt", id
    ) AS rn
  FROM "category"
)
DELETE FROM "category"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Normalize the surviving names.
UPDATE "category"
SET name = lower(btrim(name))
WHERE name <> lower(btrim(name));

-- 4. Enforce uniqueness going forward.
CREATE UNIQUE INDEX "category_kind_name_key" ON "category"("kind", "name");
