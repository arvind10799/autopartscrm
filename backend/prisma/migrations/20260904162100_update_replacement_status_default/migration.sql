ALTER TABLE "ReplacementRequest" ALTER COLUMN "replacementStatus" DROP DEFAULT;

UPDATE "ReplacementRequest"
SET "replacementStatus" = 'AGREED'
WHERE "replacementStatus" = 'APPROVED';

ALTER TABLE "ReplacementRequest"
  ALTER COLUMN "replacementStatus" SET DEFAULT 'WAITING_YARD_RESPONSE';
