import React from 'react';
import { Navigation } from './Navigation';
import { Activity, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertBell } from './AlertBell';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LayoutProps {
  children: React.ReactNode;
  activeMenu?: string;
  hideTopHeader?: boolean;
  hideLogout?: boolean;
  hideAlertBell?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeMenu = '',
  hideTopHeader = false,
  hideLogout = false,
  hideAlertBell = false
}) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(() => window.innerWidth >= 1024);
  const navigate = useNavigate();

  const getUserInfo = () => {
    if (typeof localStorage !== 'undefined') {
      const userInfo = localStorage.getItem('user_info');
      if (userInfo) {
        return JSON.parse(userInfo);
      }
    }
    return null;
  };

  const handleLogout = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_authenticated');
      localStorage.removeItem('mobile_authenticated');
      localStorage.removeItem('user_info');
    }
    navigate('/');
  };

  const user = getUserInfo();

  return (
    <>
      {/* Fixed header when sidebar is closed */}
      {!sidebarOpen && !hideTopHeader && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600 ml-16" />
            <div>
              <h1 className="text-lg font-bold text-gray-800" translate="yes">ProdPulse</h1>
              <p className="text-xs text-gray-500" translate="yes">Smart Production Tracking System</p>
            </div>
          </div>
          
          {/* User info and logout */}
          {user && (
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              {!hideAlertBell && <AlertBell />}
              <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border">
                <div className="flex items-center justify-center w-7 h-7 bg-blue-100 rounded-full">
                  <User className="h-3 w-3 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-800" translate="yes">{user.name}</span>
                  <span className="text-xs text-gray-500" translate="yes">{user.role || 'Admin'}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <Navigation
          activeMenu={activeMenu}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          hideLogout={hideLogout}
          hideAlertBell={hideAlertBell}
        />

        {/* Main content area */}
        <div className={`flex-1 flex flex-col min-w-0 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
          {/* Spacer for fixed header when sidebar is closed */}
          {!sidebarOpen && !hideTopHeader && <div className="h-20 flex-shrink-0"></div>}
          
          {/* Content wrapper */}
          <div className="flex-1 overflow-auto min-h-0">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};