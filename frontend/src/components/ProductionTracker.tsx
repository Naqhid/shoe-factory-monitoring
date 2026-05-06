import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  ChevronRight,
  Menu,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  X,
  Home,
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

const SHIFT_START_HOUR = 9;
const SHIFT_END_HOUR = 17;
const SHIFT_END_MINUTE = 30;

export const ProductionTracker: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [workCentres, setWorkCentres] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState({ present: 0, target_employees: 0 });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'trends' | 'reports'>('dashboard');
  const [selectedLineDetail, setSelectedLineDetail] = useState<any | null>(null);
  const [lineMachines, setLineMachines] = useState<any[]>([]);
  const [lineMachinesLoading, setLineMachinesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [dashboardLastUpdated, setDashboardLastUpdated] = useState<Date | null>(null);
  const [alertCardCount, setAlertCardCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSmallScreen, setIsSmallScreen] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [lineSearch, setLineSearch] = useState('');
  const [lineSort, setLineSort] = useState<'risk' | 'efficiency' | 'output_gap'>('risk');
  const [refreshMode, setRefreshMode] = useState<'10s' | '30s' | 'manual'>('10s');
  const [showTrackerNotifications, setShowTrackerNotifications] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [pacingData, setPacingData] = useState<any>(null);

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

  useEffect(() => {
    const loadWorkCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setWorkCentres(result.data);
          setSelectedLine(result.data[0].id.toString());
          setError(null);
          // pacing loads via the useEffect that watches selectedLine
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

  const loadPacingData = async () => {
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      const res = await apiFetch(`${API_BASE}/api/tracker/pacing?date=${selectedDate}&workCentreId=${workCentreId}`);
      if (!res.ok) return;
      const result = await res.json();
      if (result.success) setPacingData(result.data);
    } catch {
      // non-blocking
    }
  };

  const loadAlertCardCount = async () => {
    try {
      // Keep tracker tile count aligned with Realtime Alert Center
      // (same stale-alert filtering + unacknowledged logic).
      let res = await apiFetch(
        `${API_BASE}/api/alerts/center?include_acknowledged=false&limit=1&page=1&date=${selectedDate}`
      );
      if (res.status === 404) {
        // Backward compatibility with older backend.
        res = await apiFetch(`${API_BASE}/api/alerts?unread_only=false&limit=30`);
      }
      if (!res.ok) return;
      const result = await res.json();
      if (!result?.success) return;

      const count = Number(
        result.unacknowledged_count ?? result.unread_count
      );
      if (Number.isFinite(count)) {
        setAlertCardCount(count);
      } else if (Array.isArray(result.data)) {
        const openCount = result.data.filter((row: any) =>
          Number(row.is_acknowledged ?? row.is_read ?? 0) === 0
        ).length;
        setAlertCardCount(openCount);
      }
    } catch {
      // Non-blocking: keep previous card count when alerts API is unavailable.
    }
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
      await Promise.all([loadDashboardData(), loadAttendanceData(), loadAlertCardCount(), loadPacingData()]);
      toast.success('Dashboard refreshed');
    } finally {
      setManualRefreshing(false);
    }
  };

  useEffect(() => {
    if (workCentres.length > 0 && selectedLine) {
      loadDashboardData();
      loadAttendanceData();
      loadPacingData();
      if (refreshMode === 'manual') return;
      const pollMs = refreshMode === '30s' ? 30000 : 10000;
      const interval = setInterval(() => {
        loadDashboardData();
        loadAttendanceData();
        loadPacingData();
      }, pollMs);
      return () => clearInterval(interval);
    }
  }, [selectedDate, selectedLine, workCentres, refreshMode]);

  // Keep alert-card count fresh, but lighter than dashboard polling.
  useEffect(() => {
    if (workCentres.length === 0 || !selectedLine) return;
    loadAlertCardCount();
    const alertInterval = setInterval(() => {
      loadAlertCardCount();
    }, 30000);
    return () => clearInterval(alertInterval);
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
  const topSection = dashboardData?.topSection || {};
  const lowerSection = dashboardData?.lowerSection || {};
  const linePerformance = lowerSection?.linePerformance || [];
  const attendanceGap = Math.max(0, Number(attendanceData.target_employees || 0) - Number(attendanceData.present || 0));
  const dashboardAgeSec = dashboardLastUpdated ? Math.max(0, Math.floor((currentTime.getTime() - dashboardLastUpdated.getTime()) / 1000)) : null;
  const dashboardAgeLabel =
    dashboardAgeSec === null ? '—' :
    dashboardAgeSec < 60 ? `${dashboardAgeSec}s ago` :
    `${Math.floor(dashboardAgeSec / 60)}m ago`;
  const isDashboardStale = dashboardAgeSec !== null && dashboardAgeSec > 30;

  const shiftProjection = React.useMemo(() => {
    const now = currentTime;
    const start = new Date(now);
    start.setHours(SHIFT_START_HOUR, 0, 0, 0);
    const end = new Date(now);
    end.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
    const elapsedMin = Math.max(1, Math.floor((Math.min(now.getTime(), end.getTime()) - start.getTime()) / 60000));
    const shiftMin = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 60000));
    const produced = Number(topSection?.output || 0);
    const target = Number(topSection?.target || 0);
    const projected = Math.round((produced / elapsedMin) * shiftMin);
    const shortfall = Math.max(0, target - projected);
    const minutesToShiftEnd = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
    const inLast60 = minutesToShiftEnd <= 60;
    const inLast30 = minutesToShiftEnd <= 30;
    return { projected, shortfall, minutesToShiftEnd, inLast60, inLast30 };
  }, [currentTime, topSection?.output, topSection?.target]);

  const enrichedLines = React.useMemo(() => {
    const text = lineSearch.trim().toLowerCase();
    const mapped = linePerformance.map((line: any, index: number) => {
      const efficiency = Number(line.efficiency) || 0;
      const target = Number(line.target) || 0;
      const output = Number(line.output) || 0;
      const outputPct = Number(line.output_percentage) || 0;
      const gap = Math.max(0, target - output);
      const warning = shiftProjection.inLast60 && (efficiency < 90 || outputPct < 90 || gap > 0);
      const critical = shiftProjection.inLast30 && (efficiency < 80 || outputPct < 80 || gap > 0);
      const riskScore = critical ? 2 : warning ? 1 : 0;
      const riskLabel = riskScore === 2 ? 'Critical' : riskScore === 1 ? 'At Risk' : 'Monitor';
      return { line, index, efficiency, target, output, outputPct, gap, riskScore, riskLabel };
    });
    const filtered = text
      ? mapped.filter(({ line }: any) => String(line.line_name || '').toLowerCase().includes(text))
      : mapped;
    const sorted = [...filtered].sort((a, b) => {
      if (lineSort === 'efficiency') return b.efficiency - a.efficiency;
      if (lineSort === 'output_gap') return b.gap - a.gap;
      return b.riskScore - a.riskScore;
    });
    return sorted;
  }, [linePerformance, lineSearch, lineSort, shiftProjection.inLast30, shiftProjection.inLast60]);

  const attentionQueue = React.useMemo(() => {
    if (!shiftProjection.inLast60) return [];
    return enrichedLines
      .filter((x) => x.riskScore >= 1)
      .slice(0, 3);
  }, [enrichedLines, shiftProjection.inLast60]);
  const totalWip = linePerformance.reduce((sum: number, line: any) => sum + (Number(line.wip) || 0), 0);
  const outputPercent = Number(topSection?.outputPercent) || 0;
  const efficiencyPercent = Number(topSection?.efficiencyPercent) || 0;
  const efficiencyGaugePercent = Math.min(Math.max(efficiencyPercent, 0), 100);
  const alertCount = alertCardCount;
  const trackerSignalCount = shiftProjection.shortfall > 0 ? 1 : 0;
  const currentWorkCentreId = parseInt(selectedLine, 10) || workCentres[0]?.id || 1;
  const currentWorkCentreName = workCentres.find((wc) => String(wc.id) === String(currentWorkCentreId))?.name || 'Unknown Line';
  const statusDotClass = (efficiency: number) => {
    if (efficiency >= 90) return 'bg-green-500';
    if (efficiency >= 80) return 'bg-yellow-400';
    return 'bg-red-500';
  };

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

  return (
    <div className="min-h-full h-full bg-slate-100 p-1 sm:p-2 lg:p-2 flex flex-col">
      <div className="w-full flex-1 flex flex-col gap-2 sm:gap-3.5">
        {!online && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-red-700">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm font-semibold">Offline mode: live sync paused</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Live refresh issue</p>
                <p className="text-sm text-amber-700">{error}. Showing last available data.</p>
              </div>
              <button
                onClick={loadDashboardData}
                className="text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded w-full sm:w-auto"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Dashboard section below header uses the new mobile card UI */}
        <section className="bg-gradient-to-r from-[#0f2f78] via-[#1847be] to-[#1c3cb5] rounded-[20px] p-1 pb-16 sm:p-3.5 sm:pb-3.5 text-white border border-blue-900/40 shadow-md flex flex-col flex-1 h-full min-h-0">
          <div className="mb-3 sm:mb-2 flex items-center justify-between gap-2 flex-shrink-0 relative">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event('layout:toggle-sidebar'));
                logAuditEvent('sidebar_toggle_clicked', { selectedLine: currentWorkCentreId, selectedDate });
              }}
              className="absolute left-3 top-1 inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/12 hover:bg-white/20"
              title="Toggle sidebar"
            >
              <Menu className="h-8 w-8" />
            </button>
            <div className="text-xs text-slate-200 flex items-center gap-2 min-w-0 pl-10">
              <div className="min-w-0 pl-4">
                <p className="text-sm font-bold leading-none truncate">Prodpulse Factory Production</p>
                <p className="text-[11px] text-emerald-200 flex items-center gap-1 mt-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span>Live Dashboard</span>
                  {dashboardLastUpdated && (
                    <span className="text-slate-200">• {dashboardLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowFilterDrawer(true);
                  logAuditEvent('tracker_filters_opened', { lineSort, lineSearch, selectedLine: currentWorkCentreId, selectedDate });
                }}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-xs font-semibold bg-white/12 hover:bg-white/20"
                title="Open line filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTrackerNotifications((prev) => !prev);
                    logAuditEvent('tracker_notifications_opened', { selectedLine: currentWorkCentreId, selectedDate, trackerSignalCount });
                  }}
                  className="relative inline-flex items-center justify-center h-7 w-7 rounded-md text-xs font-semibold bg-white/12 hover:bg-white/20"
                  title="Production tracker notifications"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {trackerSignalCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold">
                      {trackerSignalCount}
                    </span>
                  )}
                </button>
                {showTrackerNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-[290px] sm:w-[320px] bg-white rounded-xl shadow-xl border border-slate-200 p-2.5 z-40">
                    <div className="space-y-2">
                      {pacingData && pacingData.target > 0 ? (() => {
                        const gap = pacingData.gap;
                        const ahead = gap >= 0;
                        const paceRate = pacingData.pace_rate;
                        const borderColor = paceRate >= 100 ? 'border-green-100' : paceRate >= 85 ? 'border-amber-100' : 'border-red-100';
                        const bgColor = paceRate >= 100 ? 'bg-green-50' : paceRate >= 85 ? 'bg-amber-50' : 'bg-red-50';
                        const barColor = paceRate >= 100 ? 'bg-green-500' : paceRate >= 85 ? 'bg-amber-400' : 'bg-red-500';
                        const labelColor = paceRate >= 100 ? 'text-green-700' : paceRate >= 85 ? 'text-amber-700' : 'text-red-700';
                        return (
                          <div className={`rounded-lg p-2.5 text-slate-900 border ${borderColor} ${bgColor}`}>
                            <p className="text-xs font-semibold text-slate-500">Target Risk Projection</p>
                            <p className="text-sm font-bold mt-1">
                              {shiftProjection.shortfall > 0
                                ? `At current pace: miss by ${shiftProjection.shortfall} pairs`
                                : `At current pace: on track (+${Math.max(0, shiftProjection.projected - Number(topSection?.target || 0))} pairs)`}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Shift ends in {shiftProjection.minutesToShiftEnd} min</p>
                            <p className={`text-sm font-bold mt-2 ${labelColor}`}>
                              {ahead ? `▲ +${gap} ahead` : `▼ ${Math.abs(gap)} behind`} · {paceRate}% of pace
                            </p>
                            <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(paceRate, 100)}%` }} />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {pacingData.actual} / {pacingData.expected_by_now} expected by now
                            </p>
                            <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                              <span>Now: <b className="text-slate-700">{pacingData.current_rate_per_hour}/hr</b></span>
                              <span>Need: <b className="text-slate-700">{pacingData.required_rate_per_hour}/hr</b></span>
                              <span>EOD: <b className="text-slate-700">{pacingData.projected_eod}</b></span>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="bg-slate-50 rounded-lg p-2.5 text-slate-900 border border-slate-100">
                          <p className="text-xs font-semibold text-slate-500">Target Risk Projection</p>
                          <p className="text-sm font-bold mt-1">
                            {shiftProjection.shortfall > 0
                              ? `At current pace: miss by ${shiftProjection.shortfall} pairs`
                              : `At current pace: on track (+${Math.max(0, shiftProjection.projected - Number(topSection?.target || 0))} pairs)`}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Shift ends in {shiftProjection.minutesToShiftEnd} min</p>
                        </div>
                      )}
                      {shiftProjection.inLast60 && attentionQueue.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-2.5 text-slate-900 border border-red-100">
                          <p className="text-xs font-semibold text-red-700 mb-1.5">Attention Queue</p>
                          <div className="space-y-1.5">
                            {attentionQueue.map(({ line, riskScore, riskLabel }) => (
                              <button
                                key={`attention-bell-${line.line_name}-${line.work_centre_id || 'x'}`}
                                type="button"
                                onClick={() => {
                                  setSelectedLineDetail(line);
                                  const wcId = Number(line.work_centre_id || currentWorkCentreId);
                                  loadLineMachines(wcId);
                                  setShowTrackerNotifications(false);
                                  logAuditEvent('attention_queue_opened_from_bell', { line: line.line_name, riskScore, riskLabel });
                                }}
                                className="w-full text-left rounded-lg border border-red-100 bg-white px-2 py-1.5 hover:bg-red-50"
                              >
                                <span className="font-semibold text-slate-800 text-xs">{line.line_name || 'Line'}</span>
                                <span className="ml-2 text-[11px] text-red-600 font-semibold">{riskLabel}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeMobileTab === 'dashboard' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2 h-full">
              <div className="grid grid-cols-4 gap-1 sm:gap-2 auto-rows-[minmax(96px,auto)]">
                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">Today Target</div>
                  <div className="text-lg sm:text-3xl font-bold leading-none">{Number(topSection?.target || 0).toLocaleString()}</div>
                  <div className="text-[11px] sm:text-sm font-semibold text-slate-500">Pairs</div>
                </div>

                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">Produced</div>
                  <div className="text-lg sm:text-3xl font-bold leading-none">{Number(topSection?.output || 0).toLocaleString()}</div>
                  <div className="text-[11px] sm:text-sm font-semibold text-green-600 flex items-center justify-center gap-0.5">
                    <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {outputPercent}%
                  </div>
                </div>

                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-1">Efficiency</div>
                  <div
                    className="h-12 w-12 sm:h-20 sm:w-20 rounded-full grid place-items-center"
                    style={{
                      background: `conic-gradient(#22c55e ${efficiencyGaugePercent * 3.6}deg, #e2e8f0 0deg)`,
                    }}
                  >
                    <div className="h-9 w-9 sm:h-14 sm:w-14 rounded-full bg-white grid place-items-center px-1">
                      <span className={`${efficiencyPercent >= 100 ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'} font-bold leading-none`}>
                        {efficiencyPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">WIP</div>
                  <div className="flex items-center justify-center gap-1 text-lg sm:text-3xl font-bold text-orange-600 leading-none">
                    <Briefcase className="h-4 w-4 sm:h-6 sm:w-6" />
                    <span>{totalWip.toLocaleString()}</span>
                  </div>
                  <div className="text-[11px] sm:text-sm font-semibold text-slate-500">Pairs</div>
                </div>
              </div>

              <div className="bg-[#f7f9ff] rounded-2xl p-2 sm:p-3 text-slate-900 border border-[#dbe5ff] flex flex-col gap-2 min-h-[120px] sm:min-h-[150px] max-h-[40vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <h3 className="text-base sm:text-xl font-bold">Production Lines</h3>
                  <div className="px-2 py-1 rounded-full bg-slate-100 text-[11px] sm:text-sm font-semibold flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
                    <span>Live</span>
                    <span className="text-slate-400">•</span>
                    <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-3">
                    {enrichedLines.map(({ line, index, efficiency, target, output, outputPct, gap, riskScore, riskLabel }) => {
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
                        className="relative bg-white rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-[#d8e3ff] w-full min-h-[100px] sm:min-h-[144px] hover:shadow-md flex flex-col items-center justify-center text-center"
                        >
                          <span className={`absolute top-2 right-2 sm:top-3 sm:right-3 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full ${statusDotClass(efficiency)}`} />
                          <div className="text-xs sm:text-xl font-bold text-slate-800 mb-1 sm:mb-2 leading-tight">
                            {line.line_name || `Line ${index + 1}`}
                          </div>
                          <div className={`text-[10px] sm:text-xs font-semibold mb-1 ${riskScore >= 1 ? 'text-red-600' : 'text-slate-500'}`}>
                            {riskLabel} • Gap {gap}
                          </div>

                          <div className={`text-2xl sm:text-5xl font-extrabold leading-none ${efficiency >= 90 ? 'text-green-600' : efficiency >= 80 ? 'text-amber-500' : 'text-red-500'}`}>
                            {efficiency}%
                          </div>

                          <div className="text-xs sm:text-2xl font-bold text-slate-800 mt-1 sm:mt-2">
                            {output} / {target}
                          </div>

                          <div className="mt-1.5 sm:mt-2 h-1.5 sm:h-2.5 bg-slate-200 rounded-full overflow-hidden w-full">
                            <div
                              className={`h-full rounded-full ${outputPct >= 90 ? 'bg-green-500' : outputPct >= 80 ? 'bg-amber-400' : 'bg-orange-500'}`}
                              style={{ width: `${Math.min(Math.max(outputPct, 0), 100)}%` }}
                            />
                          </div>

                          <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold text-[10px] sm:text-sm">
                            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>WIP {Number(line.wip || 0)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5">
                <div className="bg-[#f7f9ff] rounded-2xl p-2.5 sm:p-3.5 text-slate-900 border border-[#dbe5ff] min-h-[104px] sm:min-h-[clamp(128px,18vh,220px)] flex flex-col justify-center">
                  <div className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">Projected Output</div>
                  <div className="text-3xl sm:text-5xl font-bold leading-none">{Number(topSection?.output || 0).toLocaleString()}</div>
                  <div className="mt-0.5 sm:mt-1 text-lg sm:text-2xl font-semibold text-slate-600">Pairs</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/alert_center');
                    logAuditEvent('alerts_card_opened', { count: alertCount, selectedLine: currentWorkCentreId, selectedDate });
                  }}
                  className={`bg-[#f7f9ff] rounded-2xl p-2.5 sm:p-3.5 text-slate-900 border border-[#dbe5ff] flex items-center justify-between min-h-[92px] sm:min-h-[clamp(120px,16vh,180px)] w-full text-left hover:bg-red-50/40 hover:ring-2 hover:ring-red-200 transition-colors ${
                    alertCount > 0 ? 'ring-2 ring-red-200/70' : ''
                  }`}
                  title="Open Alert Center"
                >
                  <div>
                    <div className="text-3xl sm:text-5xl font-bold text-red-500">{alertCount}</div>
                    <div className="text-base sm:text-xl font-semibold text-slate-700">Alerts</div>
                    <div className="text-[11px] sm:text-sm font-medium text-slate-500 mt-0.5">Tap to open details</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-red-500">
                    <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10" />
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </button>
              </div>
            </div>
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

          {activeMobileTab === 'reports' && (
            <div className="mt-4 bg-white rounded-2xl p-2 sm:p-3 text-slate-900 overflow-x-auto">
              {isSmallScreen && (
                <div className="mb-2 px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
                  Mobile mode: Reports optimized with horizontal scroll.
                </div>
              )}
              <div className={isSmallScreen ? 'min-w-[300px]' : 'min-w-[320px]'}>
                <Reports />
              </div>
            </div>
          )}

          <div className="fixed bottom-1 left-1 right-1 z-30 sm:static sm:mt-auto sm:pt-1.5 sm:left-auto sm:right-auto sm:bottom-auto">
            <div className="w-full bg-[#f5f8ff] rounded-2xl px-2 sm:px-3 py-1.5 text-slate-600 shadow-sm border border-[#dbe5ff]">
              <div className="flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto">
                <button
                  className={`flex flex-col items-center gap-1 rounded-xl py-1 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'dashboard' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600'}`}
                  onClick={() => {
                    setActiveMobileTab('dashboard');
                    logAuditEvent('tab_changed', { tab: 'dashboard' });
                  }}
                  type="button"
                >
                  <Home className="h-4 w-4" />
                  <span className="text-[11px] sm:text-xs">Dashboard</span>
                </button>
                <button
                  className={`flex flex-col items-center gap-1 rounded-xl py-1 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'trends' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600'}`}
                  onClick={() => {
                    setActiveMobileTab('trends');
                    logAuditEvent('tab_changed', { tab: 'trends' });
                  }}
                  type="button"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-[11px] sm:text-xs">Trends</span>
                </button>
                <button
                  className={`flex flex-col items-center gap-1 rounded-xl py-1 px-2 min-w-[64px] transition-colors ${activeMobileTab === 'reports' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600'}`}
                  onClick={() => {
                    setActiveMobileTab('reports');
                    logAuditEvent('tab_changed', { tab: 'reports' });
                  }}
                  type="button"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-[11px] sm:text-xs">Reports</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {selectedLineDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
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
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 font-semibold">Data Freshness</p>
                <p className="text-sm font-bold text-amber-700 mt-1">Dashboard updated {dashboardAgeLabel}</p>
              </div>
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
                  <>
                    <p className="text-xs text-slate-500 mb-2">
                      Bottleneck hint: {lineMachines.filter((m: any) => Number(m.total_output_pairs || 0) === 0).length} idle machines
                    </p>
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
                  </>
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

      {showFilterDrawer && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setShowFilterDrawer(false)}
            className="absolute inset-0 bg-black/35"
            aria-label="Close filters"
          />
          <div className="absolute right-0 top-0 h-full w-[300px] sm:w-[340px] bg-white shadow-2xl border-l border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Line Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilterDrawer(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                aria-label="Close filter panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-800 border border-slate-200 flex items-center justify-between">
                <span className="font-medium">Updated</span>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${isDashboardStale ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                  {dashboardAgeLabel}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Refresh mode</p>
                <select
                  value={refreshMode}
                  onChange={(e) => setRefreshMode(e.target.value as '10s' | '30s' | 'manual')}
                  className="w-full rounded-lg px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200"
                  title="Auto refresh interval"
                >
                  <option value="10s" className="text-slate-800">Auto 10s</option>
                  <option value="30s" className="text-slate-800">Auto 30s</option>
                  <option value="manual" className="text-slate-800">Manual</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={manualRefreshing}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${manualRefreshing ? 'animate-spin' : ''}`} />
                Refresh now
              </button>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Search line</p>
                <input
                  value={lineSearch}
                  onChange={(e) => setLineSearch(e.target.value)}
                  placeholder="Search line..."
                  className="w-full rounded-lg px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Sort order</p>
                <select
                  value={lineSort}
                  onChange={(e) => setLineSort(e.target.value as 'risk' | 'efficiency' | 'output_gap')}
                  className="w-full rounded-lg px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200"
                >
                  <option value="risk">Sort: Risk first</option>
                  <option value="efficiency">Sort: Efficiency high to low</option>
                  <option value="output_gap">Sort: Output gap high to low</option>
                </select>
              </div>

              <div className="rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-800 border border-slate-200">
                Showing {enrichedLines.length} lines
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
