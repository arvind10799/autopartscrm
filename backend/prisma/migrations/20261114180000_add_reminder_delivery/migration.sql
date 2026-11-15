BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TYPE "ReminderDeliveryKind" ADD VALUE 'REASSIGNED';
ALTER TABLE "ReminderDelivery" ADD COLUMN "lockToken" UUID;
ALTER TABLE "ReminderSettings" ADD COLUMN "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "reminderId" UUID, ADD COLUMN "reminderDeliveryId" UUID;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Notification_reminderDeliveryId_key" ON "Notification"("reminderDeliveryId");
CREATE TABLE "ReminderPushSubscription" (
  "id" UUID NOT NULL PRIMARY KEY, "userId" UUID NOT NULL,
  "endpoint" VARCHAR(2048) NOT NULL, "p256dh" VARCHAR(100) NOT NULL, "auth" VARCHAR(40) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ReminderPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReminderPushSubscription_endpoint_key" ON "ReminderPushSubscription"("endpoint");
CREATE INDEX "ReminderPushSubscription_userId_idx" ON "ReminderPushSubscription"("userId");
CREATE TABLE "ReminderPushReceipt" (
  "deliveryId" UUID NOT NULL, "subscriptionId" UUID NOT NULL, "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("deliveryId", "subscriptionId"),
  FOREIGN KEY ("deliveryId") REFERENCES "ReminderDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("subscriptionId") REFERENCES "ReminderPushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ReminderDigest" (
  "id" UUID NOT NULL PRIMARY KEY, "userId" UUID NOT NULL, "shiftDate" VARCHAR(10) NOT NULL,
  "status" "ReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING', "availableAt" TIMESTAMPTZ(3) NOT NULL,
  "lockedUntil" TIMESTAMPTZ(3), "lockToken" UUID, "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" VARCHAR(500), "sentAt" TIMESTAMPTZ(3),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE ("userId", "shiftDate"), CHECK ("attempts" >= 0)
);
CREATE INDEX "ReminderDigest_status_availableAt_idx" ON "ReminderDigest"("status", "availableAt");
COMMIT;
