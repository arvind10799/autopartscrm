CREATE TABLE "Invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "invoiceNumber" VARCHAR(50) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "salesAssistant" VARCHAR(120),
    "customerName" VARCHAR(160) NOT NULL,
    "contactNumber" VARCHAR(30),
    "billingAddress" TEXT,
    "shippingAddress" TEXT,
    "shippingVendor" VARCHAR(80) NOT NULL DEFAULT 'LTL',
    "deliveryTimeline" VARCHAR(120) NOT NULL DEFAULT '7-8 Business Days',
    "itemDescription" VARCHAR(255) NOT NULL,
    "vehiclePartDescription" VARCHAR(255),
    "quantity" INTEGER NOT NULL,
    "saleAmount" DECIMAL(12,2) NOT NULL,
    "paymentStatus" VARCHAR(80),
    "paymentDate" TIMESTAMP(3),
    "paymentSource" VARCHAR(160),
    "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salesTaxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coreCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "customerSignature" VARCHAR(160),
    "signatureDate" TIMESTAMP(3),
    "status" VARCHAR(40) NOT NULL DEFAULT 'CREATED',
    "pdfStorageKey" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
