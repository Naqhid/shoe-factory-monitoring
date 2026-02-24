-- Migration: Add target_pairs column to machine_centre_app table
-- Run this if you have an existing database

ALTER TABLE machine_centre_app 
ADD COLUMN IF NOT EXISTS target_pairs INT DEFAULT 12 AFTER output_pairs;

-- Update pivot_data table to include target_pairs
ALTER TABLE pivot_data 
ADD COLUMN IF NOT EXISTS total_target_pairs INT DEFAULT 0 AFTER total_output_pairs;

-- Update existing records to have default target_pairs value
UPDATE machine_centre_app 
SET target_pairs = 12 
WHERE target_pairs IS NULL OR target_pairs = 0;

SELECT 'Migration completed successfully!' as status;
