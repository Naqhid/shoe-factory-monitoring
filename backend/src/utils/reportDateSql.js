'use strict';

/**
 * Inclusive calendar-date filter for DATE/DATETIME columns.
 * Uses half-open range so DATE columns match the full local day.
 */
function dateBetween(column, fromDate, toDate) {
    return {
        sql: `(${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY))`,
        params: [fromDate, toDate],
    };
}

/**
 * Join production_plan on work centre for the report's requested date range
 * (not tied to each row's prod_date, which can drift by one day vs the UI).
 */
function planJoinOnRequestedDates(fromDate, toDate) {
    return {
        sql: `LEFT JOIN production_plan pp ON pp.work_centre_id = mcp.work_centre_id AND pp.plan_date >= ? AND pp.plan_date <= ?`,
        params: [fromDate, toDate],
    };
}

module.exports = {
    dateBetween,
    planJoinOnRequestedDates,
};
