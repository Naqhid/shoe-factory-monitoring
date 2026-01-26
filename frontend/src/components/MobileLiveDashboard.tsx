import React from 'react';
import { Play, Square, Zap, TrendingUp, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useMachineStatus, useDailyDashboardData } from '../hooks/useApi';

export const MobileLiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate] = React.useState(new Date());
  const [workCentreFilter, setWorkCentreFilter] = React.useState<number | null>(null);

  const { 
    data: machines = [], 
    isLoading: machinesLoading,
    refetch: refetchMachines
  } = useMachineStatus();

  const {
    data: dashboardData = [],
    isLoading: dashboardLoading
  } = useDailyDashboardData(selectedDate);

  const filteredDashboard = workCentreFilter 
    ? dashboardData.filter(d => d.work_centre_id === workCentreFilter)
    : dashboardData;

  const workCentres = Array.from(new Map(
    dashboardData.map(d => [d.work_centre_id, d.work_centre_name])
  )).map(([id, name]) => ({ id, name }));

  const handleRefresh = () => {
    refetchMachines();
    toast.success('Data refreshed');
  };

  const isLoading = machinesLoading || dashboardLoading;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Live Dashboard</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-6 w-6 text-gray-700 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Date Display */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <p className="text-sm font-medium text-gray-600">
            Date: {selectedDate.toLocaleDateString()} | Time: {selectedDate.toLocaleTimeString()}
          </p>
        </div>

        {/* Work Centre Filter */}
        {workCentres.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Work Centre</label>
            <select
              value={workCentreFilter || ''}
              onChange={(e) => setWorkCentreFilter(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Work Centres</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600">Loading live data...</p>
          </div>
        )}

        {/* Dashboard Cards */}
        {!isLoading && filteredDashboard.length > 0 && (
          <div className="space-y-4">
            {filteredDashboard.map((data) => (
              <div key={data.work_centre_id} className="bg-white rounded-lg shadow-md p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {data.work_centre_name}
                </h2>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {/* Target */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Target</p>
                    <p className="text-2xl font-bold text-blue-600">{data.target}</p>
                  </div>

                  {/* Output */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Output</p>
                    <p className="text-2xl font-bold text-green-600">{data.output}</p>
                  </div>

                  {/* Output % */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Output %</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {data.output_percentage.toFixed(1)}%
                    </p>
                  </div>

                  {/* Efficiency */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Efficiency %</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {data.efficiency_percentage.toFixed(1)}%
                    </p>
                  </div>

                  {/* Employees */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Employees</p>
                    <p className="text-2xl font-bold text-orange-600">{data.employees}</p>
                  </div>

                  {/* SMV */}
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Avg SMV</p>
                    <p className="text-2xl font-bold text-pink-600">
                      {data.smv.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(data.output_percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredDashboard.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No data available for selected filter</p>
          </div>
        )}

        {/* Machine Status Section */}
        {!isLoading && machines.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Machine Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {machines.map((machine) => (
                <div
                  key={machine.machine_id}
                  className={`rounded-lg p-4 ${
                    machine.status === 1
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{machine.machine_id}</p>
                      <p className="text-xs text-gray-600">{machine.event_time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {machine.status === 1 ? (
                        <>
                          <Play className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-600">Running</span>
                        </>
                      ) : (
                        <>
                          <Square className="h-5 w-5 text-red-600" />
                          <span className="font-semibold text-red-600">Idle</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};