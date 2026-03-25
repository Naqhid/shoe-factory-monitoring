-- Fix duplicate names by making them unique
UPDATE machine_centres SET name = 'Elastic stitching 1' WHERE id = 3;
UPDATE machine_centres SET name = 'Elastic stitching 2' WHERE id = 8;
UPDATE machine_centres SET name = 'Folding 1' WHERE id = 4;
UPDATE machine_centres SET name = 'Folding 2' WHERE id = 9;

-- Verify the changes
SELECT id, work_centre_id, code, name, machine_id 
FROM machine_centres 
ORDER BY work_centre_id, name;