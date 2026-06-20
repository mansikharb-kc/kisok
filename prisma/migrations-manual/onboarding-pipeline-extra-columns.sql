-- Add columns introduced after the original onboarding_pipelines migration
-- (initiation requirement checkboxes + step 3/4 verification fields).
-- NOTE: MySQL has no ADD COLUMN IF NOT EXISTS — if a column already exists this
-- errors with "Duplicate column name"; that just means it was already applied. Ignore and continue.

ALTER TABLE `onboarding_pipelines`
  ADD COLUMN `req_space_and_rack` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `req_data` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `req_sample` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `req_kt` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `data_pending_resolved` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `sticker_pasted` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `placed_in_rack` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `verification_photo` VARCHAR(255) NULL;
