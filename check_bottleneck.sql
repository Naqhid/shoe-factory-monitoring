SELECT p.machine_id, mc.name, p.button_status, p.output_pairs, p.start_time, p.finish_time
FROM machine_centre_production p
JOIN machine_centres mc ON mc.machine_id = p.machine_id
WHERE p.work_centre_id = 3 AND DATE(p.prod_date) = CURDATE()
ORDER BY p.machine_id;
