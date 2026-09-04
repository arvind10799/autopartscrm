UPDATE "ReplacementHistory"
SET "previousStatus" = 'AGREED'
WHERE "previousStatus"::text = 'APPROVED';

UPDATE "ReplacementHistory"
SET "nextStatus" = 'AGREED'
WHERE "nextStatus"::text = 'APPROVED';
