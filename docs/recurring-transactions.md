# Recurring transactions

[Documentation index](README.md) · [Deployment](deployment.md)

## Rule edits and generation

Editing an amount, category, note, or other non-scheduling field preserves the next
unbooked date and lifetime occurrence count. Booked transactions keep their original
values. Changing the start date or cadence selects the first date on the revised
schedule on or after both today's UTC date and the previous next-unbooked date.
Resuming a paused rule skips elapsed dates using its existing cadence. Skipped dates
do not consume the occurrence limit; booked occurrences still do. End-date limits
are inclusive, and reducing a limit below progress disables the rule. Extending an
ended rule requires explicitly enabling it again. New rules retain historical
catch-up behavior, bounded to 400 occurrences per run.

Generation and rule edits acquire the same PostgreSQL row lock. Each generation
batch inserts movements and advances the cursor/count in one transaction. A failed
batch rolls back both; retries and concurrent workers read the committed cursor
before booking. This avoids imposing uniqueness on editable transaction dates:
manually moving or deleting a booked transaction does not reopen its occurrence.
No migration, history rewrite, or automatic duplicate cleanup runs on deployment.
Deploy with old backend/worker processes stopped so no older generator writes
outside this locking protocol.

## Duplicate-history recovery

For duplicates created before the locking fix, use an optional, user-reviewed recovery:

1. Back up the database and pause the affected rule before investigating. Export
   its transactions, rule definition, cursor and count; retain these as an audit
   record. Never run a blanket deletion by amount, date or category.
2. In a read-only database session, list candidate groups for the affected owner
   (supply `user_id` using your SQL client's parameter mechanism):

   ```sql
   BEGIN TRANSACTION READ ONLY;
   SELECT "recurringExpenseId", date, COUNT(*) AS candidates,
          jsonb_agg(to_jsonb(t) ORDER BY "createdAt", id) AS original_rows
   FROM transaction AS t
   WHERE "userId" = :'user_id' AND "recurringExpenseId" IS NOT NULL
   GROUP BY "recurringExpenseId", date
   HAVING COUNT(*) > 1
   ORDER BY "recurringExpenseId", date;
   ROLLBACK;
   ```

3. Reconcile each candidate with the rule's actual scheduled occurrence and the
   user's records. Legacy rows have a rule association but no immutable scheduled
   date: a manually changed date may conceal a duplicate or produce a false match.
   Matching association/date identifies candidates, not proof of duplication.
   Unassociated manual transactions are excluded; uncertain rows stay untouched.
4. Have the owner approve the exact surplus transaction IDs. Remove only those
   individual movements through Activity, retaining the export and approved IDs.
   If a cursor was already reset before deployment, have a database operator review
   and restore its next unbooked date and lifetime processed count while the rule
   remains paused. Do not infer either solely from remaining row counts or the
   latest editable transaction date. Reconcile monthly totals before resuming;
   resuming skips dates elapsed while paused, so review the intended next date.
