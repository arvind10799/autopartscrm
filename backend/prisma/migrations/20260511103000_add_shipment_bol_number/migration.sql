ALTER TABLE "Shipment"
ADD COLUMN "bolNumber" VARCHAR(50) NOT NULL DEFAULT 'BOL-PENDING';

ALTER TABLE "Shipment"
ALTER COLUMN "bolNumber" DROP DEFAULT;

CREATE UNIQUE INDEX "Shipment_bolNumber_key" ON "Shipment"("bolNumber");
CREATE INDEX "Shipment_bolNumber_idx" ON "Shipment"("bolNumber");
