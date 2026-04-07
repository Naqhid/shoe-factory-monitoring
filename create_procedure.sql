USE florence;

DROP TRIGGER IF EXISTS archive_old_summary_data;

DROP PROCEDURE IF EXISTS ArchiveSummaryData;

DELIMITER $$
CREATE PROCEDURE ArchiveSummaryData()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Archive old data (not today's)
    INSERT INTO machine_centre_summary_history 
    SELECT *, NOW() as archived_at 
    FROM machine_centre_summary 
    WHERE prod_date < CURDATE();
    
    -- Delete archived data from active table
    DELETE FROM machine_centre_summary 
    WHERE prod_date < CURDATE();
    
    COMMIT;
    
    SELECT CONCAT('Archived records older than today') as result;
END$$
DELIMITER ;