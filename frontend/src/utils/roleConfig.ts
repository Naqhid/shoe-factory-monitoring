// Role-based menu configuration
export type UserRole =
  | 'Admin'
  | 'Line Supervisor'
  | 'Machine Centre User'
  | 'IED'
  | 'Planner'
  | 'Unit Head'
  | 'Production Manager'
  | 'Quality';

export interface UserSession {
  role?: string | null;
  name?: string | null;
  code?: string | null;
  machine_id?: string | null;
}

export interface RoleConfig {
  defaultRoute: string;
  allowedMenus: string[];
}

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
};

const normalizeRole = (role: UserRole | string | null): UserRole | null => {
  if (!role) return null;
  const cleaned = String(role).trim();
  const direct = roleConfigs[cleaned as UserRole] ? (cleaned as UserRole) : null;
  if (direct) return direct;
  return ROLE_ALIASES[cleaned.toLowerCase()] || null;
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
  const normalized = normalizeRole(user.role ?? null);
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
};

export const roleConfigs: Record<UserRole, RoleConfig> = {
  'Admin': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'reports', 'missed_actions', 'logs', 'alert_center', 'production_routing', 'production_planning', 'line_setup_form', 'manual_production_entry', 'production_tracker', 'rework_rejection_tracker', 'mobile', 'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees', 'users', 'forms_master', 'user_rights', 'roles', 'monitoring']
  },
  'Line Supervisor': {
    defaultRoute: '/line_setup_form',
    allowedMenus: ['overview', 'line_setup_form', 'manual_production_entry', 'production_tracker', 'rework_rejection_tracker', 'reports', 'missed_actions', 'logs', 'alert_center']
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
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'production_planning', 'manual_production_entry', 'production_tracker','reports', 'missed_actions', 'logs', 'alert_center', 'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees']
  },
  'Unit Head': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'manual_production_entry', 'production_tracker','reports', 'missed_actions', 'logs', 'alert_center']
  },
  'Production Manager': {
    defaultRoute: '/production_tracker',
    allowedMenus: ['production_tracker']
  },
  'Quality': {
    defaultRoute: '/production_tracker',
    allowedMenus: ['production_tracker']
  }
};

export const isMenuAllowed = (
  menuKey: string,
  roleOrUser: UserRole | string | UserSession | null
): boolean => {
  const normalizedRole =
    typeof roleOrUser === 'object' && roleOrUser !== null
      ? getEffectiveRole(roleOrUser)
      : normalizeRole(roleOrUser);
  if (!normalizedRole) return false;
  const config = roleConfigs[normalizedRole];
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
  if (!normalizedRole) return '/overview';

  // Special handling for Machine Centre Users - redirect to their assigned machine
  if (normalizedRole === 'Machine Centre User' && user?.machine_id) {
    return `/mobile/${encodeURIComponent(user.machine_id)}`;
  }

  return roleConfigs[normalizedRole]?.defaultRoute || '/overview';
};
