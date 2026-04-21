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
import { MonitoringDashboard } from './components/MonitoringDashboard';
import LogPage from './components/LogPage';
import { useMachineStatus, useEfficiencyReport, useOverallDailyData } from './hooks/useApi';
import { isMenuAllowed, getDefaultRoute } from './utils/roleConfig';
import { API_BASE_URL, apiFetch } from './services/api';
import { MachineStatus } from './types';
import { Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';

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
  const hideTopHeader = isMobileProduction || isMobileQRScanner;
  const hideLogout = false; // Show logout for all users including Machine Centre Users

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
  const isMonitoring = activeMenu === 'monitoring';
  const isLogs = activeMenu === 'logs';
  const isMasterView = Object.keys(masterConfigs).includes(activeMenu);
  const currentConfig = isMasterView ? masterConfigs[activeMenu as keyof typeof masterConfigs] : null;

  // Role-based access control - must be before any early returns
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

  // Show login first when app opens; after login, show the main app
  if (!isAuthenticated) {
    return <LoginForm />;
  }

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
    <Layout activeMenu={activeMenu} hideTopHeader={hideTopHeader} hideLogout={hideLogout}>
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
      ) : isMonitoring ? (
        <MonitoringDashboard />
      ) : isLogs ? (
        <LogPage />
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

function AppWithProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default AppWithProvider;
