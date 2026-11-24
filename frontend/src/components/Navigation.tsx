import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Layers,
  Package,
  Palette,
  Shirt,
  Settings,
  Cpu,
  Menu,
  X,
  BarChart3,
  TrendingUp,
  Route,
  Calendar,
  UserCheck,
  User,
  Smartphone,
  LogOut,
  FileText,
  Shield,
  Tv,
  Activity,
  ClipboardList,
  MonitorDot,
  AlertTriangle,
  PencilRuler,
  Repeat2,
  Sliders,
} from 'lucide-react';
import { isMenuAllowed, getEffectiveRole } from '../utils/roleConfig';
import { AlertBell } from './AlertBell';
import { LanguageSwitcher } from './LanguageSwitcher';
import { GlobalSearch } from './GlobalSearch';

interface NavigationProps {
  activeMenu: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  hideSidebarToggleButton?: boolean;
  hideLogout?: boolean;
  hideAlertBell?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
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
  { key: 'line_setup_form', label: 'Line Setup', icon: UserCheck },
  { key: 'manual_production_entry', label: 'Manual Entry', icon: PencilRuler },
  { key: 'production_tracker', label: 'Production Tracker', icon: Smartphone },
  { key: 'rework_rejection_tracker', label: 'Rework / Rejection', icon: ClipboardList },
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
  { key: 'settings', label: 'Settings', icon: Sliders },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeMenu,
  sidebarOpen,
  onToggleSidebar,
  hideSidebarToggleButton = false,
  hideLogout = false,
  hideAlertBell = false,
  searchQuery = '',
  onSearchChange,
}) => {
  const navigate = useNavigate();
  const [mastersExpanded, setMastersExpanded] = React.useState(false);
  const [processExpanded, setProcessExpanded] = React.useState(true);
  const [setupExpanded, setSetupExpanded] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const touchStartX = React.useRef<number | null>(null);

  const getUserInfo = () => {
    if (typeof localStorage !== 'undefined') {
      const userInfo = localStorage.getItem('user_info');
      if (userInfo) return JSON.parse(userInfo);
    }
    return null;
  };

  const user = getUserInfo();
  const userRole = getEffectiveRole(user) || 'Admin';
  const menuAccess = user ?? { role: userRole };

  // Auto-expand section containing active menu (only on mount)
  const hasAutoExpanded = React.useRef(false);
  React.useEffect(() => {
    if (!hasAutoExpanded.current) {
      hasAutoExpanded.current = true;
      if (masterMenus.some((m) => m.key === activeMenu)) setMastersExpanded(true);
      if (processMenus.some((m) => m.key === activeMenu)) setProcessExpanded(true);
      if (setupMenus.some((m) => m.key === activeMenu)) setSetupExpanded(true);
    }
    // Always scroll active item into view on navigation
    requestAnimationFrame(() => {
      const activeEl = sidebarRef.current?.querySelector('[data-active="true"]');
      activeEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [activeMenu]);

  // Swipe to close on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff < -80) onToggleSidebar(); // swipe left to close
    touchStartX.current = null;
  };

  const filterMenus = (menus: typeof processMenus) => {
    if (!searchQuery || searchQuery.length < 2) {
      return menus.filter((menu) => isMenuAllowed(menu.key, menuAccess));
    }
    const searchLower = searchQuery.toLowerCase();
    return menus.filter((menu) => {
      const isAllowed = isMenuAllowed(menu.key, menuAccess);
      const matchesSearch =
        menu.label.toLowerCase().includes(searchLower) ||
        menu.key.toLowerCase().includes(searchLower);
      return isAllowed && matchesSearch;
    });
  };

  const filteredProcessMenus = filterMenus(processMenus);
  const filteredMasterMenus = filterMenus(masterMenus);
  const filteredSetupMenus = filterMenus(setupMenus);

  const handleLogout = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_authenticated');
      localStorage.removeItem('mobile_authenticated');
      localStorage.removeItem('user_info');
    }
    navigate('/');
    if (window.innerWidth < 1024) onToggleSidebar();
  };

  const closeMobileNav = () => {
    if (window.innerWidth < 1024) onToggleSidebar();
  };

  const MenuLink: React.FC<{ menu: (typeof processMenus)[0] }> = ({ menu }) => {
    const Icon = menu.icon;
    const isActive = activeMenu === menu.key;
    return (
      <Link
        to={`/${menu.key}`}
        onClick={closeMobileNav}
        data-active={isActive || undefined}
        className={[
          'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150',
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]',
        ].join(' ')}
      >
        <span
          className={[
            'flex items-center justify-center h-8 w-8 rounded-lg shrink-0 transition-colors',
            isActive
              ? 'bg-white/20'
              : 'bg-gray-100 group-hover:bg-gray-200',
          ].join(' ')}
        >
          <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
        </span>
        <span className="truncate">{menu.label}</span>
      </Link>
    );
  };

  const SectionHeader: React.FC<{
    label: string;
    expanded: boolean;
    onToggle: () => void;
    count: number;
  }> = ({ label, expanded, onToggle, count }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700 hover:text-gray-900 transition-colors"
    >
      <span>{label} <span className="text-blue-500 font-semibold">({count})</span></span>
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
      />
    </button>
  );

  return (
    <>
      {/* Hamburger toggle button */}
      {!hideSidebarToggleButton && (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
          className="fixed top-3 left-3 z-50 bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-gray-200/60 hover:bg-gray-50 active:scale-95 transition-all touch-manipulation sm:top-4 sm:left-4 sm:p-2.5"
        >
          <Menu className="h-5 w-5 text-gray-700" />
        </button>
      )}

      {/* Backdrop overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={onToggleSidebar}
        />
      )}

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={[
          'fixed inset-y-0 left-0 z-50 w-72 sm:w-64 bg-white border-r border-gray-200/80 flex flex-col',
          'transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/25">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 leading-tight" translate="yes">ProdPulse</h2>
                <p className="text-[10px] text-gray-400 font-medium" translate="yes">Smart Production</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!hideAlertBell && <AlertBell />}
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition-all touch-manipulation"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable nav content */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3 space-y-1">
          {/* Search */}
          <div className="mb-3">
            <GlobalSearch onSearchChange={onSearchChange} />
          </div>

          {/* User card */}
          {user && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/80">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate" translate="yes">{user.name}</p>
                  <p className="text-[11px] text-blue-600 font-medium">{userRole}</p>
                </div>
              </div>
              <div className="mt-2.5">
                <LanguageSwitcher />
              </div>
            </div>
          )}

          {/* Process section */}
          {filteredProcessMenus.length > 0 && (
            <div className="mb-2">
              <SectionHeader
                label="Process"
                expanded={processExpanded}
                onToggle={() => setProcessExpanded(!processExpanded)}
                count={filteredProcessMenus.length}
              />
              {processExpanded && (
                <div className="space-y-0.5 mt-1">
                  {filteredProcessMenus.map((menu) => (
                    <MenuLink key={menu.key} menu={menu} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Masters section */}
          {filteredMasterMenus.length > 0 && (
            <div className="mb-2">
              <SectionHeader
                label="Masters"
                expanded={mastersExpanded}
                onToggle={() => setMastersExpanded(!mastersExpanded)}
                count={filteredMasterMenus.length}
              />
              {mastersExpanded && (
                <div className="space-y-0.5 mt-1">
                  {filteredMasterMenus.map((menu) => (
                    <MenuLink key={menu.key} menu={menu} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Setup section */}
          {filteredSetupMenus.length > 0 && (
            <div className="mb-2">
              <SectionHeader
                label="Setup"
                expanded={setupExpanded}
                onToggle={() => setSetupExpanded(!setupExpanded)}
                count={filteredSetupMenus.length}
              />
              {setupExpanded && (
                <div className="space-y-0.5 mt-1">
                  {filteredSetupMenus.map((menu) => (
                    <MenuLink key={menu.key} menu={menu} />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer with logout */}
        {!hideLogout && (
          <div className="shrink-0 px-3 py-3 border-t border-gray-100 bg-gray-50/50 safe-area-bottom">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all touch-manipulation"
            >
              <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-50">
                <LogOut className="h-4 w-4 text-red-500" />
              </span>
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );
};
