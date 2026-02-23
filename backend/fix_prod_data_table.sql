-- Add missing target_pairs column to prod_data table
ALTER TABLE prod_data ADD COLUMN IF NOT EXISTS target_pairs INT DEFAULT 0 AFTER output_pairs;

-- Verify column was added
DESCRIBE prod_data;
