CREATE TYPE "WebsiteLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED', 'CONVERTED');
ALTER TYPE "NoteEntityType" ADD VALUE 'WEBSITE_LEAD';

CREATE TABLE "WebsiteLead" (
    "id" UUID NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "sourceFormId" VARCHAR(80) NOT NULL,
    "sourcePageUrl" VARCHAR(1000),
    "externalSubmissionId" VARCHAR(120) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "customerName" VARCHAR(160),
    "customerPhone" VARCHAR(50),
    "customerEmail" VARCHAR(160),
    "state" VARCHAR(80),
    "zipCode" VARCHAR(20),
    "vehicleYear" VARCHAR(10),
    "vehicleMake" VARCHAR(80),
    "vehicleModel" VARCHAR(80),
    "vin" VARCHAR(40),
    "partRequested" VARCHAR(255),
    "message" TEXT,
    "smsOptIn" BOOLEAN,
    "status" "WebsiteLeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" UUID,
    "convertedLeadId" UUID,
    "convertedById" UUID,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebsiteLead_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Note" ADD COLUMN "websiteLeadId" UUID;
CREATE UNIQUE INDEX "WebsiteLead_source_externalSubmissionId_key" ON "WebsiteLead"("source", "externalSubmissionId");
CREATE UNIQUE INDEX "WebsiteLead_convertedLeadId_key" ON "WebsiteLead"("convertedLeadId");
CREATE INDEX "WebsiteLead_status_submittedAt_idx" ON "WebsiteLead"("status", "submittedAt");
CREATE INDEX "WebsiteLead_assignedToId_submittedAt_idx" ON "WebsiteLead"("assignedToId", "submittedAt");
CREATE INDEX "WebsiteLead_submittedAt_idx" ON "WebsiteLead"("submittedAt");
CREATE INDEX "Note_websiteLeadId_idx" ON "Note"("websiteLeadId");

ALTER TABLE "WebsiteLead" ADD CONSTRAINT "WebsiteLead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsiteLead" ADD CONSTRAINT "WebsiteLead_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsiteLead" ADD CONSTRAINT "WebsiteLead_convertedLeadId_fkey" FOREIGN KEY ("convertedLeadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_websiteLeadId_fkey" FOREIGN KEY ("websiteLeadId") REFERENCES "WebsiteLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
