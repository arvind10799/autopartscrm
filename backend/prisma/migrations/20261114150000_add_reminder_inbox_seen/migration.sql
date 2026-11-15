BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "ReminderUserPreference" ADD COLUMN "handoffsSeenAt" TIMESTAMPTZ(3);
COMMIT;
