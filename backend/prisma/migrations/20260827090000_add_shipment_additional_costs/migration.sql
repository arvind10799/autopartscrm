CREATE TABLE "ShipmentAdditionalCost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipmentId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentAdditionalCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShipmentAdditionalCost_shipmentId_idx" ON "ShipmentAdditionalCost"("shipmentId");
CREATE INDEX "ShipmentAdditionalCost_createdById_idx" ON "ShipmentAdditionalCost"("createdById");
CREATE INDEX "ShipmentAdditionalCost_createdAt_idx" ON "ShipmentAdditionalCost"("createdAt");

ALTER TABLE "ShipmentAdditionalCost" ADD CONSTRAINT "ShipmentAdditionalCost_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentAdditionalCost" ADD CONSTRAINT "ShipmentAdditionalCost_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ShipmentAdditionalCost" ("shipmentId", "amount", "reason", "createdById", "createdAt")
SELECT sc."shipmentId", sc."additionalAmount", COALESCE(NULLIF(TRIM(sc."notes"), ''), 'Legacy additional cost'), o."createdById", sc."updatedAt"
FROM "ShipmentCost" sc
JOIN "Shipment" s ON s."id" = sc."shipmentId"
JOIN "Order" o ON o."id" = s."orderId"
WHERE sc."additionalAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "ShipmentAdditionalCost" sac WHERE sac."shipmentId" = sc."shipmentId"
  );
