-- ============================================================
-- MES-style WIP Daily State Table
-- Tracks Opening WIP, Today's Input (from Heel Grip Machine),
-- and Current/Closing WIP per work centre per day.
--
-- WIP Formula: Current WIP = Opening WIP + Input - Output
-- Input source: Heel Grip Machine (machine_id = '03')
-- Output source: End-of-line machine (existing logic, unchanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS wip_daily_state (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    work_centre_id  INT NOT NULL,
    state_date      DATE NOT NULL,
    opening_wip     INT NOT NULL DEFAULT 0,   -- Carried forward from previous day's closing WIP
    today_input     INT NOT NULL DEFAULT 0,   -- Cumulative input from Heel Grip Machine today
    current_wip     INT NOT NULL DEFAULT 0,   -- opening_wip + today_input - today_output (live)
    closing_wip     INT NOT NULL DEFAULT 0,   -- Snapshot at end of day (= current_wip at EOD)
    is_closed       TINYINT(1) NOT NULL DEFAULT 0, -- 1 = day has been closed/finalised
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wip_wc_date (work_centre_id, state_date),
    CONSTRAINT fk_wip_work_centre FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial opening WIP for Line 3 (work_centre_id = 3) as per business requirement
-- Opening WIP starts at 130 on the first day this feature goes live.
-- Adjust the date and work_centre_id to match your production environment.
-- INSERT INTO wip_daily_state (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip)
-- VALUES (3, CURDATE(), 130, 0, 130, 0)
-- ON DUPLICATE KEY UPDATE opening_wip = VALUES(opening_wip);
