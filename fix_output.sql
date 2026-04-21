-- Fix Total Output from 72 to 60 for Machine 01 on Apr 21, 2026
-- This removes the LAST finished cycle (12 pairs)

-- First, let's see all finished cycles for today
SELECT 
    id, 
    machine_id, 
    emp_id, 
    output_pairs, 
    start_time, 
    finish_time,
    button_status
FROM machine_centre_production 
WHERE machine_id = '01' 
    AND DATE(prod_date) = '2026-04-21' 
    AND button_status = 2
ORDER BY finish_time DESC;

-- To DELETE the most recent finished cycle (the one causing 72 instead of 60):
-- WARNING: Only run this if you're sure!
-- DELETE FROM machine_centre_production 
-- WHERE id = (
--     SELECT id FROM (
--         SELECT id 
--         FROM machine_centre_production 
--         WHERE machine_id = '01' 
--             AND DATE(prod_date) = '2026-04-21' 
--             AND button_status = 2
--         ORDER BY finish_time DESC 
--         LIMIT 1
--     ) AS tmp
-- );

-- After deletion, recalculate summary:
-- The summary should auto-update, but if not, run this:
-- INSERT INTO machine_centre_summary (...)
-- SELECT ... FROM machine_centre_production ...
-- (see backend code for exact query)
