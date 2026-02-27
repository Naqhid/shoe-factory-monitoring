-- Remove unique constraint to allow multiple records per day
ALTER TABLE machine_centre_production 
DROP INDEX unique_machine_date;
