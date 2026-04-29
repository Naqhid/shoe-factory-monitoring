ALTER TABLE prod_data 
ADD COLUMN target_pairs INT DEFAULT 0 AFTER output_pairs,
ADD COLUMN stoppage_reason VARCHAR(255) NULL AFTER actual_time;
