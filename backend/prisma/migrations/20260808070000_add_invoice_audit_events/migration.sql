-- CreateTable
CREATE TABLE "InvoiceAuditEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    "eventType" VARCHAR(40) NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "actorName" VARCHAR(160),
    "actorEmail" VARCHAR(160),
    "actorPhone" VARCHAR(40),
    "ipAddress" VARCHAR(64),
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceAuditEvent_invoiceId_occurredAt_idx" ON "InvoiceAuditEvent"("invoiceId", "occurredAt");

-- CreateIndex
CREATE INDEX "InvoiceAuditEvent_eventType_idx" ON "InvoiceAuditEvent"("eventType");

-- AddForeignKey
ALTER TABLE "InvoiceAuditEvent" ADD CONSTRAINT "InvoiceAuditEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
