const db = require('../../config/database');
const logger = require('./logger');

/**
 * Runs a callback inside a DB transaction.
 * Automatically commits on success, rolls back on any error.
 *
 * Usage:
 *   const result = await withTransaction(async (conn) => {
 *     await conn.execute('INSERT ...', [...]);
 *     await conn.execute('UPDATE ...', [...]);
 *     return { id: 1 };
 *   });
 *
 * For operations that need to see their own changes within the transaction
 * (e.g., INSERT then SELECT), use isolationLevel: 'READ COMMITTED':
 *   const result = await withTransaction(async (conn) => { ... }, { isolationLevel: 'READ COMMITTED' });
 */
const withTransaction = async (callback, options = {}) => {
  const connection = await db.getConnection();
  
  // Set isolation level if specified (e.g., 'READ COMMITTED' to see own changes)
  if (options.isolationLevel) {
    await connection.execute(`SET SESSION TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
  }
  
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.warn(`Transaction rolled back: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Integrity check helpers — throw with a clear message if check fails.
 * These run inside the transaction so any failure triggers rollback.
 */
const assertExists = async (conn, table, id, label) => {
  const [rows] = await conn.execute(`SELECT id FROM ${table} WHERE id = ?`, [id]);
  if (rows.length === 0) throw Object.assign(new Error(`${label} not found`), { status: 404 });
};

const assertNotReferenced = async (conn, table, field, value, label) => {
  const [rows] = await conn.execute(`SELECT id FROM ${table} WHERE ${field} = ? LIMIT 1`, [value]);
  if (rows.length > 0) throw Object.assign(new Error(`Cannot delete: ${label} is still in use`), { status: 400 });
};

module.exports = { withTransaction, assertExists, assertNotReferenced };
