import React from 'react';
import { API_BASE_URL } from '../services/api';

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
  last_finish_time: string | null;
}

interface WorkCentre {
  id: number;
  name: string;
}

const today = new Date().toISOString().split('T')[0];

const LogPage: React.FC = () => {
  const [logs, setLogs] = React.useState<SessionLogEntry[]>([]);
  const [workCentres, setWorkCentres] = React.useState<WorkCentre[]>([]);
  const [selectedWorkCentre, setSelectedWorkCentre] = React.useState<string>('all');
  const [selectedDate, setSelectedDate] = React.useState<string>(today);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>('');

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
        const response = await fetch(`${API_BASE_URL}/api/mobile-sessions/logs${query ? `?${query}` : ''}`);
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
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Idle Time</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-gray-500">Loading logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-gray-500">No login logs found for selected filters.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.session_id}>
                  <td className="px-3 py-3 text-sm text-gray-700">{log.work_centre_name || '-'}</td>
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
                  <td className="px-3 py-3 text-sm text-red-600 text-center">{formatDuration(log.total_idle_mins)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700 capitalize">{log.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogPage;
