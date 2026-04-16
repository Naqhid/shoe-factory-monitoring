-- Add unique constraint to prevent duplicate alerts
ALTER TABLE production_alerts 
ADD UNIQUE KEY uniq_alert (alert_type, work_centre_id, machine_id, alert_date);
