-- 1. Machine Centre: Remove unique constraint on code, keep only id unique
ALTER TABLE machine_centres DROP INDEX IF EXISTS code;

-- 2. Users table: Add machine_centre_name column and remove email (if exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS machine_centre_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE users DROP COLUMN IF EXISTS email;

-- 3. Production Routing: Add machine_centre_id and make style unique
ALTER TABLE production_routing_header ADD COLUMN IF NOT EXISTS machine_centre_id INT DEFAULT NULL;
ALTER TABLE production_routing_header ADD CONSTRAINT IF NOT EXISTS fk_routing_machine_centre 
    FOREIGN KEY (machine_centre_id) REFERENCES machine_centres(id);
ALTER TABLE production_routing_header ADD CONSTRAINT IF NOT EXISTS unique_style UNIQUE (style_id);

-- 4. Machine centres: Add unique constraint for name per work centre
ALTER TABLE machine_centres ADD CONSTRAINT IF NOT EXISTS unique_name_per_work_centre 
    UNIQUE (work_centre_id, name);

-- 5. Machine centres: Make machine_id unique
ALTER TABLE machine_centres ADD CONSTRAINT IF NOT EXISTS unique_machine_id UNIQUE (machine_id);

-- Update existing data to populate machine_centre_name in users table
UPDATE users u 
JOIN machine_centres mc ON u.machine_id = mc.machine_id 
SET u.machine_centre_name = mc.name 
WHERE u.machine_id IS NOT NULL AND u.machine_centre_name IS NULL;