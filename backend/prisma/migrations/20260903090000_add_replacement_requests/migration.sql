CREATE TYPE "ReplacementStatus" AS ENUM (
  'REQUESTED',
  'YARD_CONTACTED',
  'WAITING_YARD_RESPONSE',
  'APPROVED',
  'REPLACEMENT_ORDERED',
  'REPLACEMENT_SHIPPED',
  'COMPLETED',
  'REJECTED'
);

CREATE TABLE "ReplacementRequest" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "shipmentId" UUID,
  "customerReason" TEXT NOT NULL,
  "yardUpdate" TEXT,
  "replacementStatus" "ReplacementStatus" NOT NULL DEFAULT 'REQUESTED',
  "createdById" UUID NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReplacementRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReplacementHistory" (
  "id" UUID NOT NULL,
  "replacementRequestId" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "summary" TEXT NOT NULL,
  "previousStatus" "ReplacementStatus",
  "nextStatus" "ReplacementStatus",
  "customerReason" TEXT,
  "yardUpdate" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReplacementHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReplacementRequest_orderId_idx" ON "ReplacementRequest"("orderId");
CREATE INDEX "ReplacementRequest_shipmentId_idx" ON "ReplacementRequest"("shipmentId");
CREATE INDEX "ReplacementRequest_replacementStatus_idx" ON "ReplacementRequest"("replacementStatus");
CREATE INDEX "ReplacementRequest_updatedAt_idx" ON "ReplacementRequest"("updatedAt");
CREATE INDEX "ReplacementRequest_createdAt_idx" ON "ReplacementRequest"("createdAt");

CREATE INDEX "ReplacementHistory_replacementRequestId_idx" ON "ReplacementHistory"("replacementRequestId");
CREATE INDEX "ReplacementHistory_createdById_idx" ON "ReplacementHistory"("createdById");
CREATE INDEX "ReplacementHistory_createdAt_idx" ON "ReplacementHistory"("createdAt");

ALTER TABLE "ReplacementRequest"
  ADD CONSTRAINT "ReplacementRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReplacementRequest"
  ADD CONSTRAINT "ReplacementRequest_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReplacementRequest"
  ADD CONSTRAINT "ReplacementRequest_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReplacementRequest"
  ADD CONSTRAINT "ReplacementRequest_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReplacementHistory"
  ADD CONSTRAINT "ReplacementHistory_replacementRequestId_fkey"
  FOREIGN KEY ("replacementRequestId") REFERENCES "ReplacementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReplacementHistory"
  ADD CONSTRAINT "ReplacementHistory_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
