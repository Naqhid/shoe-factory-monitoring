-- Migration: Block manual/real cycle overlap at DB level
-- Run once: mysql -u root -p shoe_factory < migrations/add_manual_overlap_trigger.sql

DROP TRIGGER IF EXISTS trg_block_manual_overlap_insert;

DELIMITER $$

CREATE TRIGGER trg_block_manual_overlap_insert
BEFORE INSERT ON machine_centre_production
FOR EACH ROW
BEGIN
  IF NEW.button_status = 2 THEN

    -- Block real cycle insert if a manual entry overlaps
    IF (NEW.stoppage_reason IS NULL OR NEW.stoppage_reason NOT LIKE 'MANUAL:%') THEN
      IF EXISTS (
        SELECT 1 FROM machine_centre_production
        WHERE machine_id = NEW.machine_id
          AND emp_id = NEW.emp_id
          AND DATE(prod_date) = DATE(NEW.prod_date)
          AND button_status = 2
          AND stoppage_reason LIKE 'MANUAL:%'
          AND start_time < NEW.finish_time
          AND finish_time > NEW.start_time
        LIMIT 1
      ) THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'A manual entry already covers this time period for this machine and employee.';
      END IF;
    END IF;

    -- Block manual entry insert if a real finished cycle overlaps
    IF NEW.stoppage_reason LIKE 'MANUAL:%' THEN
      IF EXISTS (
        SELECT 1 FROM machine_centre_production
        WHERE machine_id = NEW.machine_id
          AND emp_id = NEW.emp_id
          AND DATE(prod_date) = DATE(NEW.prod_date)
          AND button_status = 2
          AND (stoppage_reason IS NULL OR stoppage_reason NOT LIKE 'MANUAL:%')
          AND start_time < NEW.finish_time
          AND finish_time > NEW.start_time
        LIMIT 1
      ) THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'A real production cycle already covers this time period for this machine and employee.';
      END IF;
    END IF;

  END IF;
END$$

DELIMITER ;
