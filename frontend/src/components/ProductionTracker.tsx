import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
  X,
  Home,
  Settings,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';
import { Reports } from './Reports';

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ProductionTracker: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [workCentres, setWorkCentres] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState({ present: 0, target_employees: 0 });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'trends' | 'alerts' | 'reports' | 'settings'>('dashboard');
  const [selectedLineDetail, setSelectedLineDetail] = useState<any | null>(null);
  const [lineMachines, setLineMachines] = useState<any[]>([]);
  const [lineMachinesLoading, setLineMachinesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [stoppageData, setStoppageData] = useState<any[]>([]);
  const [dashboardLastUpdated, setDashboardLastUpdated] = useState<Date | null>(null);
  const [alertsLastUpdated, setAlertsLastUpdated] = useState<Date | null>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSmallScreen, setIsSmallScreen] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [alertActionState, setAlertActionState] = useState<Record<string, { ack?: boolean; escalated?: boolean }>>({});

  const logAuditEvent = (event: string, payload: Record<string, any> = {}) => {
    try {
      const key = 'production_tracker_audit_log_v1';
      const current = JSON.parse(localStorage.getItem(key) || '[]');
      current.unshift({
        event,
        payload,
        at: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(current.slice(0, 200)));
    } catch {
      // non-blocking local audit trail hook
    }
  };

  const buildAlertIssueKey = (item: any, lineId: string | number, date: string) => {
    const reason = String(item?.stoppage_reason || 'unknown').trim().toLowerCase();
    const machine = String(item?.machine_id || item?.machine_name || 'unknown').trim().toLowerCase();
    const emp = String(item?.emp_id || item?.employee_name || 'unknown').trim().toLowerCase();
    return `tracker:${date}:${lineId}:${machine}:${emp}:${reason}`;
  };

  useEffect(() => {
    const loadWorkCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setWorkCentres(result.data);
          setSelectedLine(result.data[0].id.toString());
          setError(null);
        } else {
          setError('No work centres available for production tracker.');
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load work centres:', error);
        setError('Failed to load work centres. Please retry.');
        setLoading(false);
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
    if (!dashboardData) setError(null);
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      const res = await apiFetch(`${API_BASE}/api/tv-dashboard/dashboard/${workCentreId}?date=${selectedDate}`);
      const result = await res.json();
      if (result.success) {
        setDashboardData(result.data);
        setError(null);
        setDashboardLastUpdated(new Date());
      } else {
        setError(result.error || result.message || 'Failed to load data');
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError(error.message || 'Connection error');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadStoppageData = async () => {
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      const res = await apiFetch(`${API_BASE}/api/tracker/stoppages?date=${selectedDate}&workCentreId=${workCentreId}`);
      const result = await res.json();
      if (result.success) {
        const rows = result.data || [];
        setStoppageData(rows);
        setAlertsLastUpdated(new Date());
        const keys = rows.map((item: any) => buildAlertIssueKey(item, workCentreId, selectedDate));
        const actionsRes = await apiFetch(`${API_BASE}/api/tracker/alert-actions/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys })
        });
        const actionsJson = await actionsRes.json();
        if (actionsJson.success) {
          setAlertActionState(actionsJson.data || {});
        }
      }
    } catch {}
  };

  const loadLineMachines = async (workCentreId: number) => {
    setLineMachinesLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/tv-dashboard/machine-centres/${workCentreId}?date=${selectedDate}`);
      const result = await res.json();
      if (result.success) {
        setLineMachines(result.data || []);
      } else {
        setLineMachines([]);
      }
    } catch {
      setLineMachines([]);
    } finally {
      setLineMachinesLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setManualRefreshing(true);
    logAuditEvent('manual_refresh_clicked', { selectedLine, selectedDate });
    try {
      await Promise.all([loadDashboardData(), loadAttendanceData(), loadStoppageData()]);
      toast.success('Dashboard refreshed');
    } finally {
      setManualRefreshing(false);
    }
  };

  useEffect(() => {
    if (workCentres.length > 0 && selectedLine) {
      loadDashboardData();
      loadAttendanceData();
      loadStoppageData();
      const interval = setInterval(() => {
        loadDashboardData();
        loadAttendanceData();
        loadStoppageData();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedDate, selectedLine, workCentres]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast.success('Connection restored');
    };
    const handleOffline = () => {
      setOnline(false);
      toast.error('You are offline. Live data updates paused.');
    };
    const handleResize = () => setIsSmallScreen(window.innerWidth < 768);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
    };
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

  const { topSection, lowerSection } = dashboardData;
  const linePerformance = lowerSection?.linePerformance || [];
  const totalWip = linePerformance.reduce((sum: number, line: any) => sum + (Number(line.wip) || 0), 0);
  const outputPercent = Number(topSection?.outputPercent) || 0;
  const efficiencyPercent = Number(topSection?.efficiencyPercent) || 0;
  const efficiencyGaugePercent = Math.min(Math.max(efficiencyPercent, 0), 100);
  const alertCount = stoppageData.length;
  const currentWorkCentreId = parseInt(selectedLine, 10) || workCentres[0]?.id || 1;
  const currentWorkCentreName = workCentres.find((wc) => String(wc.id) === String(currentWorkCentreId))?.name || 'Unknown Line';
  const statusDotClass = (efficiency: number) => {
    if (efficiency >= 90) return 'bg-green-500';
    if (efficiency >= 80) return 'bg-yellow-400';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-4 lg:p-6">
      <div className="max-w-5xl w-full mx-auto space-y-2.5 sm:space-y-3.5">
        {!online && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-red-700">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm font-semibold">Offline mode: live sync paused</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Live refresh issue</p>
                <p className="text-sm text-amber-700">{error}. Showing last available data.</p>
              </div>
              <button
                onClick={loadDashboardData}
                className="text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Dashboard section below header uses the new mobile card UI */}
        <section className="bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 rounded-3xl p-2.5 sm:p-3.5 text-white border border-blue-900/40 shadow-md">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-200 flex items-center gap-2">
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span>
                Dashboard: {dashboardLastUpdated ? dashboardLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </span>
              {dashboardLastUpdated && (Date.now() - dashboardLastUpdated.getTime() > 30000) && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-300/40">Stale</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={manualRefreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${manualRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="sticky top-2 z-20 mb-3">
            <div className="w-full bg-white rounded-2xl px-2 sm:px-3 py-2 text-slate-600 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto">
              <button
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'dashboard' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600'}`}
                onClick={() => {
                  setActiveMobileTab('dashboard');
                  logAuditEvent('tab_changed', { tab: 'dashboard' });
                }}
                type="button"
              >
                <Home className="h-5 w-5" />
                <span className="text-[11px] sm:text-xs">Dashboard</span>
              </button>
              <button
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'trends' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600'}`}
                onClick={() => {
                  setActiveMobileTab('trends');
                  logAuditEvent('tab_changed', { tab: 'trends' });
                }}
                type="button"
              >
                <TrendingUp className="h-5 w-5" />
                <span className="text-[11px] sm:text-xs">Trends</span>
              </button>
              <button
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'alerts' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600'}`}
                onClick={() => {
                  setActiveMobileTab('alerts');
                  logAuditEvent('tab_changed', { tab: 'alerts' });
                }}
                type="button"
              >
                <Bell className="h-5 w-5" />
                <span className="text-[11px] sm:text-xs">Alerts</span>
              </button>
              <button
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'reports' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600'}`}
                onClick={() => {
                  setActiveMobileTab('reports');
                  logAuditEvent('tab_changed', { tab: 'reports' });
                }}
                type="button"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-[11px] sm:text-xs">Reports</span>
              </button>
              <button
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'settings' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600'}`}
                onClick={() => {
                  setActiveMobileTab('settings');
                  logAuditEvent('tab_changed', { tab: 'settings' });
                }}
                type="button"
              >
                <Settings className="h-5 w-5" />
                <span className="text-[11px] sm:text-xs">Settings</span>
              </button>
              </div>
            </div>
          </div>

          {activeMobileTab === 'dashboard' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
              <div className="bg-white text-slate-900 rounded-2xl p-2.5 shadow-sm flex flex-col items-center justify-center text-center min-h-[118px]">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Today Target</div>
                <div className="text-2xl sm:text-3xl font-bold">{Number(topSection?.target || 0).toLocaleString()}</div>
                <div className="text-xs sm:text-sm font-semibold text-slate-500">Pairs</div>
              </div>

              <div className="bg-white text-slate-900 rounded-2xl p-2.5 shadow-sm flex flex-col items-center justify-center text-center min-h-[118px]">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Produced</div>
                <div className="text-2xl sm:text-3xl font-bold">{Number(topSection?.output || 0).toLocaleString()}</div>
                <div className="text-xs sm:text-sm font-semibold text-green-600 flex items-center justify-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> {outputPercent}%
                </div>
              </div>

              <div className="bg-white text-slate-900 rounded-2xl p-2.5 shadow-sm flex flex-col items-center justify-center text-center min-h-[118px]">
                <div className="text-[11px] font-semibold text-slate-500 mb-2">Efficiency</div>
                <div
                  className="h-20 w-20 rounded-full grid place-items-center"
                  style={{
                    background: `conic-gradient(#22c55e ${efficiencyGaugePercent * 3.6}deg, #e2e8f0 0deg)`,
                  }}
                >
                  <div className="h-14 w-14 rounded-full bg-white grid place-items-center px-1">
                    <span className={`${efficiencyPercent >= 100 ? 'text-xs' : 'text-sm'} font-bold leading-none`}>
                      {efficiencyPercent}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white text-slate-900 rounded-2xl p-2.5 shadow-sm flex flex-col items-center justify-center text-center min-h-[118px]">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">WIP</div>
                <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-bold text-orange-600">
                  <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span>{totalWip.toLocaleString()}</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-500">Pairs</div>
              </div>
            </div>
          )}

          {activeMobileTab === 'dashboard' && (
            <>
              <div className="bg-white/95 rounded-2xl p-3 text-slate-900">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg sm:text-xl font-bold">Production Lines</h3>
                  <div className="px-2.5 py-1 rounded-full bg-slate-100 text-xs sm:text-sm font-semibold flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
                    <span>Live</span>
                    <span className="text-slate-400">•</span>
                    <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {linePerformance.map((line: any, index: number) => {
                    const efficiency = Number(line.efficiency) || 0;
                    const target = Number(line.target) || 0;
                    const output = Number(line.output) || 0;
                    const outputPct = Number(line.output_percentage) || 0;
                    return (
                      <button
                        key={`${line.line_name}-${index}`}
                        type="button"
                        onClick={() => {
                          setSelectedLineDetail(line);
                          const wcId = Number(line.work_centre_id || currentWorkCentreId);
                          loadLineMachines(wcId);
                          logAuditEvent('line_detail_opened', { line: line.line_name, workCentreId: wcId });
                        }}
                        className="relative bg-slate-50 rounded-2xl p-3 border border-slate-200 w-full hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center min-h-[168px]"
                      >
                        <span className={`absolute top-3 right-3 h-3 w-3 rounded-full ${statusDotClass(efficiency)}`} />
                        <div className="text-lg sm:text-xl font-bold text-slate-800 mb-2">{line.line_name || `Line ${index + 1}`}</div>

                        <div className={`text-4xl sm:text-5xl font-extrabold leading-none ${efficiency >= 90 ? 'text-green-600' : efficiency >= 80 ? 'text-amber-500' : 'text-red-500'}`}>
                          {efficiency}%
                        </div>

                        <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-2">
                          {output} / {target}
                        </div>

                        <div className="mt-2 h-2.5 bg-slate-200 rounded-full overflow-hidden w-full">
                          <div
                            className={`h-full rounded-full ${outputPct >= 90 ? 'bg-green-500' : outputPct >= 80 ? 'bg-amber-400' : 'bg-orange-500'}`}
                            style={{ width: `${Math.min(Math.max(outputPct, 0), 100)}%` }}
                          />
                        </div>

                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 font-semibold text-sm">
                          <Briefcase className="h-4 w-4" />
                          <span>WIP: {Number(line.wip || 0)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3">
                <div className="bg-white rounded-2xl p-3.5 text-slate-900 shadow-sm min-h-[118px] flex flex-col justify-center">
                  <div className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">Projected Output</div>
                  <div className="text-4xl sm:text-5xl font-bold leading-none">{Number(topSection?.output || 0).toLocaleString()}</div>
                  <div className="mt-1 text-xl sm:text-2xl font-semibold text-slate-600">Pairs</div>
                </div>
                <div className="bg-white rounded-2xl p-3.5 text-slate-900 shadow-sm flex items-center justify-between min-h-[118px]">
                  <div>
                    <div className="text-4xl sm:text-5xl font-bold text-red-500">{alertCount}</div>
                    <div className="text-lg sm:text-xl font-semibold text-slate-700">Alerts</div>
                  </div>
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
              </div>
            </>
          )}

          {activeMobileTab === 'trends' && (
            <div className="mt-4 bg-white rounded-2xl p-3">
              <HourlyOutputChart
                workCentreId={currentWorkCentreId}
                workCentreName={currentWorkCentreName}
                showProgress={false}
                progress={0}
                date={selectedDate}
              />
            </div>
          )}

          {activeMobileTab === 'alerts' && (
            <div className="mt-4 bg-white rounded-2xl p-4 text-slate-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Current Alerts</h3>
                <span className="text-xs text-slate-500">
                  Updated: {alertsLastUpdated ? alertsLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                </span>
              </div>
              {stoppageData.length === 0 ? (
                <p className="text-slate-500">No alerts right now.</p>
              ) : (
                <div className="space-y-2">
                  {stoppageData.slice(0, 6).map((item: any, idx: number) => (
                    <div key={`${item.stoppage_reason || 'alert'}-${idx}`} className="border border-slate-200 rounded-xl p-3">
                      <p className="font-semibold text-slate-800">{item.stoppage_reason || 'Stoppage'}</p>
                      <p className="text-sm text-slate-500">{item.machine_name || item.machine_id || 'Machine'} • {item.total_minutes || 0} mins</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const issueKey = buildAlertIssueKey(item, currentWorkCentreId, selectedDate);
                            await apiFetch(`${API_BASE}/api/tracker/alert-actions/ack`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ issue_key: issueKey })
                            });
                            setAlertActionState((prev) => ({ ...prev, [issueKey]: { ...prev[issueKey], ack: true } }));
                            logAuditEvent('alert_acknowledged', { index: idx, reason: item.stoppage_reason, machine: item.machine_id || item.machine_name });
                            toast.success('Alert acknowledged');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
                        >
                          Acknowledge
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const issueKey = buildAlertIssueKey(item, currentWorkCentreId, selectedDate);
                            await apiFetch(`${API_BASE}/api/tracker/alert-actions/escalate`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ issue_key: issueKey })
                            });
                            setAlertActionState((prev) => ({ ...prev, [issueKey]: { ...prev[issueKey], escalated: true } }));
                            logAuditEvent('alert_escalated', { index: idx, reason: item.stoppage_reason, machine: item.machine_id || item.machine_name });
                            toast.error('Alert escalated to supervisor queue');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" /> Escalate
                        </button>
                        {alertActionState[buildAlertIssueKey(item, currentWorkCentreId, selectedDate)]?.ack && <span className="text-[11px] text-emerald-600 font-semibold">Acknowledged</span>}
                        {alertActionState[buildAlertIssueKey(item, currentWorkCentreId, selectedDate)]?.escalated && <span className="text-[11px] text-red-600 font-semibold">Escalated</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeMobileTab === 'reports' && (
            <div className="mt-4 bg-white rounded-2xl p-2 sm:p-3 text-slate-900 overflow-x-auto">
              {isSmallScreen && (
                <div className="mb-2 px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
                  Mobile mode: Reports optimized with horizontal scroll.
                </div>
              )}
              <div className={isSmallScreen ? 'min-w-[360px]' : 'min-w-[320px]'}>
                <Reports />
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedLineDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">{selectedLineDetail.line_name || 'Line Details'}</h3>
              <button
                type="button"
                onClick={() => setSelectedLineDetail(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-semibold">Output</p>
                  <p className="text-2xl font-bold text-blue-700">{Number(selectedLineDetail.output || 0)}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-semibold">Target</p>
                  <p className="text-2xl font-bold text-indigo-700">{Number(selectedLineDetail.target || 0)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-semibold">Efficiency</p>
                  <p className="text-2xl font-bold text-green-700">{Number(selectedLineDetail.efficiency || 0)}%</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-semibold">WIP</p>
                  <p className="text-2xl font-bold text-orange-700">{Number(selectedLineDetail.wip || 0)}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 font-semibold mb-1">Output Progress</p>
                <p className="text-lg font-bold text-slate-800 mb-2">
                  {Number(selectedLineDetail.output || 0)} / {Number(selectedLineDetail.target || 0)} ({Number(selectedLineDetail.output_percentage || 0)}%)
                </p>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${Math.min(Math.max(Number(selectedLineDetail.output_percentage || 0), 0), 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 font-semibold mb-2">Live Machine Status</p>
                {lineMachinesLoading ? (
                  <p className="text-sm text-slate-500">Loading machines...</p>
                ) : lineMachines.length === 0 ? (
                  <p className="text-sm text-slate-500">No machine data available.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
                    {lineMachines.slice(0, 10).map((machine: any, idx: number) => (
                      <div key={`${machine.machine_id || idx}`} className="flex items-center justify-between text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold text-slate-700">
                          {machine.machine_id || '—'}
                          {(machine.machine_name || machine.machine_centre_name || machine.name) && (
                            <span className="text-slate-500 font-medium"> - {machine.machine_name || machine.machine_centre_name || machine.name}</span>
                          )}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          Number(machine.total_output_pairs || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {Number(machine.total_output_pairs || 0) > 0 ? 'Active' : 'Idle'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveMobileTab('trends');
                  setSelectedLineDetail(null);
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                View Hourly Trend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
