BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- CreateEnum
CREATE TYPE "ReminderRepeatFrequency" AS ENUM ('DAILY', 'EVERY_N_DAYS', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ReminderSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "occurrenceNumber" INTEGER,
ADD COLUMN     "seriesId" UUID;

-- CreateTable
CREATE TABLE "ReminderSeries" (
    "id" UUID NOT NULL,
    "frequency" "ReminderRepeatFrequency" NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "weekday" INTEGER,
    "anchorLocalAt" VARCHAR(16) NOT NULL,
    "lastScheduledLocalAt" VARCHAR(16) NOT NULL,
    "template" JSONB NOT NULL,
    "timeZone" VARCHAR(40) NOT NULL,
    "untilDate" VARCHAR(10),
    "maxOccurrences" INTEGER,
    "stopStatus" VARCHAR(40),
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stoppedAt" TIMESTAMPTZ(3),
    "stopReason" VARCHAR(255),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReminderSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSuggestionRule" (
    "key" VARCHAR(80) NOT NULL,
    "context" "ReminderContext" NOT NULL,
    "trigger" VARCHAR(50) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "typeKey" VARCHAR(50) NOT NULL,
    "assignment" VARCHAR(30) NOT NULL DEFAULT 'RECORD_OWNER',
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayMinutes" INTEGER NOT NULL DEFAULT 60,
    "requiresTime" BOOLEAN NOT NULL DEFAULT false,
    "missingCostOnly" BOOLEAN NOT NULL DEFAULT false,
    "repeatDays" INTEGER,
    "stopStatus" VARCHAR(40),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReminderSuggestionRule_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ReminderSuggestion" (
    "id" UUID NOT NULL,
    "ruleKey" VARCHAR(80) NOT NULL,
    "eventId" UUID NOT NULL,
    "context" "ReminderContext" NOT NULL,
    "recordId" UUID NOT NULL,
    "trigger" VARCHAR(50) NOT NULL,
    "status" "ReminderSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "acceptedReminderId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderAutomationAudit" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "subjectKey" VARCHAR(80) NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderAutomationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderSuggestionRule_context_trigger_isActive_idx" ON "ReminderSuggestionRule"("context", "trigger", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSuggestion_acceptedReminderId_key" ON "ReminderSuggestion"("acceptedReminderId");

-- CreateIndex
CREATE INDEX "ReminderSuggestion_context_recordId_status_createdAt_idx" ON "ReminderSuggestion"("context", "recordId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderSuggestion_decidedById_idx" ON "ReminderSuggestion"("decidedById");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSuggestion_eventId_ruleKey_key" ON "ReminderSuggestion"("eventId", "ruleKey");

-- CreateIndex
CREATE INDEX "ReminderAutomationAudit_actorId_idx" ON "ReminderAutomationAudit"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_seriesId_occurrenceNumber_key" ON "Reminder"("seriesId", "occurrenceNumber");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ReminderSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSeries" ADD CONSTRAINT "ReminderSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSuggestionRule" ADD CONSTRAINT "ReminderSuggestionRule_typeKey_fkey" FOREIGN KEY ("typeKey") REFERENCES "ReminderType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSuggestion" ADD CONSTRAINT "ReminderSuggestion_ruleKey_fkey" FOREIGN KEY ("ruleKey") REFERENCES "ReminderSuggestionRule"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSuggestion" ADD CONSTRAINT "ReminderSuggestion_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSuggestion" ADD CONSTRAINT "ReminderSuggestion_acceptedReminderId_fkey" FOREIGN KEY ("acceptedReminderId") REFERENCES "Reminder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderAutomationAudit" ADD CONSTRAINT "ReminderAutomationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_series_shape" CHECK (("seriesId" IS NULL AND "occurrenceNumber" IS NULL) OR ("seriesId" IS NOT NULL AND "occurrenceNumber" IS NOT NULL AND "occurrenceNumber" >= 1));
ALTER TABLE "ReminderSeries" ADD CONSTRAINT "ReminderSeries_limits" CHECK ("intervalDays" BETWEEN 1 AND 365 AND ("weekday" IS NULL OR "weekday" BETWEEN 0 AND 6) AND ("maxOccurrences" IS NULL OR "maxOccurrences" BETWEEN 1 AND 1000) AND "completedCount" >= 0 AND "version" > 0);
CREATE UNIQUE INDEX "Reminder_one_open_series_occurrence" ON "Reminder"("seriesId") WHERE "seriesId" IS NOT NULL AND "deletedAt" IS NULL AND "status" IN ('OPEN','SNOOZED');
ALTER TABLE "ReminderSuggestionRule" ADD CONSTRAINT "ReminderSuggestionRule_limits" CHECK ("delayDays" BETWEEN 0 AND 365 AND "delayMinutes" BETWEEN 0 AND 525600 AND ("repeatDays" IS NULL OR "repeatDays" BETWEEN 1 AND 365) AND "version" > 0);
INSERT INTO "ReminderSuggestionRule" ("key","context","trigger","label","typeKey","assignment","delayDays","delayMinutes","requiresTime","missingCostOnly","repeatDays","stopStatus","updatedAt") VALUES
('WEB_NEW','WEBSITE_LEAD','NEW_ASSIGNED','Call the newly assigned website inquiry','CALL','RECORD_OWNER',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('WEB_CONTACTED','WEBSITE_LEAD','CONTACTED','Follow up with the contacted inquiry','CALL','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('LEAD_PROSPECT','LEAD','PROSPECT','Call this prospect','CALL','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('LEAD_QUOTED','LEAD','QUOTED','Follow up on the quote','QUOTE_FOLLOW_UP','RECORD_OWNER',2,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('LEAD_CALLBACK','LEAD','CALL_BACK_LATER','Choose the customer''s callback time','CALL','RECORD_OWNER',0,60,true,false,NULL,NULL,CURRENT_TIMESTAMP),
('LEAD_SHOPPING','LEAD','SHOPPING_AROUND','Follow up while the customer compares quotes','QUOTE_FOLLOW_UP','RECORD_OWNER',3,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('ORDER_DRAFT','ORDER','DRAFT','Follow up on the draft order','CALL','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('ORDER_PARTIAL','ORDER','PARTIALLY_PAID','Follow up on the remaining payment','PAYMENT_FOLLOW_UP','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('ORDER_SIGNATURE','ORDER','SIGNATURE_REQUEST','Follow up on the invoice signature','SIGNATURE_FOLLOW_UP','RECORD_OWNER',0,1440,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('ORDER_LOCATE','SHIPMENT_ORDER','CONFIRMED','Locate a yard for the confirmed order','YARD_FOLLOW_UP','RECORD_OWNER',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_PENDING','SHIPMENT','PENDING','Follow up with the yard','YARD_FOLLOW_UP','RECORD_OWNER',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_LOCATING','SHIPMENT','LOCATING','Check part availability with the yard','YARD_FOLLOW_UP','RECORD_OWNER',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_PRE_PURCHASE','SHIPMENT','PRE_PROCESSING','Check the part purchase','PURCHASE_CHECK','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_PURCHASE','SHIPMENT','PURCHASE','Follow up on the purchase','PURCHASE_CHECK','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_PRE_COST','SHIPMENT','PRE_PROCESSING','Enter the actual part cost','COST_ENTRY','RECORD_OWNER',0,60,false,true,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_PURCHASE_COST','SHIPMENT','PURCHASE','Enter the actual part cost','COST_ENTRY','RECORD_OWNER',0,60,false,true,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_SHIPPED','SHIPMENT','SHIPPED','Check tracking every two days','TRACKING_CHECK','RECORD_OWNER',2,0,false,false,2,'DELIVERED',CURRENT_TIMESTAMP),
('SHIP_TRANSIT','SHIPMENT','IN_TRANSIT','Check tracking every two days','TRACKING_CHECK','RECORD_OWNER',2,0,false,false,2,'DELIVERED',CURRENT_TIMESTAMP),
('SHIP_DISPUTED','SHIPMENT','DISPUTED','Follow up with the carrier daily','CARRIER_FOLLOW_UP','RECORD_OWNER',1,0,false,false,1,'DELIVERED',CURRENT_TIMESTAMP),
('SHIP_DELAYED','SHIPMENT','DELAYED','Follow up with the carrier daily','CARRIER_FOLLOW_UP','RECORD_OWNER',1,0,false,false,1,'DELIVERED',CURRENT_TIMESTAMP),
('SHIP_DISPUTE_SALES','SHIPMENT','DISPUTED','Update the customer about the dispute','CUSTOM','SALES_AGENT',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_DELAY_SALES','SHIPMENT','DELAYED','Update the customer about the delay','CUSTOM','SALES_AGENT',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('SHIP_DELIVERED','SHIPMENT','DELIVERED','Check delivery with the customer','CUSTOMER_DELIVERY_CHECK_IN','SALES_AGENT',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('REPL_WAITING','REPLACEMENT','WAITING_YARD_RESPONSE','Follow up on the replacement yard response','REPLACEMENT_YARD_FOLLOW_UP','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('REPL_CONTACTED','REPLACEMENT','YARD_CONTACTED','Follow up with the replacement yard','REPLACEMENT_YARD_FOLLOW_UP','RECORD_OWNER',1,0,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('REPL_AGREED','REPLACEMENT','AGREED','Schedule replacement pickup','PICKUP_SCHEDULING','RECORD_OWNER',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('REPL_DISAGREED','REPLACEMENT','DISAGREED','Update the customer about the replacement','CUSTOM','SALES_AGENT',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('REPL_REFUND','REPLACEMENT','YARD_REFUNDING','Update the customer about the yard refund','CUSTOM','SALES_AGENT',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('REPL_UNAVAILABLE','REPLACEMENT','YARD_DOESNT_HAVE_REPLACEMENT','Update the customer: replacement unavailable','CUSTOM','SALES_AGENT',0,60,false,false,NULL,NULL,CURRENT_TIMESTAMP),
('REPL_SHIPPED','REPLACEMENT','SHIPPED','Check replacement tracking every two days','TRACKING_CHECK','RECORD_OWNER',2,0,false,false,2,'DELIVERED',CURRENT_TIMESTAMP),
('REPL_TRANSIT','REPLACEMENT','IN_TRANSIT','Check replacement tracking every two days','TRACKING_CHECK','RECORD_OWNER',2,0,false,false,2,'DELIVERED',CURRENT_TIMESTAMP);
COMMIT;
