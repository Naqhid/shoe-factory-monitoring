-- Clear old mobile scan data
TRUNCATE TABLE prod_data;
TRUNCATE TABLE machine_centre_production;
TRUNCATE TABLE machine_centre_summary;
TRUNCATE TABLE mobile_sessions;

-- Optional: Clear pivot_data if it contains old test data
TRUNCATE TABLE pivot_data;

-- Verify tables are empty
SELECT 'prod_data' as table_name, COUNT(*) as record_count FROM prod_data
UNION ALL
SELECT 'machine_centre_production', COUNT(*) FROM machine_centre_production
UNION ALL
SELECT 'machine_centre_summary', COUNT(*) FROM machine_centre_summary
UNION ALL
SELECT 'mobile_sessions', COUNT(*) FROM mobile_sessions;