-- Create onboarding_pipelines and reminders tables (OnboardingPipeline / Reminder models).
-- Safe to run once; uses IF NOT EXISTS so re-running is a no-op for the tables.

CREATE TABLE IF NOT EXISTS `onboarding_pipelines` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `assignment_id` BIGINT UNSIGNED NOT NULL,
  `brand_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'INITIATION',
  `discussion_done` BOOLEAN NOT NULL DEFAULT false,
  `doc_attached` VARCHAR(255) NULL,
  `item_target` VARCHAR(255) NULL,
  `next_action_time` VARCHAR(100) NULL,
  `remarks` TEXT NULL,
  `date_to_revisit` VARCHAR(100) NULL,
  `received_date` DATE NULL,
  `vehicle_details` VARCHAR(255) NULL,
  `quantity_received` INT NULL,
  `box_qc` VARCHAR(100) NULL,
  `photograph_url` VARCHAR(255) NULL,
  `packing_list_doc` VARCHAR(255) NULL,
  `consignment_remarks` TEXT NULL,
  `exec_verified` BOOLEAN NOT NULL DEFAULT false,
  `ticket_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `onboarding_pipelines_ticket_id_key` (`ticket_id`),
  UNIQUE INDEX `onboarding_pipelines_assignment_id_brand_id_key` (`assignment_id`, `brand_id`),
  INDEX `onboarding_pipelines_brand_id_idx` (`brand_id`),
  CONSTRAINT `onboarding_pipelines_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `seller_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `onboarding_pipelines_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `onboarding_pipelines_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pipeline_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `date_to_revisit` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `reminders_pipeline_id_idx` (`pipeline_id`),
  INDEX `reminders_user_id_idx` (`user_id`),
  CONSTRAINT `reminders_pipeline_id_fkey` FOREIGN KEY (`pipeline_id`) REFERENCES `onboarding_pipelines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reminders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
