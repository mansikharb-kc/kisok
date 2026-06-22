-- Run AFTER `prisma db push`.
-- Adds the generated column + unique index that enforces exactly ONE
-- UNIQUE copy per (brand_product, branch). MySQL ignores NULLs in unique
-- indexes, so any number of COPY copies (NULL) are allowed.

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = 'product_copies'
               AND column_name = 'is_master_flag');

SET @sql := IF(@col = 0,
  'ALTER TABLE product_copies
     ADD COLUMN is_master_flag TINYINT
       GENERATED ALWAYS AS (CASE WHEN copy_role = ''UNIQUE'' THEN 1 ELSE NULL END) STORED,
     ADD UNIQUE KEY uq_one_master (brand_product_id, branch_id, is_master_flag)',
  'SELECT "patch already applied" AS note');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
