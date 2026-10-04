UPDATE "Lead"
SET "leadDate" = "leadDate" + INTERVAL '12 hours'
WHERE "leadDate"::time = TIME '00:00:00';
