-- seller_categories was originally created without created_at, but the SellerCategory
-- model expects it — caused "column created_at does not exist" on seller.create
-- (nested sellerCategories insert). Adding it.
-- MySQL has no ADD COLUMN IF NOT EXISTS — if it already exists you'll get
-- "Duplicate column name 'created_at'"; that just means it's applied. Ignore.

ALTER TABLE `seller_categories` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
