-- The original AI runtime migration was applied to some environments before
-- GLOBAL was added to its AiModelPurpose definition.
ALTER TYPE "AiModelPurpose" ADD VALUE IF NOT EXISTS 'GLOBAL' BEFORE 'USER_INTERACTIVE';
