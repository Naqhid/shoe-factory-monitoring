import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Users, Layers, Package, Palette, Shirt, Settings, Cpu, Menu, X, BarChart3, TrendingUp, Route, Calendar, UserCheck, User, Smartphone, LogOut, FileText, Shield, Tv, Activity, ClipboardList, MonitorDot, AlertTriangle, PencilRuler, Repeat2 } from 'lucide-react';
import { isMenuAllowed, getEffectiveRole } from '../utils/roleConfig';
import { AlertBell } from './AlertBell';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavigationProps {
  activeMenu: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  hideSidebarToggleButton?: boolean;
  hideLogout?: boolean;
  hideAlertBell?: boolean;
}

const processMenus = [
  { key: 'overview', label: 'TV Dashboard', icon: Tv },
  { key: 'reports', label: 'Reports', icon: TrendingUp },
  { key: 'missed_actions', label: 'Missed Actions', icon: AlertTriangle },
  { key: 'alert_center', label: 'Alert Center', icon: AlertTriangle },
  { key: 'logs', label: 'Login Logs', icon: FileText },
  { key: 'production_routing', label: 'Routing', icon: Route },
  { key: 'production_planning', label: 'Planning', icon: Calendar },
  { key: 'line_schedule', label: 'Line Schedule', icon: Repeat2 },
  { key: 'line_setup_form', label: 'Line Setup ', icon: UserCheck },
  { key: 'manual_production_entry', label: 'Manual Entry', icon: PencilRuler },
  { key: 'production_tracker', label: 'Production Tracker', icon: Smartphone },
  { key: 'rework_rejection_tracker', label: 'Rework / Rejection Tracker', icon: ClipboardList },
  { key: 'mobile', label: 'Line Monitor', icon: Smartphone },
];

const masterMenus = [
  { key: 'customers', label: 'Customer', icon: Users },
  { key: 'groups', label: 'Group', icon: Layers },
  { key: 'leather', label: 'Leather', icon: Package },
  { key: 'styles', label: 'Style', icon: Shirt },
  { key: 'colors', label: 'Color', icon: Palette },
  { key: 'work_centres', label: 'Work Centre', icon: Settings },
  { key: 'machine_centres', label: 'Machine Centre', icon: Cpu },
  { key: 'employees', label: 'Employee', icon: UserCheck },
];

const setupMenus = [
  { key: 'users', label: 'Users', icon: User },
  { key: 'roles', label: 'Roles', icon: Shield },
  { key: 'monitoring', label: 'Monitoring', icon: MonitorDot },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeMenu,
  sidebarOpen,
  onToggleSidebar,
  hideSidebarToggleButton = false,
  hideLogout = false,
  hideAlertBell = false
}) => {
  const navigate = useNavigate();
  const [mastersExpanded, setMastersExpanded] = React.useState(false);
  const [processExpanded, setProcessExpanded] = React.useState(true);
  const [setupExpanded, setSetupExpanded] = React.useState(false);
  
  const getUserInfo = () => {
    if (typeof localStorage !== 'undefined') {
      const userInfo = localStorage.getItem('user_info');
      if (userInfo) {
        return JSON.parse(userInfo);
      }
    }
    return null;
  };
  
  const user = getUserInfo();
  const userRole = getEffectiveRole(user) || 'Admin';
  const menuAccess = user ?? { role: userRole };

  const filteredProcessMenus = processMenus.filter(menu => isMenuAllowed(menu.key, menuAccess));
  const filteredMasterMenus = masterMenus.filter(menu => isMenuAllowed(menu.key, menuAccess));
  const filteredSetupMenus = setupMenus.filter(menu => isMenuAllowed(menu.key, menuAccess));

  const handleLogout = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_authenticated');
      localStorage.removeItem('mobile_authenticated');
      localStorage.removeItem('user_info');
    }
    navigate('/');
    if (window.innerWidth < 1024) onToggleSidebar();
  };

  return (
    <>
      {!hideSidebarToggleButton && (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
          className="fixed top-4 left-4 z-50 bg-white p-2 rounded-md shadow-md"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onToggleSidebar} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-800" translate="yes">ProdPulse</h2>
              <p className="text-xs text-gray-500" translate="yes">Smart Production Tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!hideAlertBell && <AlertBell />}
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Close navigation menu"
              className="p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="p-4 h-[calc(100vh-73px)] overflow-y-auto">
          {/* User info section */}
          {user && (
            <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-800 truncate" translate="yes">{user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  {userRole}
                </span>
              </div>
              <div className="mt-2">
                <LanguageSwitcher />
              </div>
            </div>
          )}
          {filteredMasterMenus.length > 0 && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setMastersExpanded(!mastersExpanded)}
                aria-expanded={mastersExpanded}
                aria-controls="masters-menu-group"
                className="flex items-center justify-between w-full text-left p-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <span className="font-medium">Masters</span>
                {mastersExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {mastersExpanded && (
                <div id="masters-menu-group" className="ml-4 mt-2 space-y-1">
                  {filteredMasterMenus.map((menu) => {
                    const Icon = menu.icon;
                    return (
                      <Link key={menu.key} to={`/${menu.key}`} onClick={() => { if (window.innerWidth < 1024) onToggleSidebar(); }} className={`flex items-center w-full text-left p-2 rounded-md transition-colors ${activeMenu === menu.key ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Icon className="h-4 w-4 mr-2" />{menu.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {filteredProcessMenus.length > 0 && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setProcessExpanded(!processExpanded)}
                aria-expanded={processExpanded}
                aria-controls="process-menu-group"
                className="flex items-center justify-between w-full text-left p-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <span className="font-medium">Process</span>
                {processExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {processExpanded && (
                <div id="process-menu-group" className="ml-4 mt-2 space-y-1">
                  {filteredProcessMenus.map((menu) => {
                    const Icon = menu.icon;
                    return (
                      <Link key={menu.key} to={`/${menu.key}`} onClick={() => { if (window.innerWidth < 1024) onToggleSidebar(); }} className={`flex items-center w-full text-left p-2 rounded-md transition-colors ${activeMenu === menu.key ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Icon className="h-4 w-4 mr-2" />{menu.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {filteredSetupMenus.length > 0 && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setSetupExpanded(!setupExpanded)}
                aria-expanded={setupExpanded}
                aria-controls="setup-menu-group"
                className="flex items-center justify-between w-full text-left p-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <span className="font-medium">Setup</span>
                {setupExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {setupExpanded && (
                <div id="setup-menu-group" className="ml-4 mt-2 space-y-1">
                  {filteredSetupMenus.map((menu) => {
                    const Icon = menu.icon;
                    return (
                      <Link key={menu.key} to={`/${menu.key}`} onClick={() => { if (window.innerWidth < 1024) onToggleSidebar(); }} className={`flex items-center w-full text-left p-2 rounded-md transition-colors ${activeMenu === menu.key ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Icon className="h-4 w-4 mr-2" />{menu.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!hideLogout && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button type="button" onClick={handleLogout} className="flex items-center w-full text-left p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors">
                <LogOut className="h-4 w-4 mr-2" />Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </>
  );
};
