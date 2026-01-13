import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { StatsPanel } from './components/StatsPanel';
import { MachineCard } from './components/MachineCard';
import { EfficiencyChart } from './components/EfficiencyChart';
import { MachineDetailModal } from './components/MachineDetailModal';
import { useMachineStatus, useEfficiencyReport, useOverallEfficiency } from './hooks/useApi';
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

function Dashboard() {
  const [selectedDate] = React.useState(new Date());
  const [selectedMachine, setSelectedMachine] = React.useState<MachineStatus | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  
  const { 
    data: machines = [], 
    isLoading: machinesLoading, 
    error: machinesError,
    refetch: refetchMachines,
    dataUpdatedAt
  } = useMachineStatus();
  
  const { 
    data: efficiencyData = [], 
    isLoading: efficiencyLoading 
  } = useEfficiencyReport(selectedDate);
  
  const { 
    data: overallEfficiency, 
    isLoading: overallLoading 
  } = useOverallEfficiency(selectedDate);

  // Update last refresh time when data changes
  React.useEffect(() => {
    if (dataUpdatedAt) {
      setLastRefresh(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const isConnected = !machinesError;
  const isLoading = machinesLoading || efficiencyLoading || overallLoading;

  // Create efficiency map for quick lookup
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
    <div className="min-h-screen bg-gray-50">
      <Header isConnected={isConnected} lastRefresh={lastRefresh} />
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading dashboard...</span>
          </div>
        )}

        {/* Stats Panel */}
        <StatsPanel machines={machines} overallEfficiency={overallEfficiency} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Machine Grid */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                Production Floor Status
                <span className="text-xs sm:text-sm font-normal text-gray-500 block sm:inline sm:ml-2">
                  (Click machine for details)
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
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
          </div>

          {/* Efficiency Chart - Desktop Only */}
          <div className="hidden lg:block lg:col-span-1">
            {efficiencyData.length > 0 && (
              <EfficiencyChart data={efficiencyData} />
            )}
          </div>
        </div>

        {/* Mobile Efficiency Chart */}
        <div className="lg:hidden mt-6">
          {efficiencyData.length > 0 && (
            <EfficiencyChart data={efficiencyData} />
          )}
        </div>
      </main>

      {/* Machine Detail Modal */}
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;