-- Track who created a brand, so the creator (e.g. an Onboarding Lead who adds a brand
-- during seller onboarding) can edit their own brand. If it already exists you'll get
-- "Duplicate column name" — ignore.
ALTER TABLE `brands` ADD COLUMN `created_by_user_id` BIGINT UNSIGNED NULL;
