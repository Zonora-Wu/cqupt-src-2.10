-- Knowledge and Skill are independent product domains.
-- Preserve historical Skill/Candidate rows for audit, but remove all active links.
UPDATE "AiProblemSession"
SET "status" = 'READY_REVIEW'
WHERE "status" = 'SKILL_CANDIDATE';

UPDATE "AiKnowledgeConversation"
SET "status" = 'READY_REVIEW'
WHERE "status" = 'SKILL_CANDIDATE';

UPDATE "AiKnowledgeEntry"
SET
  "promotedSkillId" = NULL,
  "status" = CASE WHEN "status" = 'PROMOTED_TO_SKILL' THEN 'APPROVED' ELSE "status" END;

UPDATE "AiSkill"
SET
  "sourceKnowledgeIds" = ARRAY[]::TEXT[],
  "sourceClusterIds" = ARRAY[]::TEXT[],
  "source" = CASE
    WHEN "source" IN ('ai-knowledge-lifecycle', 'admin-skill-candidate', 'skill-candidate') THEN 'legacy-detached-skill'
    ELSE "source"
  END
WHERE
  cardinality("sourceKnowledgeIds") > 0
  OR cardinality("sourceClusterIds") > 0
  OR "source" IN ('ai-knowledge-lifecycle', 'admin-skill-candidate', 'skill-candidate');
