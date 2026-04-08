import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { StatsPanel } from './components/StatsPanel';
import { MachineCard } from './components/MachineCard';
import { EfficiencyChart } from './components/EfficiencyChart';
import { MachineDetailModal } from './components/MachineDetailModal';
import { Layout } from './components/Layout';
import { MasterForm } from './components/MasterForm';
import { ProductionPlanningForm } from './components/ProductionPlanningForm';
import { Reports } from './components/Reports';
import { ProductionRoutingForm } from './components/ProductionRoutingForm';
import { MobileLineSetupForm } from './components/MobileLineSetupForm';
import { MobileLiveDashboard } from './components/MobileLiveDashboard';
import { MobileLineSelector } from './components/MobileLineSelector';
import { MobileLineProduction } from './components/MobileLineProduction';
import { MobileProduction } from './components/MobileProduction';
import { MobileRemoteSetup } from './components/MobileRemoteSetup';
import { LoginForm } from './components/LoginForm';
import { TrackerApp } from './components/TrackerApp';
import { ProductionTracker } from './components/ProductionTracker';
import { UsersMasterForm } from './components/UsersMasterForm';
import { FormsMasterForm } from './components/FormsMasterForm';
import { UserRightsForm } from './components/UserRightsForm';
import { RolesMasterForm } from './components/RolesMasterForm';
import { TVDashboard } from './components/TVDashboard';
import { ReworkRejectionTrackerPage } from './components/ReworkRejectionTrackerPage';
import { useMachineStatus, useEfficiencyReport, useOverallDailyData } from './hooks/useApi';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { isMenuAllowed, getDefaultRoute } from './utils/roleConfig';
import { API_BASE_URL, apiFetch } from './services/api';
import { MachineStatus } from './types';
import { Loader2, AlertCircle, RefreshCw, Download, X, Smartphone, Monitor } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: 1000,
    },
  },
});

interface MasterRecord {
  id: number;
  code: string;
  name: string;
  work_centre_id?: number;
  work_centre_name?: string;
  machine_id?: string;
}

