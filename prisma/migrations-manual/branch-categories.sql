-- Create branch_categories table (BranchCategory model).
-- Safe to run once; IF NOT EXISTS makes re-runs a no-op.

CREATE TABLE IF NOT EXISTS `branch_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` BIGINT UNSIGNED NOT NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `branch_categories_branch_id_category_id_key` (`branch_id`, `category_id`),
  INDEX `branch_categories_category_id_idx` (`category_id`),
  CONSTRAINT `branch_categories_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `branch_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
