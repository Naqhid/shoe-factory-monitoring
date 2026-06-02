import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowDownToLine,
  BarChart3,
  Bell,
  Menu,
  PackageOpen,
  RefreshCw,
  SlidersHorizontal,
  Target,
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
import { formatInput, formatWip } from '../utils/wipUtils';
import { buildMachinePaceSnapshot, getProductiveShiftTotals, SHIFT_END_MINUTES, SHIFT_START_MINUTES } from '../utils/shiftPaceUtils';

const lineCardWipClass = (wip: number, target: number): string => {
  if (target <= 0) return 'text-slate-600';
  const ratio = wip / target;
  if (ratio > 0.5) return 'text-orange-600';
  if (ratio > 0.25) return 'text-amber-600';
  return 'text-emerald-600';
};

const getLineShiftPace = (target: number, output: number, now: Date) => {
  const { totalProductiveMins, elapsedProductiveMins } = getProductiveShiftTotals(now);
  const daily = Math.round(target);
  const actual = Math.round(output);
  const elapsed = Math.max(0, elapsedProductiveMins);
  const expected =
    elapsed > 0 && daily > 0 && totalProductiveMins > 0
      ? Math.round((daily * elapsed) / totalProductiveMins)
      : 0;
  const projectedEod =
    elapsed > 0 && totalProductiveMins > 0
      ? Math.round((actual / elapsed) * totalProductiveMins)
      : 0;
  const pacePct = expected > 0 ? Math.round((actual / expected) * 100) : null;
  return { expected, projectedEod, pacePct, daily, actual };
};

const paceEfficiencyCircleClass = (pct: number | null): string => {
  if (pct == null) return 'bg-slate-300 ring-slate-400/50';
  if (pct > 90) return 'bg-emerald-500 ring-emerald-600/50';
  if (pct >= 70) return 'bg-orange-400 ring-orange-500/50';
  if (pct >= 50) return 'bg-amber-400 ring-amber-500/50';
  return 'bg-red-500 ring-red-600/50';
};

const LinePaceEodEffBlock: React.FC<{
  actual: number;
  expected: number;
  projectedEod: number;
  daily: number;
  pacePct: number | null;
}> = ({ actual, expected, projectedEod, daily, pacePct }) => {
  const paceBehind = expected > 0 && actual < expected;
  const eodBehind = daily > 0 && projectedEod < daily;
  const numClass = 'text-sm sm:text-lg font-black tabular-nums leading-none';
  const slashClass = 'text-xs sm:text-base font-black text-slate-800 leading-none';
  const effLabel =
    pacePct != null
      ? `In progress ${pacePct}% (${actual} / ${expected} target so far)`
      : 'No target set for progress';
  const effTextClass =
    pacePct != null && pacePct >= 100
      ? 'text-sm sm:text-base'
      : 'text-base sm:text-lg';

  const metricTileClass =
    'rounded-lg border border-slate-200 bg-slate-50/80 px-1 py-1 sm:px-1.5 sm:py-1.5 min-h-0 flex flex-col justify-center flex-1';
  const labelClass =
    'text-[9px] sm:text-[10px] font-extrabold uppercase text-center mb-0.5 sm:mb-1';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] w-full gap-1 sm:gap-1.5 mt-1 sm:mt-1.5 items-stretch min-h-[5.25rem] sm:min-h-[6.5rem]">
      <div className="flex flex-col gap-1 min-w-0 min-h-0">
        <div className={metricTileClass}>
          <div className={`${labelClass} text-emerald-700`}>In progress</div>
          <div className="flex items-baseline justify-center gap-0.5 tabular-nums">
            {expected > 0 ? (
              <>
                <span className={`${numClass} ${paceBehind ? 'text-red-600' : 'text-emerald-700'}`}>{actual}</span>
                <span className={slashClass}>/</span>
                <span className={`${numClass} text-slate-900`}>{expected}</span>
              </>
            ) : (
              <span className={`${numClass} text-slate-700`}>{actual}</span>
            )}
          </div>
        </div>
        <div className={metricTileClass}>
          <div className={`${labelClass} text-blue-700`}>EOD</div>
          <div className="flex items-baseline justify-center gap-0.5 tabular-nums">
            {daily > 0 ? (
              <>
                <span className={`${numClass} ${eodBehind ? 'text-red-600' : 'text-blue-700'}`}>{projectedEod}</span>
                <span className={slashClass}>/</span>
                <span className={`${numClass} text-indigo-900`}>{daily}</span>
              </>
            ) : (
              <span className={`${numClass} text-slate-400`}>—</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center self-stretch shrink-0 px-0.5 sm:px-1 min-w-[4rem] sm:min-w-[5rem]">
        <span
          className={`inline-flex shrink-0 size-[clamp(4rem,14vw,5rem)] items-center justify-center rounded-full ring-2 ring-white shadow-md font-black tabular-nums leading-none text-white ${paceEfficiencyCircleClass(pacePct)}`}
          title={effLabel}
          aria-label={effLabel}
        >
          <span className={effTextClass}>{pacePct != null ? `${pacePct}%` : '—'}</span>
        </span>
      </div>
    </div>
  );
};

