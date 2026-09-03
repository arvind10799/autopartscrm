ALTER TABLE "ReplacementRequest" ADD COLUMN "replacementProNumber" VARCHAR(50);
ALTER TABLE "ReplacementRequest" ADD COLUMN "replacementCarrierName" VARCHAR(120);
ALTER TABLE "ReplacementHistory" ADD COLUMN "replacementProNumber" VARCHAR(50);
ALTER TABLE "ReplacementHistory" ADD COLUMN "replacementCarrierName" VARCHAR(120);

ALTER TABLE "ReplacementRequest" ALTER COLUMN "replacementStatus" DROP DEFAULT;

ALTER TYPE "ReplacementStatus" RENAME TO "ReplacementStatus_old";

CREATE TYPE "ReplacementStatus" AS ENUM (
  'YARD_CONTACTED',
  'WAITING_YARD_RESPONSE',
  'APPROVED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED'
);

ALTER TABLE "ReplacementRequest"
ALTER COLUMN "replacementStatus" TYPE "ReplacementStatus"
USING (
  CASE "replacementStatus"::text
    WHEN 'REQUESTED' THEN 'YARD_CONTACTED'
    WHEN 'REPLACEMENT_ORDERED' THEN 'APPROVED'
    WHEN 'REPLACEMENT_SHIPPED' THEN 'SHIPPED'
    WHEN 'COMPLETED' THEN 'DELIVERED'
    WHEN 'REJECTED' THEN 'WAITING_YARD_RESPONSE'
    ELSE "replacementStatus"::text
  END
)::"ReplacementStatus";

ALTER TABLE "ReplacementHistory"
ALTER COLUMN "previousStatus" TYPE "ReplacementStatus"
USING (
  CASE "previousStatus"::text
    WHEN 'REQUESTED' THEN 'YARD_CONTACTED'
    WHEN 'REPLACEMENT_ORDERED' THEN 'APPROVED'
    WHEN 'REPLACEMENT_SHIPPED' THEN 'SHIPPED'
    WHEN 'COMPLETED' THEN 'DELIVERED'
    WHEN 'REJECTED' THEN 'WAITING_YARD_RESPONSE'
    ELSE "previousStatus"::text
  END
)::"ReplacementStatus";

ALTER TABLE "ReplacementHistory"
ALTER COLUMN "nextStatus" TYPE "ReplacementStatus"
USING (
  CASE "nextStatus"::text
    WHEN 'REQUESTED' THEN 'YARD_CONTACTED'
    WHEN 'REPLACEMENT_ORDERED' THEN 'APPROVED'
    WHEN 'REPLACEMENT_SHIPPED' THEN 'SHIPPED'
    WHEN 'COMPLETED' THEN 'DELIVERED'
    WHEN 'REJECTED' THEN 'WAITING_YARD_RESPONSE'
    ELSE "nextStatus"::text
  END
)::"ReplacementStatus";

ALTER TABLE "ReplacementRequest" ALTER COLUMN "replacementStatus" SET DEFAULT 'YARD_CONTACTED';

DROP TYPE "ReplacementStatus_old";

CREATE INDEX "ReplacementRequest_replacementProNumber_idx" ON "ReplacementRequest"("replacementProNumber");
