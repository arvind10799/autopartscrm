-- Additive foundation only. Bound lock waits instead of blocking live traffic indefinitely.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateEnum
CREATE TYPE "ReminderContext" AS ENUM ('PERSONAL', 'WEBSITE_LEAD', 'LEAD', 'ORDER', 'SHIPMENT_ORDER', 'SHIPMENT', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "ReminderOwnerKind" AS ENUM ('USER', 'SHIPPING_QUEUE');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('OPEN', 'SNOOZED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReminderHistoryAction" AS ENUM ('CREATED', 'EDITED', 'SNOOZED', 'WORK_STARTED', 'HANDED_OFF', 'REASSIGNED', 'ESCALATED', 'COMPLETED', 'CANCELLED', 'DELETED');

-- CreateEnum
CREATE TYPE "ReminderDeliveryKind" AS ENUM ('EARLY', 'DUE', 'SECOND_ALERT', 'ESCALATION', 'ASSIGNED', 'COMPLETED', 'AUTO_CLOSED');

-- CreateEnum
CREATE TYPE "ReminderDeliveryChannel" AS ENUM ('BELL', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "billingState" VARCHAR(2);

-- CreateTable
CREATE TABLE "ReminderType" (
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "allowedRoles" "Role"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReminderType_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "typeKey" VARCHAR(50) NOT NULL,
    "context" "ReminderContext" NOT NULL,
    "websiteLeadId" UUID,
    "leadId" UUID,
    "orderId" UUID,
    "shipmentId" UUID,
    "replacementId" UUID,
    "ownerKind" "ReminderOwnerKind" NOT NULL,
    "ownerUserId" UUID,
    "createdById" UUID NOT NULL,
    "assignedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isHandoff" BOOLEAN NOT NULL DEFAULT false,
    "notifyCreatorOnCompletion" BOOLEAN NOT NULL DEFAULT false,
    "priority" "ReminderPriority" NOT NULL DEFAULT 'MEDIUM',
    "note" VARCHAR(1000),
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "localDueAt" VARCHAR(16) NOT NULL,
    "timeZone" VARCHAR(40) NOT NULL,
    "earlyAlertMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ReminderStatus" NOT NULL DEFAULT 'OPEN',
    "snoozedUntil" TIMESTAMPTZ(3),
    "snoozeCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMPTZ(3),
    "completedById" UUID,
    "completionNote" VARCHAR(1000),
    "cancelReason" VARCHAR(255),
    "escalatedAt" TIMESTAMPTZ(3),
    "workingById" UUID,
    "workingUntil" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduleVersion" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderHistory" (
    "id" UUID NOT NULL,
    "reminderId" UUID NOT NULL,
    "actorId" UUID,
    "action" "ReminderHistoryAction" NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderDelivery" (
    "id" UUID NOT NULL,
    "reminderId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "reminderVersion" INTEGER NOT NULL,
    "kind" "ReminderDeliveryKind" NOT NULL,
    "channel" "ReminderDeliveryChannel" NOT NULL,
    "status" "ReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ(3) NOT NULL,
    "lockedUntil" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderUserPreference" (
    "userId" UUID NOT NULL,
    "displayTimeZone" VARCHAR(40) NOT NULL DEFAULT 'America/Los_Angeles',
    "workingStartMinute" INTEGER NOT NULL DEFAULT 540,
    "workingEndMinute" INTEGER NOT NULL DEFAULT 1020,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReminderUserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ReminderSettings" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'default',
    "workingMarkerMinutes" INTEGER NOT NULL DEFAULT 120,
    "secondAlertMinutes" INTEGER DEFAULT 30,
    "escalationMinutes" INTEGER DEFAULT 120,
    "snoozeFlagCount" INTEGER DEFAULT 3,
    "callingStartMinute" INTEGER NOT NULL DEFAULT 480,
    "callingEndMinute" INTEGER NOT NULL DEFAULT 1200,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_ownerUserId_deletedAt_status_dueAt_idx" ON "Reminder"("ownerUserId", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_ownerKind_deletedAt_status_dueAt_idx" ON "Reminder"("ownerKind", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_status_dueAt_idx" ON "Reminder"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_workingUntil_idx" ON "Reminder"("workingUntil");

-- CreateIndex
CREATE INDEX "Reminder_websiteLeadId_deletedAt_status_dueAt_idx" ON "Reminder"("websiteLeadId", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_leadId_deletedAt_status_dueAt_idx" ON "Reminder"("leadId", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_orderId_deletedAt_status_dueAt_idx" ON "Reminder"("orderId", "deletedAt", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_shipmentId_idx" ON "Reminder"("shipmentId");

-- CreateIndex
CREATE INDEX "Reminder_replacementId_idx" ON "Reminder"("replacementId");

-- CreateIndex
CREATE INDEX "Reminder_createdById_idx" ON "Reminder"("createdById");

-- CreateIndex
CREATE INDEX "ReminderHistory_reminderId_createdAt_idx" ON "ReminderHistory"("reminderId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderHistory_actorId_idx" ON "ReminderHistory"("actorId");

-- CreateIndex
CREATE INDEX "ReminderDelivery_status_availableAt_idx" ON "ReminderDelivery"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ReminderDelivery_lockedUntil_idx" ON "ReminderDelivery"("lockedUntil");

-- CreateIndex
CREATE INDEX "ReminderDelivery_recipientUserId_idx" ON "ReminderDelivery"("recipientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderDelivery_dedup_key" ON "ReminderDelivery"("reminderId", "reminderVersion", "recipientUserId", "kind", "channel");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_typeKey_fkey" FOREIGN KEY ("typeKey") REFERENCES "ReminderType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_websiteLeadId_fkey" FOREIGN KEY ("websiteLeadId") REFERENCES "WebsiteLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "ReplacementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_workingById_fkey" FOREIGN KEY ("workingById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderHistory" ADD CONSTRAINT "ReminderHistory_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderHistory" ADD CONSTRAINT "ReminderHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderUserPreference" ADD CONSTRAINT "ReminderUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not express CHECK constraints; retain these when creating future migrations.
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_owner_check" CHECK (
  ("ownerKind" = 'USER' AND "ownerUserId" IS NOT NULL) OR
  ("ownerKind" = 'SHIPPING_QUEUE' AND "ownerUserId" IS NULL AND "context" IN ('SHIPMENT_ORDER', 'SHIPMENT', 'REPLACEMENT'))
);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_record_check" CHECK (
  ("context" = 'PERSONAL' AND num_nonnulls("websiteLeadId", "leadId", "orderId", "shipmentId", "replacementId") = 0 AND "ownerKind" = 'USER' AND "ownerUserId" = "createdById" AND NOT "isHandoff") OR
  ("context" = 'WEBSITE_LEAD' AND "websiteLeadId" IS NOT NULL AND num_nonnulls("leadId", "orderId", "shipmentId", "replacementId") = 0) OR
  ("context" = 'LEAD' AND "leadId" IS NOT NULL AND num_nonnulls("websiteLeadId", "orderId", "shipmentId", "replacementId") = 0) OR
  ("context" IN ('ORDER', 'SHIPMENT_ORDER') AND "orderId" IS NOT NULL AND "websiteLeadId" IS NULL AND "leadId" IS NULL AND ("isHandoff" OR num_nonnulls("shipmentId", "replacementId") = 0)) OR
  ("context" = 'SHIPMENT' AND "orderId" IS NOT NULL AND "shipmentId" IS NOT NULL AND num_nonnulls("websiteLeadId", "leadId", "replacementId") = 0) OR
  ("context" = 'REPLACEMENT' AND "orderId" IS NOT NULL AND "replacementId" IS NOT NULL AND num_nonnulls("websiteLeadId", "leadId") = 0)
);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_schedule_check" CHECK (
  "timeZone" IN ('America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Phoenix') AND
  "localDueAt" ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' AND
  "earlyAlertMinutes" IN (0, 5, 15, 30) AND "snoozeCount" >= 0 AND "version" > 0 AND "scheduleVersion" > 0
);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_completion_check" CHECK (
  ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL) OR ("status" <> 'COMPLETED' AND "completedAt" IS NULL AND "completedById" IS NULL)
);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_working_check" CHECK (
  ("workingById" IS NULL AND "workingUntil" IS NULL) OR
  ("workingById" IS NOT NULL AND "workingUntil" IS NOT NULL AND "ownerKind" = 'SHIPPING_QUEUE' AND "status" IN ('OPEN', 'SNOOZED'))
);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_snooze_check" CHECK (("status" = 'SNOOZED') = ("snoozedUntil" IS NOT NULL));
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_soft_delete_check" CHECK ("deletedAt" IS NULL OR "status" = 'CANCELLED');
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_attempts_check" CHECK ("attempts" >= 0 AND "reminderVersion" > 0);
ALTER TABLE "ReminderUserPreference" ADD CONSTRAINT "ReminderUserPreference_zone_check" CHECK ("displayTimeZone" IN ('America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York'));
ALTER TABLE "ReminderUserPreference" ADD CONSTRAINT "ReminderUserPreference_hours_check" CHECK ("workingStartMinute" BETWEEN 0 AND 1439 AND "workingEndMinute" BETWEEN 0 AND 1439 AND "workingStartMinute" <> "workingEndMinute");
ALTER TABLE "ReminderSettings" ADD CONSTRAINT "ReminderSettings_values_check" CHECK (
  "id" = 'default' AND "workingMarkerMinutes" BETWEEN 30 AND 480 AND
  ("secondAlertMinutes" IS NULL OR "secondAlertMinutes" BETWEEN 15 AND 240) AND
  ("escalationMinutes" IS NULL OR "escalationMinutes" BETWEEN 30 AND 1440) AND
  ("snoozeFlagCount" IS NULL OR "snoozeFlagCount" BETWEEN 1 AND 10) AND
  "callingStartMinute" BETWEEN 0 AND 1439 AND "callingEndMinute" BETWEEN 0 AND 1439
);

-- Populate only NEW feature tables. Do not run the general CRM seed on existing data.
INSERT INTO "ReminderType" ("key", "label", "allowedRoles") VALUES
('CALL', 'Call', ARRAY['ADMIN','SALES']::"Role"[]),
('EMAIL', 'Email', ARRAY['ADMIN','SALES']::"Role"[]),
('TEXT', 'Text', ARRAY['ADMIN','SALES']::"Role"[]),
('QUOTE_FOLLOW_UP', 'Quote Follow-up', ARRAY['ADMIN','SALES']::"Role"[]),
('PRICE_CONFIRMATION', 'Price Confirmation', ARRAY['ADMIN','SALES']::"Role"[]),
('PAYMENT_FOLLOW_UP', 'Payment Follow-up', ARRAY['ADMIN','SALES']::"Role"[]),
('SIGNATURE_FOLLOW_UP', 'Signature Follow-up', ARRAY['ADMIN','SALES']::"Role"[]),
('CUSTOMER_DELIVERY_CHECK_IN', 'Customer Delivery Check-in', ARRAY['ADMIN','SALES']::"Role"[]),
('YARD_FOLLOW_UP', 'Yard Follow-up', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('PURCHASE_CHECK', 'Purchase Check', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('COST_ENTRY', 'Cost Entry', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('PICKUP_SCHEDULING', 'Pickup Scheduling', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('CARRIER_FOLLOW_UP', 'Carrier Follow-up', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('TRACKING_CHECK', 'Tracking Check', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('DELAY_DISPUTE_FOLLOW_UP', 'Delay/Dispute Follow-up', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('DELIVERY_CONFIRMATION', 'Delivery Confirmation', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('REPLACEMENT_YARD_FOLLOW_UP', 'Replacement Yard Follow-up', ARRAY['ADMIN','SHIPPING']::"Role"[]),
('CUSTOM', 'Custom', ARRAY['ADMIN','SALES','SHIPPING']::"Role"[]),
('REVIEW', 'Review', ARRAY['ADMIN']::"Role"[]),
('INTERNAL_TASK', 'Internal Task', ARRAY['ADMIN']::"Role"[]);

INSERT INTO "ReminderSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
COMMIT;
