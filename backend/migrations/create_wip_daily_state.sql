-- ============================================================
-- MES-style WIP Daily State Table
-- Tracks Opening WIP, Today's Input (from line input machine, e.g. 01),
-- and Current/Closing WIP per work centre per day.
--
-- WIP Formula: Current WIP = Opening WIP + Input - Output
-- Input source: line input machine (machine_centres name contains "(Input)", e.g. 01)
-- Output source: End-of-line machine (existing logic, unchanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS wip_daily_state (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    work_centre_id  INT NOT NULL,
    state_date      DATE NOT NULL,
    opening_wip     INT NOT NULL DEFAULT 0,   -- Carried forward from previous day's closing WIP
    today_input     INT NOT NULL DEFAULT 0,   -- Cumulative input from line input machine today
    current_wip     INT NOT NULL DEFAULT 0,   -- opening_wip + today_input - today_output (live)
    closing_wip     INT NOT NULL DEFAULT 0,   -- Snapshot at end of day (= current_wip at EOD)
    is_closed       TINYINT(1) NOT NULL DEFAULT 0, -- 1 = day has been closed/finalised
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wip_wc_date (work_centre_id, state_date),
    CONSTRAINT fk_wip_work_centre FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed starting inventory when enabling WIP (one row per line; adjust ids/date):
-- Line 3 = work_centre_id 5 in production DB.
-- INSERT INTO wip_daily_state (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed)
-- VALUES (5, CURDATE(), 130, 0, 130, 0, 0)
-- ON DUPLICATE KEY UPDATE opening_wip = VALUES(opening_wip), current_wip = VALUES(current_wip);