const masterConfigs = {
  customers: { title: 'Customer', table: 'customers' },
  groups: { title: 'Group', table: 'groups_master' },
  leather: { title: 'Leather', table: 'leather' },
  styles: { title: 'Style', table: 'styles' },
  colors: { title: 'Color', table: 'colors' },
  work_centres: { title: 'Work Centre', table: 'work_centres' },
  machine_centres: { title: 'Machine Centre', table: 'machine_centres' },
  employees: { title: 'Employee', table: 'employees' },
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeMenu = pathParts[0] || 'overview';
  const isLineRoute = pathParts.length >= 2 && pathParts[0] === 'mobile' && (pathParts[1] === 'line1' || pathParts[1] === 'line2');

  // App-wide login: show LoginForm first when not authenticated
  const isAuthenticated = typeof localStorage !== 'undefined' && !!localStorage.getItem('app_authenticated');

  // Auto-logout after 30 minutes of inactivity
  const handleSessionTimeout = React.useCallback(() => {
    localStorage.clear();
    toast.error('Session expired due to inactivity. Please log in again.');
    navigate('/', { replace: true });
  }, [navigate]);

  useSessionTimeout(handleSessionTimeout, isAuthenticated);

  const [selectedDate] = React.useState(new Date());
  const [selectedMachine, setSelectedMachine] = React.useState<MachineStatus | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  const [records, setRecords] = React.useState<MasterRecord[]>([]);
  const [loading, setLoading] = React.useState(false);

  const isDashboard = isAuthenticated && activeMenu === 'overview';
  const isMobile = activeMenu === 'mobile' || pathParts[0] === 'mobile';
  const isMobileLineSelector = activeMenu === 'mobile' && pathParts.length === 1;
  const isMobileLineProduction = isLineRoute;
  const isMobileProduction = pathParts[0] === 'mobile' && pathParts.length >= 2 && !isLineRoute;
  const isMobileQRScanner = pathParts[0] === 'mobile' && pathParts.length === 2 && !isLineRoute;

  const {
    data: machines = [],
    isLoading: machinesLoading,
    error: machinesError,
    refetch: refetchMachines,
    dataUpdatedAt
  } = useMachineStatus(false); // Disabled for new TV dashboard

  const {
    data: efficiencyData = [],
    isLoading: efficiencyLoading
  } = useEfficiencyReport(selectedDate, false); // Disabled for new TV dashboard

  const {
    data: overallDailyData,
    isLoading: overallLoading
  } = useOverallDailyData(selectedDate, false); // Disabled for new TV dashboard

  const fetchRecords = async (table: string) => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/masters/${table}`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
      } else {
        toast.error(result.error || `Failed to load ${table}`);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Network error while loading master data');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (dataUpdatedAt) {
      setLastRefresh(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  React.useEffect(() => {
    const config = masterConfigs[activeMenu as keyof typeof masterConfigs];
    if (config) {
      fetchRecords(config.table);
    }
  }, [activeMenu]);

  const isConnected = !machinesError;
  const isLoading = machinesLoading || efficiencyLoading || overallLoading;

  const efficiencyMap = React.useMemo(() => {
    const map = new Map();
    efficiencyData.forEach(item => {
      map.set(item.machine_id, item.efficiency_percentage || 0);
    });
    return map;
  }, [efficiencyData]);

  // Deduplicate machines by machine_id
  const uniqueMachines = React.useMemo(() => {
    const seen = new Map();
    machines.forEach(machine => {
      if (!seen.has(machine.machine_id)) {
        seen.set(machine.machine_id, machine);
      }
    });
    return Array.from(seen.values());
  }, [machines]);

  const handleMachineClick = (machine: MachineStatus) => {
    setSelectedMachine(machine);
  };

  const handleCloseModal = () => {
    setSelectedMachine(null);
  };

  const handleMenuClick = (menu: string) => {
    navigate(`/${menu}`);
  };

  const handleRefresh = () => {
    const config = masterConfigs[activeMenu as keyof typeof masterConfigs];
    if (config) {
      fetchRecords(config.table);
    }
  };

  const isProductionDashboard = activeMenu === 'overview';
  const isReports = activeMenu === 'reports';
  const isProductionRouting = activeMenu === 'production_routing';
  const isProductionPlanning = activeMenu === 'production_planning';
  const isLineSetupForm = activeMenu === 'line_setup_form';
  const isMobileLiveDashboard = activeMenu === 'mobile_live_dashboard';
  const isTrackerApp = activeMenu === 'tracker_app';
  const isProductionTracker = activeMenu === 'production_tracker';
  const isReworkRejectionTracker = activeMenu === 'rework_rejection_tracker';
  const isUsers = activeMenu === 'users';
  const isFormsMaster = activeMenu === 'forms_master';
  const isUserRights = activeMenu === 'user_rights';
  const isRoles = activeMenu === 'roles';
  const isMasterView = Object.keys(masterConfigs).includes(activeMenu);
  const currentConfig = isMasterView ? masterConfigs[activeMenu as keyof typeof masterConfigs] : null;

  // Show login first when app opens; after login, show the main app
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Role-based access control - redirect if user doesn't have access to current route
  React.useEffect(() => {
    if (isAuthenticated) {
      const userInfo = localStorage.getItem('user_info');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        const userRole = user.role || 'Admin';
        if (activeMenu && !isMenuAllowed(activeMenu, userRole)) {
          const defaultRoute = getDefaultRoute(userRole, user);
          toast.error(`Access denied. You don't have permission to view this page.`);
          navigate(defaultRoute, { replace: true });
        }
      }
    }
  }, [isAuthenticated, activeMenu, navigate]);

  if (machinesError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header isConnected={false} />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Connection Error</h2>
            <p className="text-red-600 mb-4">
              Unable to connect to the factory monitoring system. Please check if the backend server is running.
            </p>
            <button
              onClick={() => refetchMachines()}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeMenu={activeMenu}>
      {isProductionDashboard ? (
        <TVDashboard />
      ) : isReports ? (
        <Reports />
      ) : isProductionRouting ? (
        <ProductionRoutingForm />
      ) : isProductionPlanning ? (
        <ProductionPlanningForm />
      ) : isLineSetupForm ? (
        <MobileLineSetupForm />
      ) : isMobileLiveDashboard ? (
        <MobileLiveDashboard />
      ) : isMobileLineSelector ? (
        <MobileLineSelector />
      ) : isMobileLineProduction ? (
        <MobileLineProduction />
      ) : isMobileQRScanner ? (
        <MobileProduction />
      ) : isMobileProduction ? (
        <MobileProduction />
      ) : activeMenu === 'mobile-remote-setup' ? (
        <MobileRemoteSetup />
      ) : isTrackerApp ? (
        <TrackerApp />
      ) : isProductionTracker ? (
        <ProductionTracker />
      ) : isReworkRejectionTracker ? (
        <ReworkRejectionTrackerPage />
      ) : isUsers ? (
        <UsersMasterForm />
      ) : isFormsMaster ? (
        <FormsMasterForm />
      ) : isUserRights ? (
        <UserRightsForm />
      ) : isRoles ? (
        <RolesMasterForm />
      ) : isMasterView ? (
        loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        ) : (
          <MasterForm
            title={currentConfig!.title}
            table={currentConfig!.table}
            records={records}
            onRefresh={handleRefresh}
          />
        )
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Select a menu item</p>
        </div>
      )}

      {selectedMachine && (
        <MachineDetailModal
          machine={selectedMachine}
          efficiency={efficiencyMap.get(selectedMachine.machine_id)}
          isOpen={!!selectedMachine}
          onClose={handleCloseModal}
        />
      )}
    </Layout>
  );
}

