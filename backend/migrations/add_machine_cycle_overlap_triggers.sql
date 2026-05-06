-- Migration: Enforce non-overlapping finished cycles per machine at DB level
-- Run once:
--   mysql -u <user> -p <database_name> < migrations/add_machine_cycle_overlap_triggers.sql

-- Remove previous manual-only trigger if present
DROP TRIGGER IF EXISTS trg_block_manual_overlap_insert;

-- Remove/replace machine overlap triggers
DROP TRIGGER IF EXISTS trg_block_machine_cycle_overlap_insert;
DROP TRIGGER IF EXISTS trg_block_machine_cycle_overlap_update;

DELIMITER $$

CREATE TRIGGER trg_block_machine_cycle_overlap_insert
BEFORE INSERT ON machine_centre_production
FOR EACH ROW
BEGIN
  IF NEW.button_status = 2
     AND NEW.start_time IS NOT NULL
     AND NEW.finish_time IS NOT NULL
  THEN
    IF NEW.finish_time <= NEW.start_time THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'finish_time must be after start_time';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM machine_centre_production mcp
      WHERE mcp.machine_id = NEW.machine_id
        AND mcp.button_status = 2
        AND mcp.start_time IS NOT NULL
        AND mcp.finish_time IS NOT NULL
        AND mcp.start_time < NEW.finish_time
        AND mcp.finish_time > NEW.start_time
      LIMIT 1
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Overlapping finished cycle on same machine is not allowed';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_block_machine_cycle_overlap_update
BEFORE UPDATE ON machine_centre_production
FOR EACH ROW
BEGIN
  IF NEW.button_status = 2
     AND NEW.start_time IS NOT NULL
     AND NEW.finish_time IS NOT NULL
  THEN
    IF NEW.finish_time <= NEW.start_time THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'finish_time must be after start_time';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM machine_centre_production mcp
      WHERE mcp.machine_id = NEW.machine_id
        AND mcp.button_status = 2
        AND mcp.start_time IS NOT NULL
        AND mcp.finish_time IS NOT NULL
        AND mcp.id <> NEW.id
        AND mcp.start_time < NEW.finish_time
        AND mcp.finish_time > NEW.start_time
      LIMIT 1
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Overlapping finished cycle on same machine is not allowed';
    END IF;
  END IF;
END$$

DELIMITER ;
