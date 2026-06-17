ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_PAID';

CREATE TYPE "OrderPaymentMethod" AS ENUM ('WIRE_TRANSFER', 'CREDIT_CARD');

ALTER TABLE "Order"
ADD COLUMN "paymentMethod" "OrderPaymentMethod";
