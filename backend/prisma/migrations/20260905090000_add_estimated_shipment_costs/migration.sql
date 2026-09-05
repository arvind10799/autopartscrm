ALTER TABLE "ShipmentCost"
ADD COLUMN "estimatedPurchaseAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "estimatedShippingAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "hasActualPurchaseAmount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasActualShippingAmount" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ShipmentCost"
SET
  "hasActualPurchaseAmount" = CASE WHEN "purchaseAmount" > 0 THEN true ELSE false END,
  "hasActualShippingAmount" = CASE WHEN "shippingAmount" > 0 THEN true ELSE false END;
