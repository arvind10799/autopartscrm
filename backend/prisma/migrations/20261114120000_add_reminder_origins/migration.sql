BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "Reminder" ADD COLUMN "originContext" "ReminderContext", ADD COLUMN "originRecordId" UUID;
CREATE INDEX "Reminder_originContext_originRecordId_idx" ON "Reminder"("originContext", "originRecordId");
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_origin_check" CHECK (("originContext" IS NULL) = ("originRecordId" IS NULL));
COMMIT;
