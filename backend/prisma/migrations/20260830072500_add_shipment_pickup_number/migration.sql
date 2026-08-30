ALTER TABLE "Shipment" ADD COLUMN "pickupNumber" VARCHAR(50);

CREATE INDEX "Shipment_pickupNumber_idx" ON "Shipment"("pickupNumber");
