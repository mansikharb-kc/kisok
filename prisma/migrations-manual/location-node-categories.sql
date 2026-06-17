CREATE TABLE IF NOT EXISTS location_node_categories (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_node_id BIGINT UNSIGNED NOT NULL,
  category_id      BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_node_category (location_node_id, category_id),
  KEY idx_lnc_category (category_id),
  CONSTRAINT fk_lnc_node FOREIGN KEY (location_node_id) REFERENCES location_nodes (id) ON DELETE CASCADE,
  CONSTRAINT fk_lnc_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
