BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "ReminderSettings"
  ADD COLUMN "callingWindowEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "snoozeMinutes" INTEGER[] NOT NULL DEFAULT ARRAY[15,60,1440,4320],
  ADD COLUMN "defaultDisplayTimeZone" VARCHAR(64) NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN "stateTimeZones" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "policyVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ReminderSettings" ADD CONSTRAINT "ReminderSettings_policy_check" CHECK (
  "policyVersion">0 AND cardinality("snoozeMinutes") BETWEEN 1 AND 8
  AND 0 < ALL("snoozeMinutes") AND 43200 >= ALL("snoozeMinutes")
  AND "callingStartMinute" BETWEEN 0 AND 1439 AND "callingEndMinute" BETWEEN 0 AND 1439
  AND (NOT "callingWindowEnabled" OR "callingStartMinute" <> "callingEndMinute")
  AND "defaultDisplayTimeZone" IN ('America/Los_Angeles','America/Denver','America/Chicago','America/New_York')
  AND jsonb_typeof("stateTimeZones")='object'
);
COMMIT;
