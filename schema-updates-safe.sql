-- 1. Machine Centre: Remove unique constraint on code (ignore error if doesn't exist)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE table_schema = 'florence' AND table_name = 'machine_centres' AND index_name = 'code') > 0,
    'ALTER TABLE machine_centres DROP INDEX code',
    'SELECT "Index code does not exist" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Users table: Add machine_centre_name column (ignore error if exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_schema = 'florence' AND table_name = 'users' AND column_name = 'machine_centre_name') = 0,
    'ALTER TABLE users ADD COLUMN machine_centre_name VARCHAR(255) DEFAULT NULL',
    'SELECT "Column machine_centre_name already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Users table: Drop email column (ignore error if doesn't exist)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_schema = 'florence' AND table_name = 'users' AND column_name = 'email') > 0,
    'ALTER TABLE users DROP COLUMN email',
    'SELECT "Column email does not exist" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Production Routing: Add machine_centre_id column (ignore error if exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE table_schema = 'florence' AND table_name = 'production_routing_header' AND column_name = 'machine_centre_id') = 0,
    'ALTER TABLE production_routing_header ADD COLUMN machine_centre_id INT DEFAULT NULL',
    'SELECT "Column machine_centre_id already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Add foreign key constraint for machine_centre_id (ignore error if exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE table_schema = 'florence' AND table_name = 'production_routing_header' AND constraint_name = 'fk_routing_machine_centre') = 0,
    'ALTER TABLE production_routing_header ADD CONSTRAINT fk_routing_machine_centre FOREIGN KEY (machine_centre_id) REFERENCES machine_centres(id)',
    'SELECT "Foreign key fk_routing_machine_centre already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Make style unique in production routing (ignore error if exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE table_schema = 'florence' AND table_name = 'production_routing_header' AND index_name = 'unique_style') = 0,
    'ALTER TABLE production_routing_header ADD UNIQUE KEY unique_style (style_id)',
    'SELECT "Unique constraint unique_style already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Machine centres: Add unique constraint for name per work centre (ignore error if exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE table_schema = 'florence' AND table_name = 'machine_centres' AND index_name = 'unique_name_per_work_centre') = 0,
    'ALTER TABLE machine_centres ADD UNIQUE KEY unique_name_per_work_centre (work_centre_id, name)',
    'SELECT "Unique constraint unique_name_per_work_centre already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Machine centres: Make machine_id unique (ignore error if exists)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE table_schema = 'florence' AND table_name = 'machine_centres' AND index_name = 'unique_machine_id') = 0,
    'ALTER TABLE machine_centres ADD UNIQUE KEY unique_machine_id (machine_id)',
    'SELECT "Unique constraint unique_machine_id already exists" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. Update existing data to populate machine_centre_name in users table
UPDATE users u 
JOIN machine_centres mc ON u.machine_id = mc.machine_id 
SET u.machine_centre_name = mc.name 
WHERE u.machine_id IS NOT NULL AND (u.machine_centre_name IS NULL OR u.machine_centre_name = '');

SELECT "Schema updates completed successfully" as result;