/** Compact Progress / EOD / efficiency on one row (line detail — machine wise). */
const MachinePaceInlineRow: React.FC<{
  actual: number;
  expected: number;
  projectedEod: number;
  daily: number;
  pacePct: number | null;
}> = ({ actual, expected, projectedEod, daily, pacePct }) => {
  const paceBehind = expected > 0 && actual < expected;
  const eodBehind = daily > 0 && projectedEod < daily;
  const numClass = 'text-sm font-black tabular-nums leading-none';
  const slashClass = 'text-xs font-black text-slate-800 leading-none';
  const labelClass = 'text-[9px] font-extrabold uppercase leading-none';
  const effLabel =
    pacePct != null
      ? `In progress ${pacePct}% (${actual} / ${expected} target so far)`
      : 'No target set for progress';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] w-full items-center gap-0 border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="min-w-0 border-r border-slate-200 px-1 py-1 text-center">
        <div className={`${labelClass} text-emerald-700`}>In progress</div>
        <div className="flex items-baseline justify-center gap-0.5 tabular-nums mt-0.5">
          {expected > 0 ? (
            <>
              <span className={`${numClass} ${paceBehind ? 'text-red-600' : 'text-emerald-700'}`}>{actual}</span>
              <span className={slashClass}>/</span>
              <span className={`${numClass} text-slate-900`}>{expected}</span>
            </>
          ) : (
            <span className={`${numClass} text-slate-700`}>{actual}</span>
          )}
        </div>
      </div>
      <div className="min-w-0 border-r border-slate-200 px-1 py-1 text-center">
        <div className={`${labelClass} text-blue-700`}>EOD</div>
        <div className="flex items-baseline justify-center gap-0.5 tabular-nums mt-0.5">
          {daily > 0 ? (
            <>
              <span className={`${numClass} ${eodBehind ? 'text-red-600' : 'text-blue-700'}`}>{projectedEod}</span>
              <span className={slashClass}>/</span>
              <span className={`${numClass} text-indigo-900`}>{daily}</span>
            </>
          ) : (
            <span className={`${numClass} text-slate-400`}>—</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center shrink-0 px-1 py-0.5">
        <span
          className={`inline-flex size-9 items-center justify-center rounded-full ring-1 ring-white shadow font-black tabular-nums text-xs text-white ${paceEfficiencyCircleClass(pacePct)}`}
          title={effLabel}
          aria-label={effLabel}
        >
          {pacePct != null ? `${pacePct}%` : '—'}
        </span>
      </div>
    </div>
  );
};

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ProductionTracker: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [workCentres, setWorkCentres] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState({ present: 0, target_employees: 0 });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'trends' | 'reports'>('dashboard');
  const [selectedLineDetail, setSelectedLineDetail] = useState<any | null>(null);
  const [detailMachineRows, setDetailMachineRows] = useState<any[]>([]);
  const [detailMachinesLoading, setDetailMachinesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [dashboardLastUpdated, setDashboardLastUpdated] = useState<Date | null>(null);
  const [alertCardCount, setAlertCardCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSmallScreen, setIsSmallScreen] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [lineSearch, setLineSearch] = useState('');
  const [lineSort, setLineSort] = useState<'risk' | 'efficiency' | 'output_gap'>('risk');
  const [refreshMode, setRefreshMode] = useState<'10s' | '30s' | 'manual'>('10s');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

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
    start.setHours(Math.floor(SHIFT_START_MINUTES / 60), SHIFT_START_MINUTES % 60, 0, 0);
    const end = new Date(now);
    end.setHours(Math.floor(SHIFT_END_MINUTES / 60), SHIFT_END_MINUTES % 60, 0, 0);
    const { totalProductiveMins, elapsedProductiveMins } = getProductiveShiftTotals(now);
    const elapsedMin = Math.max(1, elapsedProductiveMins);
    const produced = Number(topSection?.output || 0);
    const target = Number(topSection?.target || 0);
    const projected =
      totalProductiveMins > 0 ? Math.round((produced / elapsedMin) * totalProductiveMins) : 0;
    const shortfall = Math.max(0, target - projected);
    const minutesToShiftEnd = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
    const inLast60 = minutesToShiftEnd <= 60;
    const inLast30 = minutesToShiftEnd <= 30;
    return { projected, shortfall, minutesToShiftEnd, inLast60, inLast30 };
  }, [currentTime, topSection?.output, topSection?.target]);

  const enrichedLines = React.useMemo(() => {
    const text = lineSearch.trim().toLowerCase();
    const mapped = linePerformance.map((line: any, index: number) => {
      const target = Number(line.target) || 0;
      const output = Number(line.output) || 0;
      const outputPct =
        target > 0
          ? Math.round(
              Number(
                line.output_percentage ?? (output / target) * 100
              )
            )
          : 0;
      const gap = Math.max(0, target - output);
      const warning = shiftProjection.inLast60 && (outputPct < 90 || gap > 0);
      const critical = shiftProjection.inLast30 && (outputPct < 80 || gap > 0);
      const riskScore = critical ? 2 : warning ? 1 : 0;
      const riskLabel = riskScore === 2 ? 'Critical' : riskScore === 1 ? 'At Risk' : 'Monitor';
      const { expected, projectedEod, pacePct } = getLineShiftPace(target, output, currentTime);
      return {
        line,
        index,
        target,
        output,
        outputPct,
        gap,
        riskScore,
        riskLabel,
        expected,
        projectedEod,
        pacePct,
      };
    });
    const filtered = text
      ? mapped.filter(({ line }: any) => String(line.line_name || '').toLowerCase().includes(text))
      : mapped;
    const sorted = [...filtered].sort((a, b) => {
      if (lineSort === 'efficiency') return b.outputPct - a.outputPct;
      if (lineSort === 'output_gap') return b.gap - a.gap;
      return b.riskScore - a.riskScore;
    });
    return sorted;
  }, [linePerformance, lineSearch, lineSort, shiftProjection.inLast30, shiftProjection.inLast60, currentTime]);

  const totalWip = linePerformance.reduce((sum: number, line: any) => sum + (Number(line.wip) || 0), 0);
  const lineInputPercent = selectedLineDetail && Number(selectedLineDetail.target || 0) > 0
    ? Math.round((Number(selectedLineDetail.input || 0) / Number(selectedLineDetail.target || 0)) * 100)
    : 0;
  const lineOutputPercent = selectedLineDetail
    ? Math.round(
        Number(
          selectedLineDetail.output_percentage ??
            (Number(selectedLineDetail.target || 0) > 0
              ? (Number(selectedLineDetail.output || 0) / Number(selectedLineDetail.target || 0)) * 100
              : 0)
        )
      )
    : 0;
  const efficiencyPctColor = (pct: number) =>
    pct >= 90 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-500';
  const outputPercent = Number(topSection?.outputPercent) || 0;
  const efficiencyPercent = Number(topSection?.efficiencyPercent) || 0;
  const efficiencyGaugePercent = Math.min(Math.max(efficiencyPercent, 0), 100);
  const overallInputPercent = Number(topSection?.target || 0) > 0
    ? Math.round((Number(topSection?.input || 0) / Number(topSection?.target || 0)) * 100)
    : 0;
  const alertCount = alertCardCount;
  const currentWorkCentreId = parseInt(selectedLine, 10) || workCentres[0]?.id || 1;
  const currentWorkCentreName = workCentres.find((wc) => String(wc.id) === String(currentWorkCentreId))?.name || 'Unknown Line';
  const detailRouteMatch = location.pathname.match(/^\/production_tracker\/line\/([^/]+)$/);
  const detailWorkCentreId = detailRouteMatch ? Number(detailRouteMatch[1]) : NaN;
  const isDetailRoute = Number.isFinite(detailWorkCentreId);

  useEffect(() => {
    if (!isDetailRoute) {
      if (selectedLineDetail) setSelectedLineDetail(null);
      return;
    }
    const detailLine = linePerformance.find((line: any) => Number(line.work_centre_id) === detailWorkCentreId) || null;
    if (detailLine) {
      if (!selectedLineDetail || Number(selectedLineDetail.work_centre_id) !== detailWorkCentreId) {
        setSelectedLineDetail(detailLine);
      }
    } else if (selectedLineDetail) {
      setSelectedLineDetail(null);
    }
  }, [isDetailRoute, detailWorkCentreId, linePerformance, selectedLineDetail]);

  useEffect(() => {
    if (!isDetailRoute || !Number.isFinite(detailWorkCentreId)) {
      setDetailMachineRows([]);
      return;
    }
    let cancelled = false;
    const loadDetailMachines = async () => {
      setDetailMachinesLoading(true);
      try {
        const res = await apiFetch(
          `${API_BASE}/api/tv-dashboard/machine-centres/${detailWorkCentreId}?date=${selectedDate}`
        );
        const result = await res.json();
        if (!cancelled) {
          setDetailMachineRows(result.success ? result.data || [] : []);
        }
      } catch {
        if (!cancelled) setDetailMachineRows([]);
      } finally {
        if (!cancelled) setDetailMachinesLoading(false);
      }
    };
    loadDetailMachines();
    return () => {
      cancelled = true;
    };
  }, [isDetailRoute, detailWorkCentreId, selectedDate, dashboardLastUpdated]);

  const detailMachineSnapshots = useMemo(
    () =>
      [...detailMachineRows]
        .map((row: any) =>
          buildMachinePaceSnapshot(
            String(row.machine_id),
            row.machine_name || row.machine_centre_name || String(row.machine_id),
            Number(row.total_output_pairs || 0),
            Number(row.target_mins_per_box || 0),
            currentTime
          )
        )
        .sort((a, b) =>
          String(a.machineId).localeCompare(String(b.machineId), undefined, { numeric: true })
        ),
    [detailMachineRows, currentTime]
  );

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

  if (isDetailRoute && selectedLineDetail) {
    return (
      <div className="min-h-full h-full bg-slate-100 p-1 sm:p-2 lg:p-3">
        <div className="w-full max-w-7xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="flex items-baseline gap-2 min-w-0 flex-1 flex-wrap">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                {selectedLineDetail.line_name || 'Line Details'}
              </h3>
              <span className="text-xs text-slate-500 shrink-0">
                Last updated{' '}
                <span className={`font-semibold ${isDashboardStale ? 'text-amber-700' : 'text-slate-600'}`}>
                  {dashboardAgeLabel}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/production_tracker')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shrink-0 shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          </div>

          <div className="px-2.5 py-2.5 sm:px-3 sm:py-3 lg:px-4 lg:py-4 space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
              <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100">
                <p className="text-[11px] text-slate-500 font-semibold">Target</p>
                <p className="text-2xl font-extrabold text-blue-700 tracking-tight">{Number(selectedLineDetail.target || 0)}</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-2.5 border border-cyan-100">
                <p className="text-[11px] text-slate-500 font-semibold">Input</p>
                <p className="text-2xl font-extrabold text-cyan-700 tracking-tight">{formatInput(selectedLineDetail.input)}</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-2.5 border border-indigo-100">
                <p className="text-[11px] text-slate-500 font-semibold">Output</p>
                <p className="text-2xl font-extrabold text-indigo-700 tracking-tight">{Number(selectedLineDetail.output || 0)}</p>
              </div>
              <div className="bg-sky-50 rounded-xl p-2.5 border border-sky-100">
                <p className="text-[11px] text-slate-500 font-semibold">Input efficiency %</p>
                <p className={`text-2xl font-extrabold tracking-tight ${efficiencyPctColor(lineInputPercent)}`}>
                  {lineInputPercent}%
                </p>
              </div>
              <div className="bg-violet-50 rounded-xl p-2.5 border border-violet-100">
                <p className="text-[11px] text-slate-500 font-semibold">Output efficiency %</p>
                <p className={`text-2xl font-extrabold tracking-tight ${efficiencyPctColor(lineOutputPercent)}`}>
                  {lineOutputPercent}%
                </p>
              </div>
              <div className="bg-orange-50 rounded-xl p-2.5 border border-orange-100">
                <p className="text-[11px] text-slate-500 font-semibold">WIP</p>
                <p className="text-2xl font-extrabold text-orange-700 tracking-tight">{Number(selectedLineDetail.wip || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3">
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs text-slate-600 font-semibold">Input in progress</p>
                  <p className="text-sm font-bold text-slate-800">
                    {lineInputPercent}%
                  </p>
                </div>
                <p className="text-base font-extrabold text-slate-800 mb-2">
                  {formatInput(selectedLineDetail.input)} / {Number(selectedLineDetail.target || 0)}
                </p>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      lineInputPercent >= 90 ? 'bg-green-500' :
                      lineInputPercent >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${lineInputPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs text-slate-600 font-semibold">Output in progress</p>
                  <p className="text-sm font-bold text-slate-800">
                    {lineOutputPercent}%
                  </p>
                </div>
                <p className="text-base font-extrabold text-slate-800 mb-2">
                  {Number(selectedLineDetail.output || 0)} / {Number(selectedLineDetail.target || 0)}
                </p>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${Math.min(Math.max(lineOutputPercent, 0), 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                <span className="text-base sm:text-lg font-extrabold text-blue-800">Machine-level pace</span>
                <span className="text-xs sm:text-sm font-bold text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded ring-1 ring-amber-400/80 normal-case">
                  Circle = Efficiency %
                </span>
              </div>
              {detailMachinesLoading ? (
                <p className="text-sm text-slate-500 py-1">Loading…</p>
              ) : detailMachineSnapshots.length === 0 ? (
                <p className="text-sm text-slate-500 py-1">No machines on this line.</p>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  {detailMachineSnapshots.map((snap) => {
                    const pacePct =
                      snap.expected > 0 ? Math.round((snap.actual / snap.expected) * 100) : null;
                    const cardTone =
                      pacePct == null
                        ? 'border-slate-200 bg-white'
                        : pacePct >= 100
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : pacePct >= 70
                            ? 'border-amber-200 bg-amber-50/40'
                            : 'border-rose-200 bg-rose-50/40';
                    return (
                      <div key={snap.machineId} className={`rounded-xl border px-2 py-1.5 shadow-sm ${cardTone}`}>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-tight mb-1 line-clamp-2">
                          {snap.machineName}
                        </p>
                        <MachinePaceInlineRow
                          actual={snap.actual}
                          expected={snap.expected}
                          projectedEod={snap.projectedEod}
                          daily={snap.daily}
                          pacePct={pacePct}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveMobileTab('trends');
                navigate('/production_tracker');
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm"
            >
              View Hourly Trend
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <button
                type="button"
                onClick={() => {
                  navigate('/alert_center');
                  logAuditEvent('alerts_opened_from_bell', { count: alertCount, selectedLine: currentWorkCentreId, selectedDate });
                }}
                className="relative inline-flex items-center justify-center h-7 w-7 rounded-md text-xs font-semibold bg-white/12 hover:bg-white/20"
                title={alertCount > 0 ? `${alertCount} alerts — open Alert Center` : 'Open Alert Center'}
              >
                <Bell className="h-3.5 w-3.5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {activeMobileTab === 'dashboard' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2 h-full">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2 auto-rows-[minmax(96px,auto)]">
                {/* Target */}
                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <Target className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 mb-0.5" />
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">Target</div>
                  <div className="text-lg sm:text-2xl font-bold leading-none">{Number(topSection?.target || 0).toLocaleString()}</div>
                </div>

                {/* Input - TV Dashboard style */}
                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <ArrowDownToLine className="h-4 w-4 sm:h-6 sm:w-6 text-cyan-600 mb-0.5" />
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">Input</div>
                  <div className="text-lg sm:text-2xl font-bold leading-none text-cyan-600">
                    {formatInput(topSection?.input)}
                  </div>
                </div>

                {/* Input % - TV Dashboard style */}
                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <ArrowDownToLine className="h-4 w-4 sm:h-6 sm:w-6 text-sky-600 mb-0.5" />
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">Input %</div>
                  <div className={`text-lg sm:text-2xl font-bold leading-none ${
                    overallInputPercent >= 90 ? 'text-green-600' : overallInputPercent >= 70 ? 'text-yellow-600' : 'text-red-500'
                  }`}>
                    {overallInputPercent}%
                  </div>
                </div>

                {/* Output/Produced */}
                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-green-600 mb-0.5" />
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">Output</div>
                  <div className="text-lg sm:text-2xl font-bold leading-none">{Number(topSection?.output || 0).toLocaleString()}</div>
                </div>

                {/* Output % */}
                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <Activity className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600 mb-0.5" />
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">Output %</div>
                  <div className={`text-lg sm:text-2xl font-bold leading-none ${
                    outputPercent >= 90 ? 'text-green-600' : outputPercent >= 70 ? 'text-yellow-600' : 'text-red-500'
                  }`}>
                    {outputPercent}%
                  </div>
                </div>

                {/* WIP */}
                <div className="bg-[#f7f9ff] text-slate-900 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-[#dbe5ff] flex flex-col items-center justify-center text-center min-h-[108px] sm:min-h-[clamp(136px,18vh,210px)]">
                  <PackageOpen className={`h-4 w-4 sm:h-6 sm:w-6 mb-0.5 ${totalWip > 0 ? 'text-orange-600' : 'text-emerald-600'}`} />
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-0.5">WIP</div>
                  <div className={`text-lg sm:text-2xl font-bold leading-none ${
                    totalWip > 0 ? 'text-orange-600' : 'text-emerald-600'
                  }`}>
                    {totalWip.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-[#f7f9ff] rounded-2xl p-2 sm:p-3 text-slate-900 border border-[#dbe5ff] flex flex-col gap-2 min-h-[120px] sm:min-h-[150px] max-h-[40vh] overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1 sm:mb-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h3 className="text-base sm:text-xl font-bold">Lines</h3>
                    <span
                      className="text-[10px] sm:text-xs font-semibold text-amber-900 bg-amber-200 px-2 py-0.5 rounded ring-1 ring-amber-300 whitespace-nowrap"
                      title="Colored circle shows pace efficiency percentage"
                    >
                      Circle = Efficiency %
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded-full bg-slate-100 text-[11px] sm:text-sm font-semibold flex items-center gap-1.5 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
                    <span>Live</span>
                    <span className="text-slate-400">•</span>
                    <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-3">
                    {enrichedLines.map(({
                      line,
                      index,
                      target,
                      output,
                      expected,
                      projectedEod,
                      pacePct,
                    }) => {
                      const lineWip = Number(line.wip || 0);
                      return (
                        <button
                          key={`${line.line_name}-${index}`}
                          type="button"
                          onClick={() => {
                            const wcId = Number(line.work_centre_id || currentWorkCentreId);
                            navigate(`/production_tracker/line/${wcId}`);
                            logAuditEvent('line_detail_opened', { line: line.line_name, workCentreId: wcId });
                          }}
                        className="relative bg-white rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-[#d8e3ff] w-full min-h-[120px] sm:min-h-[156px] hover:shadow-md flex flex-col items-stretch text-center"
                        >
                          <div className="w-full flex items-start justify-between gap-1 mb-0.5">
                            <div className="text-xs sm:text-xl font-bold text-slate-800 leading-tight text-left min-w-0 flex-1">
                              {line.line_name || `Line ${index + 1}`}
                            </div>
                            <div
                              className={`shrink-0 inline-flex items-center gap-0.5 sm:gap-1 font-bold text-[10px] sm:text-sm ${lineCardWipClass(lineWip, target)}`}
                              title={`Line WIP: ${formatWip(lineWip)}`}
                            >
                              <PackageOpen className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                              <span className="tabular-nums">WIP {formatWip(lineWip)}</span>
                            </div>
                          </div>

                          <LinePaceEodEffBlock
                            actual={output}
                            expected={expected}
                            projectedEod={projectedEod}
                            daily={target}
                            pacePct={pacePct}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                  <option value="efficiency">Sort: Output % high to low</option>
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
