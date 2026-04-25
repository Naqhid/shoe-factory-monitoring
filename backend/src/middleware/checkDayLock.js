const db = require('../../config/database');

/**
 * Middleware factory — blocks mutating requests if the production day is locked.
 * Usage: checkDayLock('production_date', 'work_centre_id')
 * Field names are the body/query keys that carry the date and work_centre_id.
 */
function checkDayLock(dateField = 'production_date', wcField = 'work_centre_id') {
  return async (req, res, next) => {
    try {
      const rawDate = req.body[dateField] || req.query[dateField];
      const wcId  = req.body[wcField]  || req.query[wcField];
      if (!rawDate || !wcId) return next(); // can't check — let controller validate

      const dateValue = String(rawDate).trim();
      const date = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue.split(' ')[0];

      const [rows] = await db.execute(
        'SELECT id FROM production_day_locks WHERE lock_date = ? AND work_centre_id = ?',
        [date, wcId]
      );
      if (rows.length > 0) {
        return res.status(423).json({
          success: false,
          error: `Production for ${date} is locked and cannot be modified. Contact a supervisor to unlock.`
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = checkDayLock;
