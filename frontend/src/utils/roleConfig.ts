// Role-based menu configuration — runtime data comes from DB via login (/api/auth/session).
export type UserRole =
  | 'Admin'
  | 'Line Supervisor'
  | 'Machine Centre User'
  | 'IED'
  | 'Planner'
  | 'Unit Head'
  | 'Production Manager'
  | 'Quality'
  | 'Project Monitor';

export interface UserSession {
  role?: string | null;
  name?: string | null;
  code?: string | null;
  machine_id?: string | null;
  effective_role?: string | null;
  default_route?: string | null;
  allowed_menus?: string[] | null;
}

export interface RoleConfig {
  defaultRoute: string;
  allowedMenus: string[];
}

/** Menus kept in codebase but hidden from navigation and role assignment (unused legacy). */
export const HIDDEN_MENU_KEYS = ['forms_master', 'user_rights'] as const;

/** Fallback when DB role row is missing (offline / migration). Kept in sync with backend roleDefaults.js */
export const roleConfigs: Record<UserRole, RoleConfig> = {
  'Admin': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'reports', 'missed_actions', 'logs', 'alert_center', 'production_routing', 'production_planning', 'line_schedule', 'line_setup_form', 'manual_production_entry', 'production_tracker', 'rework_rejection_tracker', 'mobile', 'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees', 'users', 'roles', 'monitoring']
  },
  'Line Supervisor': {
    defaultRoute: '/line_setup_form',
    allowedMenus: ['overview', 'line_setup_form', 'production_tracker', 'rework_rejection_tracker', 'reports', 'missed_actions', 'logs', 'alert_center']
  },
  'Machine Centre User': {
    defaultRoute: '/mobile',
    allowedMenus: ['mobile', 'line1', 'line2']
  },
  'IED': {
    defaultRoute: '/production_tracker',
    allowedMenus: ['overview', 'production_routing', 'production_tracker', 'reports', 'missed_actions', 'logs', 'alert_center']
  },
  'Planner': {
    defaultRoute: '/production_planning',
    allowedMenus: ['overview', 'production_planning', 'line_schedule', 'production_tracker', 'reports', 'missed_actions', 'logs', 'alert_center', 'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees']
  },
  'Unit Head': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'production_tracker', 'reports', 'missed_actions', 'logs', 'alert_center']
  },
  'Production Manager': {
    defaultRoute: '/production_tracker',
    allowedMenus: ['production_tracker', 'missed_actions', 'alert_center']
  },
  'Quality': {
    defaultRoute: '/production_tracker',
    allowedMenus: ['production_tracker', 'rework_rejection_tracker', 'missed_actions', 'alert_center']
  },
  'Project Monitor': {
    defaultRoute: '/production_tracker',
    allowedMenus: [
      'overview', 'production_tracker', 'manual_production_entry',
      'reports', 'missed_actions', 'logs', 'alert_center',
    ],
  },
};

export const ALL_MENU_DEFINITIONS = [
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
].filter((item) => !HIDDEN_MENU_KEYS.includes(item.key as typeof HIDDEN_MENU_KEYS[number]));

const ROLE_ALIASES: Record<string, UserRole> = {
  administrator: 'Admin',
  admin: 'Admin',
  'line supervisor': 'Line Supervisor',
  'machine centre user': 'Machine Centre User',
  ied: 'IED',
  planner: 'Planner',
  'unit head': 'Unit Head',
  'production manager': 'Production Manager',
  'production_manager': 'Production Manager',
  quality: 'Quality',
  'project monitor': 'Project Monitor',
};

const normalizeRole = (role: UserRole | string | null): UserRole | null => {
  if (!role) return null;
  const cleaned = String(role).trim();
  const direct = roleConfigs[cleaned as UserRole] ? (cleaned as UserRole) : null;
  if (direct) return direct;
  return ROLE_ALIASES[cleaned.toLowerCase()] || null;
};

const normalizeAppRoute = (route: string | null | undefined): string => {
  const cleaned = String(route || '').trim();
  if (!cleaned) return '/overview';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
};

