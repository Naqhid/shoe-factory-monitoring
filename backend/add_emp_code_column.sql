-- Add emp_code column to mobile_sessions table
ALTER TABLE mobile_sessions ADD COLUMN emp_code VARCHAR(50) NULL AFTER emp_id;