-- Seller-level custom field values (HO-defined fields filled during seller onboarding).
ALTER TABLE sellers ADD COLUMN custom_fields JSON NULL;
