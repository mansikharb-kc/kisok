-- Collaboration/Deal model additions (additive, safe).
-- Seller: collaboration contact + classification fields.
ALTER TABLE sellers
  ADD COLUMN member_type VARCHAR(40) NULL,
  ADD COLUMN salesperson VARCHAR(120) NULL,
  ADD COLUMN spoc_name   VARCHAR(120) NULL,
  ADD COLUMN spoc_phone  VARCHAR(30)  NULL,
  ADD COLUMN spoc_email  VARCHAR(150) NULL;

-- SellerContract: dynamic HO-defined field values.
ALTER TABLE seller_contracts
  ADD COLUMN custom_fields JSON NULL;

-- Categories a collaboration (seller) covers.
CREATE TABLE IF NOT EXISTS seller_categories (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id   BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_seller_category (seller_id, category_id),
  KEY idx_sc_category (category_id),
  CONSTRAINT fk_sc_seller   FOREIGN KEY (seller_id)   REFERENCES sellers (id)    ON DELETE CASCADE,
  CONSTRAINT fk_sc_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- HO-defined custom form fields (rendered dynamically).
CREATE TABLE IF NOT EXISTS custom_field_defs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity        VARCHAR(40)  NOT NULL,
  label         VARCHAR(120) NOT NULL,
  code          VARCHAR(60)  NOT NULL,
  field_type    VARCHAR(20)  NOT NULL,
  options       JSON NULL,
  is_required   TINYINT(1)   NOT NULL DEFAULT 0,
  display_order INT          NOT NULL DEFAULT 0,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uniq_entity_code (entity, code),
  KEY idx_entity (entity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
