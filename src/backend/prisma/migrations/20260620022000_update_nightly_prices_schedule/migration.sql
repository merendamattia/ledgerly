UPDATE "cron_job"
SET "schedule" = '20 2 * * *'
WHERE "key" = 'nightly-prices';
