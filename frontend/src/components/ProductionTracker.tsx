import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  ChevronRight,
  RefreshCw,
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

  const loadAlertCardCount = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/alerts?unread_only=false&limit=30`);
      if (!res.ok) return;
      const result = await res.json();
      if (result?.success) {
        const unread = Number(result.unread_count);
        if (Number.isFinite(unread)) {
          setAlertCardCount(unread);
        } else if (Array.isArray(result.data)) {
          // Fallback for older payloads without unread_count.
          const openCount = result.data.filter((row: any) => Number(row.is_read ?? 0) === 0).length;
          setAlertCardCount(openCount);
        }
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
      await Promise.all([loadDashboardData(), loadAttendanceData(), loadAlertCardCount()]);
      toast.success('Dashboard refreshed');
    } finally {
      setManualRefreshing(false);
    }
  };

  useEffect(() => {
    if (workCentres.length > 0 && selectedLine) {
      loadDashboardData();
      loadAttendanceData();
      if (refreshMode === 'manual') return;
      const pollMs = refreshMode === '30s' ? 30000 : 10000;
      const interval = setInterval(() => {
        loadDashboardData();
        loadAttendanceData();
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
              <span className={`px-2 py-0.5 rounded-full border ${isDashboardStale ? 'bg-amber-500/20 text-amber-200 border-amber-300/40' : 'bg-emerald-500/15 text-emerald-200 border-emerald-300/30'}`}>
                Updated {dashboardAgeLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={refreshMode}
                onChange={(e) => setRefreshMode(e.target.value as '10s' | '30s' | 'manual')}
                className="bg-white border border-white/20 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800"
                title="Auto refresh interval"
              >
                <option value="10s" className="text-slate-800">Auto 10s</option>
                <option value="30s" className="text-slate-800">Auto 30s</option>
                <option value="manual" className="text-slate-800">Manual</option>
              </select>
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
              </div>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="bg-white/95 rounded-xl p-2.5 text-slate-900">
              <p className="text-xs font-semibold text-slate-500">Target Risk Projection</p>
              <p className="text-sm font-bold mt-1">
                {shiftProjection.shortfall > 0
                  ? `At current pace: miss by ${shiftProjection.shortfall} pairs`
                  : `At current pace: on track (+${Math.max(0, shiftProjection.projected - Number(topSection?.target || 0))} pairs)`}
              </p>
              <p className="text-xs text-slate-500 mt-1">Shift ends in {shiftProjection.minutesToShiftEnd} min</p>
            </div>
            <div className={`rounded-xl p-2.5 ${attendanceGap > 0 ? 'bg-amber-100/95 text-amber-900' : 'bg-emerald-100/95 text-emerald-900'}`}>
              <p className="text-xs font-semibold">Attendance Signal</p>
              <p className="text-sm font-bold mt-1">
                {attendanceGap > 0
                  ? `${attendanceGap} below target (${attendanceData.present}/${attendanceData.target_employees})`
                  : `On staffing target (${attendanceData.present}/${attendanceData.target_employees})`}
              </p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <input
              value={lineSearch}
              onChange={(e) => setLineSearch(e.target.value)}
              placeholder="Search line..."
              className="rounded-lg px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200"
            />
            <select
              value={lineSort}
              onChange={(e) => setLineSort(e.target.value as 'risk' | 'efficiency' | 'output_gap')}
              className="rounded-lg px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200"
            >
              <option value="risk">Sort: Risk first</option>
              <option value="efficiency">Sort: Efficiency high to low</option>
              <option value="output_gap">Sort: Output gap high to low</option>
            </select>
            <div className="rounded-lg px-3 py-2 text-sm bg-white/90 text-slate-800 border border-slate-200">
              Showing {enrichedLines.length} lines
            </div>
          </div>

          {shiftProjection.inLast60 && attentionQueue.length > 0 && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-2xl p-3 text-slate-900">
              <h4 className="text-sm font-bold text-red-700 mb-2">Attention Queue</h4>
              <div className="space-y-1.5">
                {attentionQueue.map(({ line, riskScore, riskLabel }) => (
                  <button
                    key={`attention-${line.line_name}-${line.work_centre_id || 'x'}`}
                    type="button"
                    onClick={() => {
                      setSelectedLineDetail(line);
                      const wcId = Number(line.work_centre_id || currentWorkCentreId);
                      loadLineMachines(wcId);
                      logAuditEvent('attention_queue_opened', { line: line.line_name, riskScore, riskLabel });
                    }}
                    className="w-full text-left rounded-lg border border-red-100 bg-white px-2.5 py-2 hover:bg-red-50"
                  >
                    <span className="font-semibold text-slate-800">{line.line_name || 'Line'}</span>
                    <span className="ml-2 text-xs text-red-600 font-semibold">{riskLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
                        className="relative bg-slate-50 rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-slate-200 w-full hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center min-h-[132px] sm:min-h-[168px]"
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

              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <div className="bg-white rounded-2xl p-3.5 text-slate-900 shadow-sm min-h-[118px] flex flex-col justify-center">
                  <div className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">Projected Output</div>
                  <div className="text-4xl sm:text-5xl font-bold leading-none">{Number(topSection?.output || 0).toLocaleString()}</div>
                  <div className="mt-1 text-xl sm:text-2xl font-semibold text-slate-600">Pairs</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/alert_center');
                    logAuditEvent('alerts_card_opened', { count: alertCount, selectedLine: currentWorkCentreId, selectedDate });
                  }}
                  className={`bg-white rounded-2xl p-3.5 text-slate-900 shadow-sm flex items-center justify-between min-h-[118px] w-full text-left hover:bg-red-50/40 hover:ring-2 hover:ring-red-200 transition-all ${
                    alertCount > 0 ? 'ring-2 ring-red-200/70 animate-pulse' : ''
                  }`}
                  title="Open Alert Center"
                >
                  <div>
                    <div className="text-4xl sm:text-5xl font-bold text-red-500">{alertCount}</div>
                    <div className="text-lg sm:text-xl font-semibold text-slate-700">Alerts</div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">Tap to open details</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-red-500">
                    <AlertTriangle className="h-10 w-10" />
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </button>
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
    </div>
  );
};
