import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { StatsPanel } from './components/StatsPanel';
import { MachineCard } from './components/MachineCard';
import { EfficiencyChart } from './components/EfficiencyChart';
import { MachineDetailModal } from './components/MachineDetailModal';
import { Navigation } from './components/Navigation';
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
import { UsersMasterForm } from './components/UsersMasterForm';
import { FormsMasterForm } from './components/FormsMasterForm';
import { UserRightsForm } from './components/UserRightsForm';
import { useMachineStatus, useEfficiencyReport, useOverallDailyData } from './hooks/useApi';
import { MachineStatus } from './types';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

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

  // Get active menu from URL path, default to 'overview'
  const activeMenu = location.pathname.slice(1) || 'overview';

  // App-wide login: show LoginForm first when not authenticated
  const isAuthenticated = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('app_authenticated');

  // Redirect /login to overview when authenticated
  React.useEffect(() => {
    if (isAuthenticated && activeMenu === 'login') {
      navigate('/overview', { replace: true });
    }
  }, [isAuthenticated, activeMenu, navigate]);

  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [selectedDate] = React.useState(new Date());
  const [selectedMachine, setSelectedMachine] = React.useState<MachineStatus | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  const [records, setRecords] = React.useState<MasterRecord[]>([]);
  const [loading, setLoading] = React.useState(false);

  const isDashboard = isAuthenticated && activeMenu === 'overview';
  const isMobile = activeMenu === 'mobile' || activeMenu.startsWith('mobile/');
  const isMobileLineSelector = activeMenu === 'mobile';
  const isMobileLineProduction = activeMenu.startsWith('mobile/line');
  const isMobileProduction = activeMenu.startsWith('mobile/') && !activeMenu.startsWith('mobile/line') && activeMenu !== 'mobile';

  const {
    data: machines = [],
    isLoading: machinesLoading,
    error: machinesError,
    refetch: refetchMachines,
    dataUpdatedAt
  } = useMachineStatus(isDashboard);

  const {
    data: efficiencyData = [],
    isLoading: efficiencyLoading
  } = useEfficiencyReport(selectedDate, isDashboard);

  const {
    data: overallDailyData,
    isLoading: overallLoading
  } = useOverallDailyData(selectedDate, isDashboard);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

  const fetchRecords = async (table: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/masters/${table}`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
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
  const isUsers = activeMenu === 'users';
  const isFormsMaster = activeMenu === 'forms_master';
  const isUserRights = activeMenu === 'user_rights';
  const isMasterView = Object.keys(masterConfigs).includes(activeMenu);
  const currentConfig = isMasterView ? masterConfigs[activeMenu as keyof typeof masterConfigs] : null;

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
    <div className="flex h-screen bg-gray-50">
      <Navigation
        activeMenu={activeMenu}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className={`flex-1 overflow-auto ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {isProductionDashboard ? (
          <>
            <Header isConnected={isConnected} lastRefresh={lastRefresh} />

            <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full overflow-x-hidden">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading dashboard...</span>
                </div>
              )}

              <StatsPanel machines={machines} overallDailyData={overallDailyData} />

              {/* Efficiency Chart First */}
              <div className="mb-6">
                {efficiencyData.length > 0 && (
                  <EfficiencyChart data={efficiencyData} />
                )}
              </div>

              {/* Production Floor Status Below */}
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                  Production Floor Status
                  <span className="text-xs sm:text-sm font-normal text-gray-500 block sm:inline sm:ml-2">
                    (Click machine for details)
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                  {machines.map((machine) => (
                    <MachineCard
                      key={machine.machine_id}
                      machine={machine}
                      efficiency={efficiencyMap.get(machine.machine_id)}
                      onClick={() => handleMachineClick(machine)}
                    />
                  ))}
                </div>

                {machines.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No machine data available</p>
                  </div>
                )}
              </div>
            </main>
          </>
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
        ) : isMobileProduction ? (
          <MobileProduction />
        ) : activeMenu === 'mobile-remote-setup' ? (
          <MobileRemoteSetup />
        ) : isTrackerApp ? (
          <TrackerApp />
        ) : isUsers ? (
          <UsersMasterForm />
        ) : isFormsMaster ? (
          <FormsMasterForm />
        ) : isUserRights ? (
          <UserRightsForm />
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
      </div>

      {selectedMachine && (
        <MachineDetailModal
          machine={selectedMachine}
          efficiency={efficiencyMap.get(selectedMachine.machine_id)}
          isOpen={!!selectedMachine}
          onClose={handleCloseModal}
        />
      )}
    </div>
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