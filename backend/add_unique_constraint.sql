-- Add unique constraint to prevent duplicate records for same machine/date
ALTER TABLE machine_centre_production 
ADD UNIQUE KEY unique_machine_date (machine_id, prod_date, emp_id);
