CREATE TABLE "RingCentralCallEvent" (
    "id" UUID NOT NULL,
    "telephonySessionId" VARCHAR(160) NOT NULL,
    "callerPhone" VARCHAR(40) NOT NULL,
    "matchedRecordType" VARCHAR(20),
    "matchedRecordId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RingCentralCallEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RingCentralCallEvent_telephonySessionId_key" ON "RingCentralCallEvent"("telephonySessionId");
CREATE INDEX "RingCentralCallEvent_createdAt_idx" ON "RingCentralCallEvent"("createdAt");
CREATE INDEX "RingCentralCallEvent_matchedRecordType_matchedRecordId_idx" ON "RingCentralCallEvent"("matchedRecordType", "matchedRecordId");
