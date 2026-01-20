import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { StatsPanel } from './components/StatsPanel';
import { MachineCard } from './components/MachineCard';
import { EfficiencyChart } from './components/EfficiencyChart';
import { MachineDetailModal } from './components/MachineDetailModal';
import { ERPApp } from './components/ERPApp';
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

  React.useEffect(() => {
    if (dataUpdatedAt) {
      setLastRefresh(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

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
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full overflow-x-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading dashboard...</span>
          </div>
        )}

        <StatsPanel machines={machines} overallEfficiency={overallEfficiency} />

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
  const [currentApp, setCurrentApp] = React.useState<'dashboard' | 'erp'>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4">
            <div className="flex space-x-4 py-2">
              <button
                onClick={() => setCurrentApp('dashboard')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  currentApp === 'dashboard'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Production Dashboard
              </button>
              <button
                onClick={() => setCurrentApp('erp')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  currentApp === 'erp'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ERP Masters
              </button>
            </div>
          </div>
        </div>

        {currentApp === 'dashboard' ? <Dashboard /> : <ERPApp />}
      </div>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;