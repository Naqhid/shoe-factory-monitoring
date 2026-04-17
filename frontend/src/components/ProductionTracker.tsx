import React, { useState, useEffect } from 'react';
import { Smile, Frown, Meh, TrendingUp, Target, Zap, Activity, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';



export const ProductionTracker: React.FC = () => {
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [workCentres, setWorkCentres] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState({ present: 0, target_employees: 0 });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [reworkSummary, setReworkSummary] = useState<Record<number, { total_rework: number; total_rejection: number }>>({});
  const [activeTab, setActiveTab] = useState<'line' | 'machine'>('line');
  const [allMachineData, setAllMachineData] = useState<any[]>([]);
  const [machineTabLoading, setMachineTabLoading] = useState(false);
  const [stoppageData, setStoppageData] = useState<any[]>([]);

  useEffect(() => {
    const loadWorkCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setWorkCentres(result.data);
          setSelectedLine(result.data[0].id.toString());
        }
      } catch (error) {
        console.error('Failed to load work centres:', error);
      }
    };
    loadWorkCentres();
  }, []);

  const [error, setError] = useState<string | null>(null);

  const loadAttendanceData = async () => {
    setAttendanceLoading(true);
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      // Get attendance directly from mobile sessions
      const attendanceResponse = await apiFetch(`${API_BASE}/api/mobile-sessions/attendance/${workCentreId}?date=${selectedDate}`);
      if (attendanceResponse.ok) {
        const attendanceResult = await attendanceResponse.json();
        if (attendanceResult.success) {
          setAttendanceData({
            present: attendanceResult.data.present || 0,
            target_employees: attendanceResult.data.target || 3
          });
          return;
        }
      }
      
      // Fallback to TV dashboard API
      const response = await apiFetch(`${API_BASE}/api/tv-dashboard/dashboard/${workCentreId}?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setAttendanceData({
          present: result.data.middleSection?.present || 0,
          target_employees: result.data.middleSection?.target_employees || 0
        });
      }
    } catch (error) {
      console.error('Failed to load attendance data:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (!dashboardData) setLoading(true);
    setError(null);
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      const [res, reworkRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/tv-dashboard/dashboard/${workCentreId}?date=${selectedDate}`),
        apiFetch(`${API_BASE}/api/rework-rejection/summary?date=${selectedDate}`),
      ]);
      const result = await res.json();
      const reworkResult = await reworkRes.json();
      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.error || 'Failed to load data');
      }
      if (reworkResult.success) {
        const map: Record<number, { total_rework: number; total_rejection: number }> = {};
        reworkResult.data.forEach((r: any) => { map[r.work_centre_id] = r; });
        setReworkSummary(map);
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError(error.message || 'Connection error');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadAllMachineData = async () => {
    setMachineTabLoading(true);
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      const res = await apiFetch(`${API_BASE}/api/tv-dashboard/machine-centres/${workCentreId}?date=${selectedDate}`);
      const result = await res.json();
      if (result.success) setAllMachineData(result.data);
    } catch {}
    finally { setMachineTabLoading(false); }
  };

  const loadStoppageData = async () => {
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      const res = await apiFetch(`${API_BASE}/api/tracker/stoppages?date=${selectedDate}&workCentreId=${workCentreId}`);
      const result = await res.json();
      if (result.success) setStoppageData(result.data);
    } catch {}
  };

  useEffect(() => {
    if (workCentres.length > 0 && selectedLine) {
      setAllMachineData([]);
      loadDashboardData();
      loadAttendanceData();
      loadAllMachineData();
      loadStoppageData();
      const interval = setInterval(() => {
        loadDashboardData();
        loadAttendanceData();
        loadAllMachineData();
        loadStoppageData();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedDate, selectedLine, workCentres]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);



  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-sm w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadDashboardData}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { topSection, middleSection, lowerSection } = dashboardData;
  const currentWorkCentreId = parseInt(selectedLine) || workCentres[0]?.id || 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with filters */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Production Tracker</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Line</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>{wc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Attendance</label>
              <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${
                !attendanceLoading && attendanceData.present < (attendanceData as any).target_employees
                  ? 'bg-red-50 border-red-300'
                  : 'bg-purple-50 border-purple-200'
              }`}>
                <Users className={`h-5 w-5 ${!attendanceLoading && attendanceData.present < (attendanceData as any).target_employees ? 'text-red-600' : 'text-purple-600'}`} />
                {attendanceLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                    <span className="text-sm text-gray-600">Loading...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-2xl font-bold ${attendanceData.present < (attendanceData as any).target_employees ? 'text-red-600' : 'text-purple-600'}`}>
                      {attendanceData.present} / {(attendanceData as any).target_employees}
                    </span>
                    <span className="text-sm text-gray-600">Present / Target</span>
                    {attendanceData.present < (attendanceData as any).target_employees && (
                      <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                        ⚠ {(attendanceData as any).target_employees - attendanceData.present} absent
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top Section - Overall Performance */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-2xl p-6 mb-4">
          <h2 className="text-white text-2xl font-bold mb-4">Overall Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <Target className="h-10 w-10 text-white mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Target</div>
              <div className="text-white text-3xl font-bold">{topSection.target}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <TrendingUp className="h-10 w-10 text-green-300 mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Output</div>
              <div className="text-white text-3xl font-bold">{topSection.output}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <Activity className="h-10 w-10 text-purple-300 mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Output %</div>
              <div className={`text-3xl font-bold ${topSection.outputPercent >= 90 ? 'text-green-300' : topSection.outputPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                {topSection.outputPercent}%
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <Zap className="h-10 w-10 text-yellow-300 mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Efficiency %</div>
              <div className={`text-3xl font-bold ${topSection.efficiencyPercent >= 90 ? 'text-green-300' : topSection.efficiencyPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                {topSection.efficiencyPercent}%
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 flex items-center justify-center">
              {topSection.showHappyEmoji ? (
                <Smile className="h-20 w-20 text-green-300 animate-pulse" />
              ) : topSection.showMediumEmoji ? (
                <Meh className="h-20 w-20 text-yellow-300" />
              ) : (
                <Frown className="h-20 w-20 text-red-300" />
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-2xl mb-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('line')}
              className={`px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'line' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Line Performance
            </button>
            <button
              onClick={() => setActiveTab('machine')}
              className={`px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'machine' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Machine Performance
            </button>
          </div>

          {/* LINE PERFORMANCE Tab */}
          {activeTab === 'line' && (
        <div className="p-6">
          <h3 className="text-2xl font-bold text-blue-600 mb-4">LINE PERFORMANCE</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">LINE</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">TARGET</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT %</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">EFFICIENCY %</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">WIP</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-yellow-600">REWORK</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-red-600">REJECTION</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {lowerSection.linePerformance?.filter((line: any) => line.work_centre_id === currentWorkCentreId).map((line: any, index: number) => {
                  const getStatusColor = (eff: number) => {
                    if (eff >= 95) return 'bg-green-500';
                    if (eff >= 85) return 'bg-yellow-500';
                    return 'bg-red-500';
                  };
                  const rw = reworkSummary[line.work_centre_id] || { total_rework: 0, total_rejection: 0 };
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-semibold text-gray-800">{line.line_name}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-blue-600">{line.target}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-green-600">{line.output}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-purple-600">{line.output_percentage}%</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-orange-600">{line.efficiency}%</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-red-600">{line.wip || 0}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-yellow-600">{rw.total_rework}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-red-600">{rw.total_rejection}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <div className={`w-4 h-4 rounded-full ${getStatusColor(line.efficiency)}`}></div>
                          <div className={`w-4 h-4 rounded-full ${getStatusColor(line.efficiency)}`}></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          )}

          {/* MACHINE PERFORMANCE Tab */}
          {activeTab === 'machine' && (
        <div className="p-6">
          <h3 className="text-2xl font-bold text-blue-600 mb-4">MACHINE PERFORMANCE</h3>
          {machineTabLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600">Loading machine data...</span>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">MACHINE</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">MACHINE ID</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">EMPLOYEE</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">EMP CODE</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT (PAIRS)</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">TARGET (MINS/BOX)</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {allMachineData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No machine data for selected line and date</td>
                  </tr>
                ) : allMachineData.map((m: any, index: number) => {
                  const hasOutput = m.total_output_pairs > 0;
                  const hasTarget = m.target_mins_per_box > 0;
                  const statusColor = !hasOutput ? 'bg-red-500' : hasTarget ? 'bg-green-500' : 'bg-yellow-500';
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-semibold text-gray-800">{m.machine_centre_name}</td>
                      <td className="px-4 py-4 text-center font-mono text-gray-500">{m.machine_id}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-700">{m.emp_name || '—'}</td>
                      <td className="px-4 py-4 text-center font-mono text-sm text-gray-500">{m.emp_code || '—'}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-green-600">{m.total_output_pairs}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-blue-600">
                        {m.target_mins_per_box > 0 ? `${m.target_mins_per_box} mins` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <div className={`w-4 h-4 rounded-full ${statusColor}`}></div>
                          <div className={`w-4 h-4 rounded-full ${statusColor}`}></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
          )}
        </div>

        {/* Bottom Section - Charts */}
        <div className="space-y-4">
          <HourlyOutputChart 
            workCentreId={currentWorkCentreId} 
            workCentreName={workCentres.find(wc => wc.id == selectedLine)?.name || 'Unknown Line'}
            showProgress={false}
            progress={0}
            date={selectedDate}
          />

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-red-600" />
              Top 3 Bottleneck Machines
            </h3>
            {lowerSection.bottlenecks.length > 0 ? (
              <div className="space-y-4">
                {lowerSection.bottlenecks.map((item: any, index: number) => (
                  <div key={index} className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-red-600 font-bold text-lg bg-white px-2 py-1 rounded">#{index + 1}</span>
                        <div className="flex-1">
                          <div className="text-gray-800 font-bold text-lg">{item.machine_centre_name}</div>
                          <div className="text-gray-600 text-sm">{item.work_centre_name}</div>
                          <div className="text-blue-600 text-sm font-medium">WIP: {item.wip || 0}</div>
                        </div>
                      </div>
                      <div className="text-red-600 text-3xl font-bold bg-white px-3 py-1 rounded-lg">{item.efficiency}%</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  <Smile className="h-16 w-16 mx-auto mb-4 text-green-400" />
                  <div className="text-xl">No Bottlenecks - All machines performing well!</div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-2xl font-bold text-orange-600 mb-4 flex items-center gap-2">
              ⏸ Stoppage Reasons Today
            </h3>
            {stoppageData.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-sm">No stoppages recorded today</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {stoppageData.map((item: any, index: number) => (
                  <div key={index} className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                    {/* Top row: rank + reason + duration badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full">#{index + 1}</span>
                        <span className="text-sm font-bold text-gray-800">{item.stoppage_reason}</span>
                      </div>
                      <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {item.total_minutes} min · {item.occurrences}x
                      </span>
                    </div>
                    {/* Detail chips */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                        🖥️ {item.machine_name || item.machine_id}
                      </span>
                      {item.employee_name && (
                        <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                          👤 {item.employee_name}
                        </span>
                      )}
                      {item.last_stopped_at && (
                        <span className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg">
                          🕐 {new Date(item.last_stopped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${Math.min(item.percentage || 0, 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-orange-600 w-10 text-right">{item.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
