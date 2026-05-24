const db = require('../../config/database');

const ALLOWED = new Set(['mins_6_prs_box', 'mins_12_prs_box']);

let cachedColumn = null;
let cachedPairsPerBin = null;

/**
 * Resolves routing standard-time column (migrated from mins_12_prs_box → mins_6_prs_box).
 */
async function getRoutingMinsColumnName() {
  if (cachedColumn) return cachedColumn;
  const [rows] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'production_routing_lines'
      AND COLUMN_NAME IN ('mins_6_prs_box', 'mins_12_prs_box')
    ORDER BY FIELD(COLUMN_NAME, 'mins_6_prs_box', 'mins_12_prs_box')
  `);
  const col = rows[0]?.COLUMN_NAME;
  cachedColumn = ALLOWED.has(col) ? col : 'mins_6_prs_box';
  cachedPairsPerBin = cachedColumn === 'mins_6_prs_box' ? 6 : 12;
  return cachedColumn;
}

async function getPairsPerRoutingBin() {
  if (cachedPairsPerBin) return cachedPairsPerBin;
  await getRoutingMinsColumnName();
  return cachedPairsPerBin;
}

/** Qualified column for SQL, e.g. prl.mins_6_prs_box */
async function getRoutingMinsSqlExpr(tableAlias = 'prl') {
  const col = await getRoutingMinsColumnName();
  return `${tableAlias}.${col}`;
}

module.exports = {
  getRoutingMinsColumnName,
  getPairsPerRoutingBin,
  getRoutingMinsSqlExpr,
};
