'use strict';

/**
 * Canonical role definitions — seeded into `roles` table on startup when missing.
 * After bootstrap, edit access via Roles master (DB is source of truth).
 */
const HIDDEN_MENU_KEYS = new Set(['forms_master', 'user_rights']);

const CANONICAL_ROLES = [
  {
    role_name: 'Admin',
    default_route: '/overview',
    allowed_menus: [
      'overview', 'reports', 'missed_actions', 'logs', 'alert_center',
      'production_routing', 'production_planning', 'line_schedule', 'line_setup_form', 'manual_production_entry',
      'production_tracker', 'rework_rejection_tracker', 'mobile',
      'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees',
      'users', 'roles', 'monitoring',
    ],
  },
  {
    role_name: 'Line Supervisor',
    default_route: '/line_setup_form',
    allowed_menus: [
      'overview', 'line_setup_form', 'production_tracker', 'rework_rejection_tracker',
      'reports', 'missed_actions', 'logs', 'alert_center',
    ],
  },
  {
    role_name: 'Machine Centre User',
    default_route: '/mobile',
    allowed_menus: ['mobile', 'line1', 'line2'],
  },
  {
    role_name: 'IED',
    default_route: '/production_tracker',
    allowed_menus: [
      'overview', 'production_routing', 'production_tracker',
      'reports', 'missed_actions', 'logs', 'alert_center',
    ],
  },
  {
    role_name: 'Planner',
    default_route: '/production_planning',
    allowed_menus: [
      'overview', 'production_planning', 'line_schedule', 'production_tracker',
      'reports', 'missed_actions', 'logs', 'alert_center',
      'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees',
    ],
  },
  {
    role_name: 'Unit Head',
    default_route: '/overview',
    allowed_menus: ['overview', 'production_tracker', 'reports', 'missed_actions', 'logs', 'alert_center'],
  },
  {
    role_name: 'Production Manager',
    default_route: '/production_tracker',
    allowed_menus: ['production_tracker', 'missed_actions', 'alert_center'],
  },
  {
    role_name: 'Quality',
    default_route: '/production_tracker',
    allowed_menus: ['production_tracker', 'rework_rejection_tracker', 'missed_actions', 'alert_center'],
  },
  {
    role_name: 'Project Monitor',
    default_route: '/production_tracker',
    allowed_menus: [
      'overview', 'production_tracker', 'manual_production_entry',
      'reports', 'missed_actions', 'logs', 'alert_center',
      'production_routing', 'production_planning', 'line_schedule', 'line_setup_form',
      'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees',
    ],
  },
];

const ALL_MENU_DEFINITIONS = [
  { key: 'overview', label: 'TV Dashboard' },
  { key: 'reports', label: 'Reports' },
  { key: 'missed_actions', label: 'Missed Actions' },
  { key: 'logs', label: 'Login Logs' },
  { key: 'alert_center', label: 'Alert Center' },
  { key: 'production_routing', label: 'Production Routing' },
  { key: 'production_planning', label: 'Production Planning' },
  { key: 'line_schedule', label: 'Line Schedule' },
  { key: 'line_setup_form', label: 'Line Setup Form' },
  { key: 'manual_production_entry', label: 'Manual Production Entry' },
  { key: 'production_tracker', label: 'Production Tracker' },
  { key: 'rework_rejection_tracker', label: 'Rework / Rejection Tracker' },
  { key: 'mobile', label: 'Line Monitor' },
  { key: 'customers', label: 'Customer' },
  { key: 'groups', label: 'Group' },
  { key: 'leather', label: 'Leather' },
  { key: 'styles', label: 'Style' },
  { key: 'colors', label: 'Color' },
  { key: 'work_centres', label: 'Work Centre' },
  { key: 'machine_centres', label: 'Machine Centre' },
  { key: 'employees', label: 'Employee' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'monitoring', label: 'Monitoring' },
].filter((item) => !HIDDEN_MENU_KEYS.has(item.key));

function filterHiddenMenus(menus) {
  return (menus || []).filter((key) => !HIDDEN_MENU_KEYS.has(key));
}

module.exports = {
  CANONICAL_ROLES,
  ALL_MENU_DEFINITIONS,
  HIDDEN_MENU_KEYS,
  filterHiddenMenus,
};
