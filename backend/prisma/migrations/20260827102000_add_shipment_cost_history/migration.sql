CREATE TABLE "ShipmentCostHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shipmentId" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "summary" TEXT NOT NULL,
  "changes" JSONB,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShipmentCostHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShipmentCostHistory_shipmentId_idx" ON "ShipmentCostHistory"("shipmentId");
CREATE INDEX "ShipmentCostHistory_createdById_idx" ON "ShipmentCostHistory"("createdById");
CREATE INDEX "ShipmentCostHistory_createdAt_idx" ON "ShipmentCostHistory"("createdAt");

ALTER TABLE "ShipmentCostHistory"
ADD CONSTRAINT "ShipmentCostHistory_shipmentId_fkey"
FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentCostHistory"
ADD CONSTRAINT "ShipmentCostHistory_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
