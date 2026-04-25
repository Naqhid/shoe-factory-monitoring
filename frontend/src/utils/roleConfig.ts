// Role-based menu configuration
export type UserRole = 'Admin' | 'Line Supervisor' | 'Machine Centre User' | 'IED' | 'Planner' | 'Unit Head';

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
};

const normalizeRole = (role: UserRole | string | null): UserRole | null => {
  if (!role) return null;
  const cleaned = String(role).trim();
  const direct = roleConfigs[cleaned as UserRole] ? (cleaned as UserRole) : null;
  if (direct) return direct;
  return ROLE_ALIASES[cleaned.toLowerCase()] || null;
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
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'production_routing', 'manual_production_entry', 'production_tracker', 'rework_rejection_tracker', 'reports', 'missed_actions', 'logs', 'alert_center']
  },
  'Planner': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'production_planning', 'manual_production_entry', 'production_tracker','reports', 'missed_actions', 'logs', 'alert_center', 'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees']
  },
  'Unit Head': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'manual_production_entry', 'production_tracker','reports', 'missed_actions', 'logs', 'alert_center']
  }
};

export const isMenuAllowed = (menuKey: string, role: UserRole | string | null): boolean => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  const config = roleConfigs[normalizedRole];
  return config?.allowedMenus.includes(menuKey) || false;
};

export const getDefaultRoute = (role: UserRole | string | null, userInfo?: any): string => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return '/overview';
  
  // Special handling for Machine Centre Users - redirect to their assigned machine
  if (normalizedRole === 'Machine Centre User' && userInfo?.machine_id) {
    return `/mobile/${encodeURIComponent(userInfo.machine_id)}`;
  }
  
  return roleConfigs[normalizedRole]?.defaultRoute || '/overview';
};
