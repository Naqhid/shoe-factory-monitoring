import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Users, Layers, Package, Palette, Shirt, Settings, Cpu, Menu, X, BarChart3, Factory, TrendingUp, Route, Calendar, UserCheck, User, Smartphone, LogOut } from 'lucide-react';

interface NavigationProps {
  activeMenu: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const processMenus = [
  { key: 'overview', label: 'TV Dashboard', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: TrendingUp },
  { key: 'production_routing', label: 'Production Routing', icon: Route },
  { key: 'production_planning', label: 'Production Planning', icon: Calendar },
  { key: 'line_setup_form', label: 'Line Setup Form', icon: UserCheck },
  { key: 'mobile_live_dashboard', label: 'Mobile Live Dashboard', icon: Smartphone },
];

const masterMenus = [
  { key: 'customers', label: 'Customer', icon: Users, table: 'customers' },
  { key: 'groups', label: 'Group', icon: Layers, table: 'groups_master' },
  { key: 'leather', label: 'Leather', icon: Package, table: 'leather' },
  { key: 'styles', label: 'Style', icon: Shirt, table: 'styles' },
  { key: 'colors', label: 'Color', icon: Palette, table: 'colors' },
  { key: 'work_centres', label: 'Work Centre', icon: Settings, table: 'work_centres' },
  { key: 'machine_centres', label: 'Machine Centre', icon: Cpu, table: 'machine_centres' },
  { key: 'users', label: 'User', icon: User, table: 'users' },
  { key: 'employees', label: 'Employee', icon: UserCheck, table: 'employees' },
];

export const Navigation: React.FC<NavigationProps> = ({ activeMenu, sidebarOpen, onToggleSidebar }) => {
  const navigate = useNavigate();
  const [mastersExpanded, setMastersExpanded] = React.useState(false);
  const [processExpanded, setProcessExpanded] = React.useState(true);

  const handleLogout = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('app_authenticated');
      sessionStorage.removeItem('mobile_authenticated');
    }
    navigate('/');
    if (window.innerWidth < 1024) onToggleSidebar();
  };

  return (
    <>
      {/* Mobile and Desktop menu button */}
      <button
        onClick={onToggleSidebar}
        className="fixed top-4 left-4 z-50 bg-white p-2 rounded-md shadow-md"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">ERP System</h2>
          <button
            onClick={onToggleSidebar}
            className="p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="p-4 h-full overflow-y-auto">
          {/* Masters Menu */}
          <div className="mb-4">
            <button
              onClick={() => setMastersExpanded(!mastersExpanded)}
              className="flex items-center justify-between w-full text-left p-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              <span className="font-medium">Masters</span>
              {mastersExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {mastersExpanded && (
              <div className="ml-4 mt-2 space-y-1">
                {masterMenus.map((menu) => {
                  const Icon = menu.icon;
                  return (
                    <Link
                      key={menu.key}
                      to={`/${menu.key}`}
                      onClick={() => {
                        // Don't close sidebar on desktop
                        if (window.innerWidth < 1024) {
                          onToggleSidebar();
                        }
                      }}
                      className={`flex items-center w-full text-left p-2 rounded-md transition-colors ${
                        activeMenu === menu.key
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {menu.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Process Menu */}
          <div className="mb-4">
            <button
              onClick={() => setProcessExpanded(!processExpanded)}
              className="flex items-center justify-between w-full text-left p-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              <span className="font-medium">Process</span>
              {processExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {processExpanded && (
              <div className="ml-4 mt-2 space-y-1">
                {processMenus.map((menu) => {
                  const Icon = menu.icon;
                  return (
                    <Link
                      key={menu.key}
                      to={`/${menu.key}`}
                      onClick={() => {
                        if (window.innerWidth < 1024) onToggleSidebar();
                      }}
                      className={`flex items-center w-full text-left p-2 rounded-md transition-colors ${
                        activeMenu === menu.key ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {menu.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center w-full text-left p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </button>
          </div>
        </nav>
      </div>
    </>
  );
};