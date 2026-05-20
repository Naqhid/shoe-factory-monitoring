import React from 'react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { RefreshCw, ChevronDown, ChevronRight, Clock, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface SessionLogEntry {
  session_id: string;
  machine_id: string;
  machine_name: string;
  work_centre_id: number;
  work_centre_name: string;
  emp_code: string;
  emp_name: string;
  status: string;
  activated_at: string;
  // Production metrics
  total_output: number;
  total_cycles: number;
  total_actual_mins: number;
  total_target_mins: number;
  avg_efficiency: number;
  total_idle_mins: number;
  has_active_cycle?: number;
  last_finish_time: string | null;
}

interface CycleDetail {
  id: number;
  cycle_number: number;
  output_pairs: number;
  target_mins: number;
  actual_mins: number;
  idle_mins: number;
  start_time: string;
  finish_time: string;
  efficiency: number;
}

interface WorkCentre {
  id: number;
  name: string;
}

const LogPage: React.FC = () => {
  const today = new Date().toLocaleDateString('en-CA');
  const [logs, setLogs] = React.useState<SessionLogEntry[]>([]);
  const [workCentres, setWorkCentres] = React.useState<WorkCentre[]>([]);
  const [selectedWorkCentre, setSelectedWorkCentre] = React.useState<string>('all');
  const [selectedDate, setSelectedDate] = React.useState<string>(today);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>('');
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [cycleDetails, setCycleDetails] = React.useState<Record<string, CycleDetail[]>>({});
  const [loadingCycles, setLoadingCycles] = React.useState<Set<string>>(new Set());
  const [reactivatingSessions, setReactivatingSessions] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const fetchWorkCentres = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tv-dashboard/work-centres`);
        const result = await response.json();
        if (result.success) {
          setWorkCentres(result.data || []);
        }
      } catch {
        // Keep page usable even if line list fails
      }
    };

    fetchWorkCentres();
  }, []);

  React.useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (selectedWorkCentre !== 'all') params.set('work_centre_id', selectedWorkCentre);
        if (selectedDate) params.set('date', selectedDate);

        const query = params.toString();
        const response = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/logs${query ? `?${query}` : ''}`);
        const result = await response.json();

        if (result.success) {
          setLogs(result.data || []);
        } else {
          setError(result.message || 'Failed to load machine login logs');
          setLogs([]);
        }
      } catch {
        setError('Unable to fetch machine login logs');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [selectedWorkCentre, selectedDate]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const formatDuration = (mins: number | string | null | undefined) => {
    if (!mins || mins === 0 || mins === '0') return '-';
    const num = typeof mins === 'string' ? parseFloat(mins) : mins;
    if (isNaN(num) || num <= 0) return '-';
    const hours = Math.floor(num / 60);
    const minutes = Math.floor(num % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatNumber = (value: number | string | null | undefined, decimals = 0) => {
    if (!value || value === 0 || value === '0') return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return '-';
    return decimals > 0 ? num.toFixed(decimals) : num.toString();
  };

  const getCycleStatus = (totalCycles: number, status: string, hasActiveCycle?: number) => {
    if (status !== 'active') return `${totalCycles} cycles done`;
    if (!hasActiveCycle) {
      return totalCycles > 0 ? `${totalCycles} cycles done` : 'Session active (no cycle started)';
    }
    const currentCycle = totalCycles + 1;
    const suffix = currentCycle === 1 ? 'st' : currentCycle === 2 ? 'nd' : currentCycle === 3 ? 'rd' : 'th';
    return `${currentCycle}${suffix} cycle in progress`;
  };

  const toggleExpand = async (sessionId: string, log: SessionLogEntry) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
      setExpandedRows(newExpanded);
      return;
    }
    
    // Expand and fetch cycle details if not cached
    newExpanded.add(sessionId);
    setExpandedRows(newExpanded);
    
    if (!cycleDetails[sessionId] && log.total_cycles > 0) {
      setLoadingCycles(prev => new Set(prev).add(sessionId));
      try {
        const params = new URLSearchParams({
          machine_id: log.machine_id,
          emp_code: log.emp_code,
          date: selectedDate
        });
        const response = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/cycles?${params}`);
        const result = await response.json();
        if (result.success) {
          setCycleDetails(prev => ({ ...prev, [sessionId]: result.data }));
        }
      } catch {
        // Silent fail - don't show error for cycle details
      } finally {
        setLoadingCycles(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    }
  };

  const handleReactivate = async (log: SessionLogEntry) => {
    if (!log?.session_id || reactivatingSessions.has(log.session_id)) return;
    setReactivatingSessions((prev) => new Set(prev).add(log.session_id));
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ session_id: log.session_id }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(result.message || 'Session reactivated');
        await handleRefresh();
      } else {
        toast.error(result.message || 'Failed to reactivate session');
      }
    } catch {
      toast.error('Unable to reactivate session');
    } finally {
      setReactivatingSessions((prev) => {
        const next = new Set(prev);
        next.delete(log.session_id);
        return next;
      });
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedWorkCentre !== 'all') params.set('work_centre_id', selectedWorkCentre);
      if (selectedDate) params.set('date', selectedDate);

      const query = params.toString();
      const response = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/logs${query ? `?${query}` : ''}`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.data || []);
      } else {
        setError(result.message || 'Failed to refresh logs');
      }
    } catch {
      setError('Unable to refresh logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Machine Login Logs</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-white border border-gray-200 rounded-lg p-4">
        <div>
          <label htmlFor="lineFilter" className="block text-sm font-medium text-gray-700 mb-1">Line</label>
          <select
            id="lineFilter"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedWorkCentre}
            onChange={(e) => setSelectedWorkCentre(e.target.value)}
          >
            <option value="all">All Lines</option>
            {workCentres.map((line) => (
              <option key={line.id} value={String(line.id)}>{line.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            id="dateFilter"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Line</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Machine</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Login Time</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Activity</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Cycles</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Output (Pairs)</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Efficiency %</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actual Time</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Current Cycle</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-gray-500">Loading logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-gray-500">No login logs found for selected filters.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <React.Fragment key={log.session_id}>
                  <tr 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(log.session_id, log)}
                  >
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <div className="flex items-center gap-1">
                        {expandedRows.has(log.session_id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        {log.work_centre_name || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{log.machine_name || log.machine_id}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{log.emp_name ? `${log.emp_name} (${log.emp_code})` : log.emp_code}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatDateTime(log.activated_at)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatDateTime(log.last_finish_time)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700 text-center">{formatNumber(log.total_cycles)}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-green-700 text-center">{formatNumber(log.total_output)}</td>
                    <td className={`px-3 py-3 text-sm font-semibold text-center ${log.avg_efficiency >= 90 ? 'text-green-600' : log.avg_efficiency >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatNumber(log.avg_efficiency, 1)}{log.avg_efficiency > 0 ? '%' : ''}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 text-center">{formatDuration(log.total_actual_mins)}</td>
                    <td className="px-3 py-3 text-sm text-blue-600 font-medium text-center">
                      {getCycleStatus(log.total_cycles, log.status, log.has_active_cycle)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 capitalize">{log.status}</td>
                    <td className="px-3 py-3 text-sm text-center">
                      {log.status !== 'active' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReactivate(log);
                          }}
                          disabled={reactivatingSessions.has(log.session_id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className={`h-3 w-3 ${reactivatingSessions.has(log.session_id) ? 'animate-spin' : ''}`} />
                          {reactivatingSessions.has(log.session_id) ? 'Reactivating...' : 'Reactivate'}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                  
                  {/* Expanded Cycle Details */}
                  {expandedRows.has(log.session_id) && (
                    <tr className="bg-gray-50">
                      <td colSpan={12} className="px-3 py-3">
                        <div className="ml-6 border-l-2 border-blue-300 pl-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Cycle Details ({log.total_cycles} cycles)
                          </h4>
                          
                          {loadingCycles.has(log.session_id) ? (
                            <p className="text-sm text-gray-500 italic">Loading cycle details...</p>
                          ) : cycleDetails[log.session_id]?.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-600">Cycle</th>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-600">Start Time</th>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-600">Finish Time</th>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-600">Duration</th>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-600">Output</th>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-600">Efficiency</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {cycleDetails[log.session_id].map((cycle) => (
                                    <tr key={cycle.id} className="hover:bg-white">
                                      <td className="px-2 py-2 font-medium text-blue-600">#{cycle.cycle_number}</td>
                                      <td className="px-2 py-2 text-gray-600">{formatDateTime(cycle.start_time)}</td>
                                      <td className="px-2 py-2 text-gray-600">{formatDateTime(cycle.finish_time)}</td>
                                      <td className="px-2 py-2 text-gray-600">{formatDuration(cycle.actual_mins)}</td>
                                      <td className="px-2 py-2 text-gray-600">{cycle.output_pairs} pairs</td>
                                      <td className={`px-2 py-2 font-medium ${cycle.efficiency >= 90 ? 'text-green-600' : cycle.efficiency >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {cycle.efficiency}%
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No cycle details available</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogPage;
