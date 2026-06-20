-- Add flow_steps (nullable JSON) to branch_programs (BranchProgram.flowSteps).
-- MySQL has no ADD COLUMN IF NOT EXISTS — if it already exists you'll get
-- "Duplicate column name 'flow_steps'"; that just means it's applied. Ignore.

ALTER TABLE `branch_programs`
  ADD COLUMN `flow_steps` JSON NULL;
