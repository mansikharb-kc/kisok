-- Create onboarding_flags table (Flag model). Children cascade-delete with their pipeline.
-- Safe to run once; IF NOT EXISTS makes re-runs a no-op.

CREATE TABLE IF NOT EXISTS `onboarding_flags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pipeline_id` BIGINT UNSIGNED NOT NULL,
  `reason` TEXT NOT NULL,
  `stage` VARCHAR(50) NOT NULL,
  `is_resolved` BOOLEAN NOT NULL DEFAULT false,
  `resolved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `onboarding_flags_pipeline_id_idx` (`pipeline_id`),
  CONSTRAINT `onboarding_flags_pipeline_id_fkey` FOREIGN KEY (`pipeline_id`) REFERENCES `onboarding_pipelines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
