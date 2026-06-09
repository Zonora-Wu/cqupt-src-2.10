ALTER TABLE "AiKnowledgeRevision"
  ADD COLUMN "version" INTEGER,
  ADD COLUMN "changeType" TEXT,
  ADD COLUMN "oldSnapshot" JSONB,
  ADD COLUMN "newSnapshot" JSONB,
  ADD COLUMN "diffSummary" TEXT,
  ADD COLUMN "editorType" TEXT NOT NULL DEFAULT 'ADMIN';

WITH numbered AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "knowledgeId" ORDER BY "createdAt", "id") AS revision_version
  FROM "AiKnowledgeRevision"
)
UPDATE "AiKnowledgeRevision" AS revision
SET
  "version" = numbered.revision_version,
  "changeType" = COALESCE(revision."changeType", 'LEGACY_REVIEW'),
  "changeReason" = COALESCE(revision."changeReason", '历史版本回填'),
  "oldSnapshot" = jsonb_build_object(
    'title', revision."title",
    'canonicalQuestion', revision."canonicalQuestion",
    'canonicalAnswer', revision."canonicalAnswer"
  ),
  "newSnapshot" = jsonb_build_object(
    'title', revision."title",
    'canonicalQuestion', revision."canonicalQuestion",
    'canonicalAnswer', revision."canonicalAnswer"
  ),
  "diffSummary" = COALESCE(revision."diffSummary", '历史版本回填')
FROM numbered
WHERE revision."id" = numbered."id";

ALTER TABLE "AiKnowledgeRevision"
  ALTER COLUMN "version" SET NOT NULL,
  ALTER COLUMN "changeType" SET NOT NULL,
  ALTER COLUMN "changeReason" SET NOT NULL,
  ALTER COLUMN "oldSnapshot" SET NOT NULL,
  ALTER COLUMN "newSnapshot" SET NOT NULL;

CREATE UNIQUE INDEX "AiKnowledgeRevision_knowledgeId_version_key" ON "AiKnowledgeRevision"("knowledgeId", "version");
