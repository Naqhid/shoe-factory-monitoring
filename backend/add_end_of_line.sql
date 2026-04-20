-- Add is_end_of_line column to machine_centres table
ALTER TABLE machine_centres 
ADD COLUMN is_end_of_line TINYINT(1) DEFAULT 0 COMMENT '1 if this is the final inspection/end of line machine';

-- Set Machine 07 (Final Inspection) as end of line for Line 2A (work_centre_id = 5)
-- First, let's check what we have
SELECT id, work_centre_id, code, name, machine_id 
FROM machine_centres 
WHERE machine_id = '07' OR (work_centre_id = 5 AND name LIKE '%Final%' OR name LIKE '%Inspection%');

-- Update Machine 07 to be end of line
UPDATE machine_centres 
SET is_end_of_line = 1 
WHERE machine_id = '07';

-- Verify
SELECT id, work_centre_id, code, name, machine_id, is_end_of_line 
FROM machine_centres 
WHERE is_end_of_line = 1 OR machine_id = '07';
