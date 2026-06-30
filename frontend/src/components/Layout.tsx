import React from 'react';
import { Navigation } from './Navigation';
import { Activity, LogOut, RefreshCw, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertBell } from './AlertBell';
import { LanguageSwitcher } from './LanguageSwitcher';
import { GlobalSearch } from './GlobalSearch';

interface LayoutProps {
  children: React.ReactNode;
  activeMenu?: string;
  hideTopHeader?: boolean;
  /** When true, main content fills the viewport with no page scroll (e.g. TV dashboard). */
  fitViewport?: boolean;
  hideSidebarToggleButton?: boolean;
  hideLogout?: boolean;
  hideAlertBell?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeMenu = '',
  hideTopHeader = false,
  fitViewport = false,
  hideSidebarToggleButton = false,
  hideLogout = false,
  hideAlertBell = false
}) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(() => window.innerWidth >= 1024);
  const [searchQuery, setSearchQuery] = React.useState('');
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

  React.useEffect(() => {
    if (fitViewport) setSidebarOpen(false);
  }, [fitViewport]);

  React.useEffect(() => {
    const toggleSidebar = () => setSidebarOpen((prev) => !prev);
    window.addEventListener('layout:toggle-sidebar', toggleSidebar as EventListener);
    return () => {
      window.removeEventListener('layout:toggle-sidebar', toggleSidebar as EventListener);
    };
  }, []);

  React.useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-0 max-h-[100dvh] bg-gray-100 overflow-hidden max-w-[100vw]">
      <Navigation
        activeMenu={activeMenu}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        hideSidebarToggleButton={hideSidebarToggleButton}
        hideLogout={hideLogout}
        hideAlertBell={hideAlertBell}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {/* Content wrapper — sole vertical scroll for app shell (disabled when fitViewport) */}
        <div
          className={
            fitViewport
              ? 'flex-1 min-h-0 overflow-hidden flex flex-col'
              : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain'
          }
        >
          {/* Header inside scroll area — scrolls away with content */}
          {!sidebarOpen && !hideTopHeader && (
            <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
              {/* Top row: logo + user actions */}
              <div className="flex items-center justify-between px-4 sm:px-4 py-2.5 sm:py-3">
                <div className="flex items-center gap-2 pl-10 sm:pl-14 min-w-0 shrink">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-lg font-bold text-gray-800 leading-tight truncate" translate="yes">ProdPulse</h1>
                    <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block" translate="yes">Smart Production Tracking</p>
                  </div>
                </div>

                {/* Search bar — hidden on mobile, shown on sm+ */}
                <div className="hidden sm:block flex-1 max-w-md mx-6">
                  <GlobalSearch onSearchChange={setSearchQuery} />
                </div>

                {/* User info and logout */}
                {user && (
                  <div className="flex items-center gap-2 sm:gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        // Force reload preserving current URL (bypasses beforeunload)
                        window.onbeforeunload = null;
                        window.location.reload();
                      }}
                      className="flex items-center justify-center p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors touch-manipulation"
                      title="Refresh page"
                      aria-label="Refresh page"
                    >
                      <RefreshCw className="h-5 w-5 sm:h-4 sm:w-4" />
                    </button>
                    <div className="hidden sm:block">
                      <LanguageSwitcher />
                    </div>
                    {!hideAlertBell && <AlertBell />}
                    <div className="hidden lg:flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border">
                      <div className="flex items-center justify-center w-7 h-7 bg-blue-100 rounded-full">
                        <User className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-800" translate="yes">{user.name}</span>
                        <span className="text-xs text-gray-500" translate="yes">{user.role || 'Admin'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center justify-center gap-1 p-2 sm:px-3 sm:py-2 text-sm text-white bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-lg transition-colors shadow-sm touch-manipulation"
                      title="Logout"
                      aria-label="Logout"
                    >
                      <LogOut className="h-5 w-5 sm:h-4 sm:w-4 shrink-0" />
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile search + language row — visible only on small screens */}
              <div className="sm:hidden flex items-center gap-2 px-4 pb-2.5">
                <div className="flex-1 min-w-0">
                  <GlobalSearch onSearchChange={setSearchQuery} />
                </div>
                <div className="shrink-0">
                  <LanguageSwitcher />
                </div>
              </div>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
};