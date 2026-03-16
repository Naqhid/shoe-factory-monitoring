import React from 'react';
import { Navigation } from './Navigation';
import { Activity, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  activeMenu?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeMenu = '' }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const navigate = useNavigate();

  const getUserInfo = () => {
    if (typeof sessionStorage !== 'undefined') {
      const userInfo = sessionStorage.getItem('user_info');
      if (userInfo) {
        return JSON.parse(userInfo);
      }
    }
    return null;
  };

  const handleLogout = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('app_authenticated');
      sessionStorage.removeItem('mobile_authenticated');
      sessionStorage.removeItem('user_info');
    }
    navigate('/');
  };

  const user = getUserInfo();

  return (
    <>
      {/* Fixed header when sidebar is closed */}
      {!sidebarOpen && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600 ml-16" />
            <div>
              <h1 className="text-lg font-bold text-gray-800 ">ProdPulse</h1>
              <p className="text-xs text-gray-500 ">Smart Production Tracking System</p>
            </div>
          </div>
          
          {/* User info and logout */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg border">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-800">{user.name}</span>
                  <span className="text-xs text-gray-500">{user.role || 'Admin'}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
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
        />

        {/* Main content area */}
        <div className={`flex-1 flex flex-col ${sidebarOpen ? 'lg:ml-64' : ''}`}>
          {/* Spacer for fixed header when sidebar is closed */}
          {!sidebarOpen && <div className="h-20 flex-shrink-0"></div>}
          
          {/* Content wrapper */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};