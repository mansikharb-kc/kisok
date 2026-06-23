-- Allow a screen to exist without a block (created on RMS Screens, mapped to a block later on Blocks page).
ALTER TABLE `screens` MODIFY COLUMN `location_node_id` BIGINT UNSIGNED NULL;