const matchesProductionManager = (value: string): boolean => {
  const v = value.trim().toLowerCase();
  return v === 'production manager' || v === 'production_manager' || v.includes('production manager');
};

const matchesQuality = (value: string): boolean => {
  const v = value.trim().toLowerCase();
  return v === 'quality';
};

/** Resolves role from session; maps legacy Unit Head logins for Production Manager / Quality. */
export const getEffectiveRole = (user: UserSession | null | undefined): UserRole | null => {
  if (!user) return null;
  if (user.effective_role) {
    const fromEffective = normalizeRole(user.effective_role);
    if (fromEffective) return fromEffective;
  }
  const normalized = normalizeRole(user.role ?? null);
  if (normalized === 'Production Manager' || normalized === 'Quality') {
    return normalized;
  }
  if (normalized !== 'Unit Head') {
    if (normalized) return normalized;
    const customRole = String(user.role || '').trim();
    return customRole || null;
  }
  const hints = [user.code, user.name].filter(Boolean).map((v) => String(v));
  if (hints.some(matchesProductionManager)) return 'Production Manager';
  if (hints.some(matchesQuality)) return 'Quality';
  return normalized;
};

function getSessionRoleConfig(user: UserSession | null | undefined): RoleConfig | null {
  if (!user?.allowed_menus || !Array.isArray(user.allowed_menus) || user.allowed_menus.length === 0) {
    return null;
  }
  return {
    defaultRoute: normalizeAppRoute(user.default_route),
    allowedMenus: user.allowed_menus,
  };
}

function getStaticRoleConfig(user: UserSession | null | undefined): RoleConfig | null {
  const normalizedRole = getEffectiveRole(user);
  if (!normalizedRole) return null;
  return roleConfigs[normalizedRole] || null;
}

export function resolveRoleConfig(user: UserSession | null | undefined): RoleConfig | null {
  return getSessionRoleConfig(user) || getStaticRoleConfig(user);
}

export const isMenuAllowed = (
  menuKey: string,
  roleOrUser: UserRole | string | UserSession | null
): boolean => {
  const user: UserSession | null =
    typeof roleOrUser === 'object' && roleOrUser !== null
      ? roleOrUser
      : roleOrUser
        ? { role: roleOrUser as string }
        : null;
  const config = resolveRoleConfig(user);
  if (HIDDEN_MENU_KEYS.includes(menuKey as typeof HIDDEN_MENU_KEYS[number])) return false;
  return config?.allowedMenus.includes(menuKey) || false;
};

export const getDefaultRoute = (
  roleOrUser: UserRole | string | UserSession | null,
  userInfo?: UserSession
): string => {
  const user: UserSession | null =
    typeof roleOrUser === 'object' && roleOrUser !== null
      ? roleOrUser
      : userInfo
        ? { role: roleOrUser as string, ...userInfo }
        : roleOrUser
          ? { role: roleOrUser as string }
          : null;

  const normalizedRole = getEffectiveRole(user);
  // Machine-only URL — MobileProduction resolves active session or valid employee on load
  if (normalizedRole === 'Machine Centre User' && user?.machine_id) {
    return `/mobile/${encodeURIComponent(user.machine_id)}`;
  }

  const config = resolveRoleConfig(user);
  if (config?.defaultRoute) {
    return normalizeAppRoute(config.defaultRoute);
  }

  if (!normalizedRole) return '/overview';
  return normalizeAppRoute(roleConfigs[normalizedRole as UserRole]?.defaultRoute);
};

/** Roles allowed to add/edit/delete on Manual Production Entry (not view-only). */
const MANUAL_PRODUCTION_MUTATE_ROLES = new Set(['admin', 'project monitor']);

export function canMutateManualProduction(role: string | null | undefined): boolean {
  return MANUAL_PRODUCTION_MUTATE_ROLES.has(String(role || '').trim().toLowerCase());
}

/** Merge fresh permissions from /api/auth/session into stored user_info */
export function applySessionPermissions(user: UserSession): UserSession {
  if (typeof localStorage === 'undefined') return user;
  const merged = { ...user };
  localStorage.setItem('user_info', JSON.stringify(merged));
  return merged;
}
