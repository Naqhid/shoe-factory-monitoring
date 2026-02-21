import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Users, AlertCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE } from '../services/api';

interface DashboardSummary {
  actual_pairs: number;
  target_pairs: number;
  efficiency: number;
  present_employees: number;
  target_employees: number;
  status: 'on-track' | 'moderate' | 'low';
  yesterday_efficiency: number;
  week_efficiency: number;
}

interface Workstation {
  station_code: string;
  station_name: string;
  actual_pairs: number;
  target_pairs: number;
  efficiency: number;
}

interface Stoppage {
  stoppage_reason: string;
  total_minutes: number;
  percentage: number;
}

export const ProductionTracker: React.FC = () => {
  const [selectedLine, setSelectedLine] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workCentres, setWorkCentres] = useState<any[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [stoppages, setStoppages] = useState<Stoppage[]>([]);
  const [loading, setLoading] = useState(true);

  // Load work centres
  useEffect(() => {
    const loadWorkCentres = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/masters/work_centres`);
        const result = await response.json();
        if (result.success) {
          setWorkCentres(result.data);
        }
      } catch (error) {
        console.error('Failed to load work centres:', error);
      }
    };
    loadWorkCentres();
  }, [API_BASE]);

  // Load dashboard data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        ...(selectedLine !== 'all' && { workCentreId: selectedLine })
      });

      const [summaryRes, hourlyRes, workstationsRes, stoppagesRes] = await Promise.all([
        fetch(`${API_BASE}/api/tracker/summary?${params}`),
        fetch(`${API_BASE}/api/tracker/hourly?${params}`),
        fetch(`${API_BASE}/api/tracker/workstations?${params}`),
        fetch(`${API_BASE}/api/tracker/stoppages?${params}`)
      ]);

      const [summaryData, hourlyDataRes, workstationsData, stoppagesData] = await Promise.all([
        summaryRes.json(),
        hourlyRes.json(),
        workstationsRes.json(),
        stoppagesRes.json()
      ]);

      if (summaryData.success) setSummary(summaryData.data);
      if (hourlyDataRes.success) setHourlyData(hourlyDataRes.data);
      if (workstationsData.success) setWorkstations(workstationsData.data);
      if (stoppagesData.success) setStoppages(stoppagesData.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadDashboardData, 120000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedLine]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'bg-green-500';
      case 'moderate': return 'bg-orange-500';
      case 'low': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on-track': return '🟢 On-Track';
      case 'moderate': return '🟠 Moderate';
      case 'low': return '🔴 Low';
      default: return 'Unknown';
    }
  };

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Production Tracker</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Line Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Line</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>{wc.name}</option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Output Summary */}
        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Output */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Output</h3>
                <div className="text-3xl font-bold text-blue-600">
                  {summary.actual_pairs} <span className="text-lg text-gray-400">/ {summary.target_pairs}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Actual / Target Pairs</p>
              </div>

              {/* Efficiency */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Efficiency</h3>
                <div className="text-3xl font-bold text-green-600">{summary.efficiency}%</div>
                <p className="text-xs text-gray-500 mt-1">Overall Performance</p>
              </div>

              {/* Attendance */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attendance
                </h3>
                <div className="text-3xl font-bold text-purple-600">
                  {summary.present_employees} <span className="text-lg text-gray-400">/ {summary.target_employees}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Present / Target</p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`${getStatusColor(summary.status)} rounded-lg shadow-md p-4 mb-4 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{getStatusText(summary.status)}</h3>
                  <p className="text-sm opacity-90">Current Production Status</p>
                </div>
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>

            {/* Hourly Performance Chart */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Hourly Performance</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" label={{ value: 'Hour', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Pairs', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Bar dataKey="pairs" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Workstation Performance */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Lowest Efficiency Workstations</h3>
              {workstations.length > 0 ? (
                <div className="space-y-3">
                  {workstations.map((ws, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-gray-900">{ws.station_code} - {ws.station_name}</p>
                        <p className="text-sm text-gray-600">Pairs: {ws.actual_pairs}/{ws.target_pairs}</p>
                      </div>
                      <div className={`text-2xl font-bold ${ws.efficiency < 70 ? 'text-red-600' : ws.efficiency < 90 ? 'text-orange-600' : 'text-green-600'}`}>
                        {ws.efficiency}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No workstation data available</p>
              )}
            </div>

            {/* Top Stoppage Reasons */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Top Stoppage Reasons
              </h3>
              {stoppages.length > 0 ? (
                <div className="space-y-3">
                  {stoppages.map((stop, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{stop.stoppage_reason}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${stop.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-xl font-bold text-red-600">{stop.total_minutes} mins</p>
                        <p className="text-sm text-gray-600">{stop.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No stoppage data available</p>
              )}
            </div>

            {/* Summary Footer */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md p-4 text-white">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm opacity-90">Today</p>
                  <p className="text-2xl font-bold">{summary.efficiency}%</p>
                </div>
                <div>
                  <p className="text-sm opacity-90">Yesterday</p>
                  <p className="text-2xl font-bold flex items-center justify-center gap-1">
                    {summary.yesterday_efficiency}%
                    {summary.yesterday_efficiency < summary.efficiency ? (
                      <TrendingUp className="h-4 w-4 text-green-300" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-300" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-90">Last Week</p>
                  <p className="text-2xl font-bold">{summary.week_efficiency}%</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
