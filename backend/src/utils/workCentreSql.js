'use strict';

/** Active work centre — not soft-deleted and is_active = 1 */
const ACTIVE_WORK_CENTRE_WHERE = 'deleted_at IS NULL AND COALESCE(is_active, 1) = 1';

function activeWorkCentreWhere(alias = '') {
  const p = alias ? `${alias}.` : '';
  return `${p}deleted_at IS NULL AND COALESCE(${p}is_active, 1) = 1`;
}

module.exports = { ACTIVE_WORK_CENTRE_WHERE, activeWorkCentreWhere };
