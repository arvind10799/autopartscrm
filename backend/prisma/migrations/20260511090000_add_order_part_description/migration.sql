ALTER TABLE "Order"
ADD COLUMN "partDescription" VARCHAR(255) NOT NULL DEFAULT 'Part description pending';

ALTER TABLE "Order"
ALTER COLUMN "partDescription" DROP DEFAULT;
