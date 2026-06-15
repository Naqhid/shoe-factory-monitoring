'use strict';

const pool = require('../../config/database');
const logger = require('../utils/logger');
const { CANONICAL_ROLES, filterHiddenMenus } = require('../config/roleDefaults');
const {
  resolveEffectiveRoleName,
  capabilitiesFromMenus,
  hasAnyCapability,
} = require('../config/permissions');

let roleCache = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

function parseAllowedMenus(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getCanonicalFallback(roleName) {
  return CANONICAL_ROLES.find((r) => r.role_name === roleName) || null;
}

async function loadRoleCache(force = false) {
  const now = Date.now();
  if (!force && roleCache && now - cacheLoadedAt < CACHE_TTL_MS) {
    return roleCache;
  }
  const [rows] = await pool.query('SELECT role_name, default_route, allowed_menus FROM roles');
  const map = new Map();
  for (const row of rows) {
    map.set(row.role_name, {
      role_name: row.role_name,
      default_route: row.default_route || '/overview',
      allowed_menus: parseAllowedMenus(row.allowed_menus),
    });
  }
  roleCache = map;
  cacheLoadedAt = now;
  return roleCache;
}

function invalidateCache() {
  roleCache = null;
  cacheLoadedAt = 0;
}

async function getRoleRecord(roleName) {
  const cache = await loadRoleCache();
  const fromDb = cache.get(roleName);
  if (fromDb) return fromDb;
  const fallback = getCanonicalFallback(roleName);
  if (fallback) {
    return {
      role_name: fallback.role_name,
      default_route: fallback.default_route,
      allowed_menus: [...fallback.allowed_menus],
    };
  }
  return null;
}

let lineScheduleMenuMigrationPromise = null;

function ensureLineScheduleMenuMigration() {
  if (!lineScheduleMenuMigrationPromise) {
    lineScheduleMenuMigrationPromise = runOneTimeMigration('menu_line_schedule_v1', async () => {
      await addMenusToRole('Admin', ['line_schedule']);
      await addMenusToRole('Planner', ['line_schedule']);
    });
  }
  return lineScheduleMenuMigrationPromise;
}

async function getPermissionsForUser(user = {}) {
  await ensureLineScheduleMenuMigration();

  const effectiveRole = resolveEffectiveRoleName(user);
  const record = effectiveRole ? await getRoleRecord(effectiveRole) : null;
  const fallback = effectiveRole ? getCanonicalFallback(effectiveRole) : null;
  const allowed_menus = filterHiddenMenus(
    record?.allowed_menus?.length
      ? record.allowed_menus
      : (fallback?.allowed_menus || [])
  );
  const default_route = record?.default_route || fallback?.default_route || '/overview';
  const capabilities = capabilitiesFromMenus(allowed_menus, effectiveRole);
  return {
    effective_role: effectiveRole,
    default_route,
    allowed_menus,
    capabilities: [...capabilities],
  };
}

async function userHasAnyCapability(user, requiredCaps) {
  if (!requiredCaps?.length) return true;
  const perms = await getPermissionsForUser(user);
  const held = new Set(perms.capabilities);
  return hasAnyCapability(requiredCaps, held);
}

async function ensureRolesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT NOT NULL AUTO_INCREMENT,
      role_name VARCHAR(100) NOT NULL,
      default_route VARCHAR(255) NOT NULL,
      allowed_menus JSON NOT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY role_name (role_name)
    )
  `);
}

async function bootstrapCanonicalRoles() {
  await ensureRolesTable();
  for (const seed of CANONICAL_ROLES) {
    const menusJson = JSON.stringify(seed.allowed_menus);
    const [existing] = await pool.query(
      'SELECT id, allowed_menus FROM roles WHERE role_name = ? LIMIT 1',
      [seed.role_name]
    );
    if (!existing.length) {
      await pool.query(
        'INSERT INTO roles (role_name, default_route, allowed_menus) VALUES (?, ?, ?)',
        [seed.role_name, seed.default_route, menusJson]
      );
      logger.info(`Seeded role: ${seed.role_name}`);
      continue;
    }
    const currentMenus = parseAllowedMenus(existing[0].allowed_menus);
    if (!currentMenus.length) {
      await pool.query(
        'UPDATE roles SET default_route = ?, allowed_menus = ? WHERE role_name = ?',
        [seed.default_route, menusJson, seed.role_name]
      );
      logger.info(`Repaired empty menus for role: ${seed.role_name}`);
    }
  }
  invalidateCache();
}

function mergeMenus(currentMenus, menusToAdd) {
  const merged = [...currentMenus];
  let changed = false;
  for (const menu of menusToAdd) {
    if (!merged.includes(menu)) {
      merged.push(menu);
      changed = true;
    }
  }
  return { merged, changed };
}

async function addMenusToRole(roleName, menusToAdd) {
  if (!menusToAdd?.length) return false;
  await ensureRolesTable();
  const [rows] = await pool.query(
    'SELECT allowed_menus FROM roles WHERE role_name = ? LIMIT 1',
    [roleName]
  );
  if (!rows.length) return false;
  const currentMenus = parseAllowedMenus(rows[0].allowed_menus);
  const { merged, changed } = mergeMenus(currentMenus, menusToAdd);
  if (!changed) return false;
  await pool.query(
    'UPDATE roles SET allowed_menus = ? WHERE role_name = ?',
    [JSON.stringify(merged), roleName]
  );
  invalidateCache();
  logger.info(`Added menus [${menusToAdd.join(', ')}] to role: ${roleName}`);
  return true;
}

async function ensureRoleDefaultsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_defaults (
      role_name VARCHAR(100) NOT NULL,
      default_route VARCHAR(255) NOT NULL,
      allowed_menus JSON NOT NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (role_name)
    )
  `);
}

