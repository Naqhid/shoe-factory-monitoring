-- Check for duplicate machine centre names per work centre
SELECT work_centre_id, name, COUNT(*) as count 
FROM machine_centres 
GROUP BY work_centre_id, name 
HAVING COUNT(*) > 1;

-- Show all machine centres to see the duplicates
SELECT id, work_centre_id, code, name, machine_id 
FROM machine_centres 
ORDER BY work_centre_id, name;