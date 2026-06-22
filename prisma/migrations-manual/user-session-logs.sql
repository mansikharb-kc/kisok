-- Create user_session_logs table (UserSessionLog model) — login/session tracking.
-- Safe to run once; IF NOT EXISTS makes re-runs a no-op.
-- Note: username/fullName/role have no @map in schema, so column names are exact (incl. camelCase `fullName`).

CREATE TABLE IF NOT EXISTS `user_session_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `username` VARCHAR(120) NOT NULL,
  `fullName` VARCHAR(150) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `login_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `logout_time` DATETIME(3) NULL,
  `logout_type` VARCHAR(20) NULL,
  `last_active` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `user_session_logs_user_id_idx` (`user_id`),
  CONSTRAINT `user_session_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
