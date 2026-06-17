-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "leadDate" TIMESTAMP(3) NOT NULL,
    "adviserName" VARCHAR(120) NOT NULL,
    "cmpt" VARCHAR(80) NOT NULL,
    "customerPhone" VARCHAR(30) NOT NULL,
    "customerName" VARCHAR(160) NOT NULL,
    "partDescription" VARCHAR(255) NOT NULL,
    "quote" DECIMAL(12,2),
    "comments" TEXT,
    "prospects" VARCHAR(255) NOT NULL,
    "createdById" UUID NOT NULL,
    "convertedOrderId" UUID,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedOrderId_key" ON "Lead"("convertedOrderId");

-- CreateIndex
CREATE INDEX "Lead_leadDate_idx" ON "Lead"("leadDate");

-- CreateIndex
CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");

-- CreateIndex
CREATE INDEX "Lead_convertedAt_idx" ON "Lead"("convertedAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
