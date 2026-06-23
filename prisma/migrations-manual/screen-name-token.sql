-- Add name + token to screens (RMS screen binding: token powers the kiosk URL /rms/screen/<token>).
-- Safe additive; if columns already exist you'll get "Duplicate column name" — ignore.

ALTER TABLE `screens`
  ADD COLUMN `name` VARCHAR(120) NULL,
  ADD COLUMN `token` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `screens_token_key` ON `screens` (`token`);
