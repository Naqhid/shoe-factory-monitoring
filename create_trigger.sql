USE florence;

DROP TRIGGER IF EXISTS archive_old_summary_data;

DELIMITER $$
CREATE TRIGGER archive_old_summary_data 
BEFORE INSERT ON machine_centre_summary
FOR EACH ROW
BEGIN
    INSERT INTO machine_centre_summary_history 
    SELECT *, NOW() as archived_at 
    FROM machine_centre_summary 
    WHERE prod_date < CURDATE();
    
    DELETE FROM machine_centre_summary 
    WHERE prod_date < CURDATE();
END$$
DELIMITER ;