function menusToJson(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(parseAllowedMenus(value));
}

/**
 * Copy live roles → role_defaults (admin "Save as defaults").
 */
async function snapshotRolesAsDefaults() {
  await ensureRolesTable();
  await ensureRoleDefaultsTable();
  const [roles] = await pool.query('SELECT role_name, default_route, allowed_menus FROM roles ORDER BY role_name');
  if (!roles.length) {
    return { count: 0 };
  }
  await pool.query('DELETE FROM role_defaults');
  for (const row of roles) {
    await pool.query(
      'INSERT INTO role_defaults (role_name, default_route, allowed_menus) VALUES (?, ?, ?)',
      [row.role_name, row.default_route, menusToJson(row.allowed_menus)]
    );
  }
  logger.info(`Saved ${roles.length} role(s) as factory defaults snapshot`);
  return { count: roles.length };
}

/**
 * On first run: if no snapshot exists yet, capture current roles as defaults.
 */
async function bootstrapRoleDefaultsSnapshot() {
  await ensureRoleDefaultsTable();
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM role_defaults');
  if (Number(rows[0]?.c || 0) > 0) {
    return;
  }
  const result = await snapshotRolesAsDefaults();
  if (result.count > 0) {
    logger.info(`Initialized role_defaults from ${result.count} existing role(s)`);
  }
}

/**
 * Restore live roles from role_defaults ("Restore defaults" button).
 */
async function ensureAppMetaTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(100) NOT NULL,
      meta_value VARCHAR(500) NOT NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (meta_key)
    )
  `);
}

async function runOneTimeMigration(metaKey, fn) {
  await ensureAppMetaTable();
  const [rows] = await pool.query(
    'SELECT meta_key FROM app_meta WHERE meta_key = ? LIMIT 1',
    [metaKey]
  );
  if (rows.length) return false;
  await fn();
  await pool.query(
    'INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?)',
    [metaKey, 'done']
  );
  return true;
}

async function restoreRolesFromDefaults() {
  await ensureRolesTable();
  await ensureRoleDefaultsTable();
  const [defaults] = await pool.query(
    'SELECT role_name, default_route, allowed_menus FROM role_defaults ORDER BY role_name'
  );
  if (!defaults.length) {
    throw Object.assign(
      new Error('No saved role defaults found. Use "Save as defaults" after configuring roles.'),
      { status: 400 }
    );
  }
  for (const row of defaults) {
    const menusJson = menusToJson(row.allowed_menus);
    const [existing] = await pool.query(
      'SELECT id FROM roles WHERE role_name = ? LIMIT 1',
      [row.role_name]
    );
    if (existing.length) {
      await pool.query(
        'UPDATE roles SET default_route = ?, allowed_menus = ? WHERE role_name = ?',
        [row.default_route, menusJson, row.role_name]
      );
    } else {
      await pool.query(
        'INSERT INTO roles (role_name, default_route, allowed_menus) VALUES (?, ?, ?)',
        [row.role_name, row.default_route, menusJson]
      );
    }
  }
  invalidateCache();
  return { count: defaults.length };
}

module.exports = {
  loadRoleCache,
  invalidateCache,
  getRoleRecord,
  getPermissionsForUser,
  userHasAnyCapability,
  bootstrapCanonicalRoles,
  bootstrapRoleDefaultsSnapshot,
  snapshotRolesAsDefaults,
  restoreRolesFromDefaults,
  addMenusToRole,
  mergeMenus,
  runOneTimeMigration,
};
