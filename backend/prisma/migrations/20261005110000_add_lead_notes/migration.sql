ALTER TYPE "NoteEntityType" ADD VALUE IF NOT EXISTS 'LEAD';

ALTER TABLE "Note" ADD COLUMN "leadId" UUID;

ALTER TABLE "Note" ADD CONSTRAINT "Note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Note_leadId_idx" ON "Note"("leadId");
CREATE INDEX "Note_entityType_leadId_idx" ON "Note"("entityType", "leadId");
