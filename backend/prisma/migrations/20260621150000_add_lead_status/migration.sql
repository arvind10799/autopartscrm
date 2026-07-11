CREATE TYPE "LeadStatus" AS ENUM (
  'PROSPECT',
  'CALL_BACK_LATER',
  'NOT_INTERESTED',
  'NEEDS_LOCALLY'
);

ALTER TABLE "Lead"
ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'PROSPECT';

CREATE INDEX "Lead_status_idx" ON "Lead"("status");
