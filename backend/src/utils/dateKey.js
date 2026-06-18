'use strict';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Server-local calendar date YYYY-MM-DD. */
function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateKey(value) {
  if (!value) return null;
  const part = String(value).trim().split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

module.exports = {
  localDateKey,
  parseDateKey,
};
