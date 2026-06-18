-- Onboarding progress status per seller-program assignment (OB Exec updates).
ALTER TABLE `seller_assignments`
  ADD COLUMN `onboarding_status` VARCHAR(20) NOT NULL DEFAULT 'yet_to_start';
