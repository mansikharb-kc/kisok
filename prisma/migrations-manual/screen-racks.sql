-- A screen (mounted on a block) covers MULTIPLE racks of that block.
-- One rack belongs to at most one screen (unique location_node_id).
CREATE TABLE IF NOT EXISTS `screen_racks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `screen_id` BIGINT UNSIGNED NOT NULL,
  `location_node_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `screen_racks_location_node_id_key` (`location_node_id`),
  INDEX `screen_racks_screen_id_idx` (`screen_id`),
  CONSTRAINT `screen_racks_screen_id_fkey` FOREIGN KEY (`screen_id`) REFERENCES `screens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `screen_racks_location_node_id_fkey` FOREIGN KEY (`location_node_id`) REFERENCES `location_nodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