// PWA Install Prompt Component
const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const android = /Android/.test(navigator.userAgent);
    const mobile = /Mobi|Android/i.test(navigator.userAgent);
    
    setIsIOS(iOS);
    setIsAndroid(android);
    setIsMobile(mobile);

    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                      (window.navigator as any).standalone === true ||
                      window.matchMedia('(display-mode: minimal-ui)').matches;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      if (!dismissed || daysSinceDismissed > 3) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For mobile devices (iOS and Android) show prompt if not installed
    if (mobile && !standalone) {
      const dismissedKey = iOS ? 'pwa-install-dismissed-ios' : 'pwa-install-dismissed-android';
      const dismissed = localStorage.getItem(dismissedKey);
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      if (!dismissed || daysSinceDismissed > 3) {
        setTimeout(() => setShowPrompt(true), 5000); // Show after 5 seconds on mobile
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('pwa-install-dismissed-ios', Date.now().toString());
    } else if (isAndroid) {
      localStorage.setItem('pwa-install-dismissed-android', Date.now().toString());
    } else {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-2xl p-4 border border-blue-500">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {isMobile ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            <h3 className="font-semibold text-sm">Install ProdPulse</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-200 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <p className="text-blue-100 text-xs mb-3 leading-relaxed">
          Install our app for faster access, offline support, and a better experience!
        </p>

        {isIOS ? (
          <div className="space-y-2">
            <div className="text-xs text-blue-100">
              <p className="mb-1 font-semibold">To install on iPhone/iPad:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-200">
                <li>Tap the Share button <span className="inline-block w-5 h-5 bg-blue-500 rounded text-center text-xs leading-5">⬆️</span></li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" to confirm</li>
              </ol>
            </div>
          </div>
        ) : isAndroid ? (
          <div className="space-y-2">
            {deferredPrompt ? (
              <button
                onClick={handleInstallClick}
                className="w-full bg-white text-blue-600 font-semibold py-2 px-4 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Download className="h-4 w-4" />
                Install App
              </button>
            ) : (
              <div className="text-xs text-blue-100">
                <p className="mb-1 font-semibold">To install on Android Chrome:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-200">
                  <li>Tap the menu button <span className="inline-block w-5 h-5 bg-blue-500 rounded text-center text-xs leading-5">⋮</span> (3 dots)</li>
                  <li>Tap "Add to Home screen" or "Install app"</li>
                  <li>Tap "Add" or "Install" to confirm</li>
                </ol>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleInstallClick}
            className="w-full bg-white text-blue-600 font-semibold py-2 px-4 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            Install App
          </button>
        )}
      </div>
    </div>
  );
};

function AppWithProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" />
      <PWAInstallPrompt />
    </QueryClientProvider>
  );
}

export default AppWithProvider;