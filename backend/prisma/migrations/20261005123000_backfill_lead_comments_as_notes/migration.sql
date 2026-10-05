INSERT INTO "Note" (
    "id",
    "content",
    "entityType",
    "authorId",
    "leadId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    btrim("Lead"."comments"),
    'LEAD'::"NoteEntityType",
    "Lead"."createdById",
    "Lead"."id",
    "Lead"."createdAt",
    "Lead"."createdAt"
FROM "Lead"
WHERE "Lead"."comments" IS NOT NULL
  AND btrim("Lead"."comments") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "Note"
    WHERE "Note"."entityType" = 'LEAD'::"NoteEntityType"
      AND "Note"."leadId" = "Lead"."id"
      AND "Note"."content" = btrim("Lead"."comments")
      AND "Note"."authorId" = "Lead"."createdById"
  );
