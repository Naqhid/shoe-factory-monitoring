// Role-based menu configuration
export type UserRole = 'Admin' | 'Line Supervisor' | 'Machine Centre User' | 'IED' | 'Planner' | 'Unit Head';

export interface RoleConfig {
  defaultRoute: string;
  allowedMenus: string[];
}

export const roleConfigs: Record<UserRole, RoleConfig> = {
  'Admin': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'reports', 'production_routing', 'production_planning', 'line_setup_form', 'production_tracker', 'rework_rejection_tracker', 'mobile', 'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees', 'users', 'forms_master', 'user_rights', 'roles', 'monitoring']
  },
  'Line Supervisor': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'line_setup_form', 'production_tracker', 'rework_rejection_tracker', 'reports']
  },
  'Machine Centre User': {
    defaultRoute: '/mobile',
    allowedMenus: ['mobile', 'line1', 'line2']
  },
  'IED': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'production_routing', 'production_tracker', 'rework_rejection_tracker', 'reports']
  },
  'Planner': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'production_planning', 'production_tracker','reports', 'customers', 'groups', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees']
  },
  'Unit Head': {
    defaultRoute: '/overview',
    allowedMenus: ['overview', 'production_tracker','reports']
  }
};

export const isMenuAllowed = (menuKey: string, role: UserRole | string | null): boolean => {
  if (!role) return false;
  const config = roleConfigs[role as UserRole];
  return config?.allowedMenus.includes(menuKey) || false;
};

export const getDefaultRoute = (role: UserRole | string | null, userInfo?: any): string => {
  if (!role) return '/overview';
  
  // Special handling for Machine Centre Users - redirect to their assigned machine
  if (role === 'Machine Centre User' && userInfo?.machine_id) {
    return `/mobile/${encodeURIComponent(userInfo.machine_id)}`;
  }
  
  return roleConfigs[role as UserRole]?.defaultRoute || '/overview';
};
