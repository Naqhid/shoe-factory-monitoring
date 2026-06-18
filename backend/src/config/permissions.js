'use strict';

/** API capability keys derived from role menu assignments */
const CAPABILITIES = {
  LOGS_REPORTS: 'logs_reports',
  MISSED_ACTIONS_READ: 'missed_actions_read',
  PRODUCTION_ROUTING: 'production_routing',
  PRODUCTION_ROUTING_READ: 'production_routing_read',
  PRODUCTION_PLANNING: 'production_planning',
  TRACKER: 'tracker',
  REWORK: 'rework',
  LINE_SETUP: 'line_setup',
  MANUAL_ENTRY: 'manual_entry',
  MASTERS: 'masters',
  ADMIN: 'admin',
  ADMIN_USERS: 'admin_users',
  ADMIN_MONITORING: 'admin_monitoring',
  PRODUCTION_LOCK: 'production_lock',
};

/** Menu keys → API capabilities granted when that menu is allowed */
const MENU_CAPABILITY_MAP = {
  overview: [],
  reports: [CAPABILITIES.LOGS_REPORTS],
  missed_actions: [CAPABILITIES.LOGS_REPORTS],
  logs: [CAPABILITIES.LOGS_REPORTS],
  alert_center: [CAPABILITIES.LOGS_REPORTS],
  production_routing: [CAPABILITIES.PRODUCTION_ROUTING],
  production_planning: [CAPABILITIES.PRODUCTION_PLANNING, CAPABILITIES.PRODUCTION_ROUTING_READ],
  line_schedule: [CAPABILITIES.PRODUCTION_PLANNING, CAPABILITIES.PRODUCTION_ROUTING_READ],
  line_setup_form: [CAPABILITIES.LINE_SETUP, CAPABILITIES.PRODUCTION_LOCK],
  manual_production_entry: [CAPABILITIES.MANUAL_ENTRY],
  production_tracker: [CAPABILITIES.TRACKER],
  rework_rejection_tracker: [CAPABILITIES.REWORK],
  mobile: [],
  customers: [CAPABILITIES.MASTERS],
  groups: [CAPABILITIES.MASTERS],
  leather: [CAPABILITIES.MASTERS],
  styles: [CAPABILITIES.MASTERS],
  colors: [CAPABILITIES.MASTERS],
  work_centres: [CAPABILITIES.MASTERS],
  machine_centres: [CAPABILITIES.MASTERS],
  employees: [CAPABILITIES.MASTERS],
  users: [CAPABILITIES.ADMIN_USERS, CAPABILITIES.ADMIN],
  forms_master: [CAPABILITIES.ADMIN],
  user_rights: [CAPABILITIES.ADMIN],
  roles: [CAPABILITIES.ADMIN],
  monitoring: [CAPABILITIES.ADMIN_MONITORING],
};

/** Capabilities not tied to a sidebar menu */
const ROLE_EXTRA_CAPABILITIES = {
  'Machine Centre User': [CAPABILITIES.MISSED_ACTIONS_READ],
};

const ROLE_ALIASES = {
  administrator: 'Admin',
  admin: 'Admin',
  'line supervisor': 'Line Supervisor',
  'machine centre user': 'Machine Centre User',
  ied: 'IED',
  planner: 'Planner',
  'unit head': 'Unit Head',
  'production manager': 'Production Manager',
  production_manager: 'Production Manager',
  quality: 'Quality',
  'project monitor': 'Project Monitor',
};

function normalizeRoleName(role) {
  if (!role) return null;
  const cleaned = String(role).trim();
  if (ROLE_ALIASES[cleaned.toLowerCase()]) {
    return ROLE_ALIASES[cleaned.toLowerCase()];
  }
  return cleaned;
}

function matchesProductionManager(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'production manager' || v === 'production_manager' || v.includes('production manager');
}

function matchesQuality(value) {
  return String(value || '').trim().toLowerCase() === 'quality';
}

/**
 * Mirrors frontend getEffectiveRole — Unit Head logins mapped by code/name hints.
 */
function resolveEffectiveRoleName(user = {}) {
  const normalized = normalizeRoleName(user.role);
  if (normalized === 'Production Manager' || normalized === 'Quality') {
    return normalized;
  }
  if (normalized !== 'Unit Head') {
    return normalized;
  }
  const hints = [user.code, user.name].filter(Boolean).map((v) => String(v));
  if (hints.some(matchesProductionManager)) return 'Production Manager';
  if (hints.some(matchesQuality)) return 'Quality';
  return normalized;
}

function capabilitiesFromMenus(allowedMenus = [], roleName = null) {
  const caps = new Set();
  for (const menu of allowedMenus) {
    for (const cap of MENU_CAPABILITY_MAP[menu] || []) {
      caps.add(cap);
    }
  }
  for (const cap of ROLE_EXTRA_CAPABILITIES[roleName] || []) {
    caps.add(cap);
  }
  return caps;
}

function capabilitySatisfied(capability, heldCapabilities) {
  if (heldCapabilities.has(capability)) return true;
  if (capability === CAPABILITIES.PRODUCTION_ROUTING_READ) {
    return heldCapabilities.has(CAPABILITIES.PRODUCTION_ROUTING)
      || heldCapabilities.has(CAPABILITIES.PRODUCTION_ROUTING_READ);
  }
  if (capability === CAPABILITIES.MISSED_ACTIONS_READ) {
    return heldCapabilities.has(CAPABILITIES.MISSED_ACTIONS_READ)
      || heldCapabilities.has(CAPABILITIES.LOGS_REPORTS);
  }
  return false;
}

function hasAnyCapability(requiredCaps, heldCapabilities) {
  return requiredCaps.some((cap) => capabilitySatisfied(cap, heldCapabilities));
}

module.exports = {
  CAPABILITIES,
  MENU_CAPABILITY_MAP,
  ROLE_EXTRA_CAPABILITIES,
  normalizeRoleName,
  resolveEffectiveRoleName,
  capabilitiesFromMenus,
  capabilitySatisfied,
  hasAnyCapability,
};
