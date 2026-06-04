import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  TrendingDown,
  Minus,
  Clock,
  User,
  Wrench,
  Loader2,
  Calendar,
  Cpu,
  Gauge,
  AlertTriangle,
  BarChart2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';
import { Reports } from './Reports';
import { formatInput, formatWip } from '../utils/wipUtils';
import { buildMachinePaceSnapshot, getProductiveShiftTotals, SHIFT_END_MINUTES, SHIFT_START_MINUTES } from '../utils/shiftPaceUtils';
import { minutesToDurationParts } from '../utils/formatCycleDuration';
import { formatSinceTimeHHMM } from '../utils/dateTimeFormat';
import { TimeLossReasonDialog } from './TimeLossReasonDialog';
import {
  formatReasonDisplayLabel,
  M4_BADGE_CLASS,
  M4_REASON_ROW_CLASS,
  M4_REASON_TEXT_CLASS,
  parseM4FromDetail,
} from '../utils/m4ReasonUtils';

type MachineTimeLossMeta = {
  machine_id: string;
  machine_name: string;
  net_mins: number;
  reason: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

const machineKeysMatch = (left: string, right: string) => {
  const a = String(left ?? '').trim();
  const b = String(right ?? '').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
};

const formatSignedNetBalance = (netMins: number) => {
  if (Math.abs(netMins) * 60 < 1) return null;
  const parts = minutesToDurationParts(Math.abs(netMins));
  const dur = `${parts.wholeMinutes}m ${parts.seconds}s`;
  return netMins < 0 ? `${dur} loss` : `${dur} gain`;
};

/** Duration only for card badges (label already says Time loss / Net balance). */
const formatNetBalanceDuration = (netMins: number) => {
  if (Math.abs(netMins) * 60 < 1) return null;
  const parts = minutesToDurationParts(Math.abs(netMins));
  return `${parts.wholeMinutes}m ${parts.seconds}s`;
};

/** Shift time remaining — whole minutes and seconds, no decimals. */
const formatShiftTimeLeft = (minutes: number) => {
  const parts = minutesToDurationParts(Math.max(0, minutes));
  if (parts.wholeMinutes <= 0 && parts.seconds <= 0) return '0s left';
  if (parts.wholeMinutes <= 0) return `${parts.seconds}s left`;
  if (parts.seconds <= 0) return `${parts.wholeMinutes}m left`;
  return `${parts.wholeMinutes}m ${parts.seconds}s left`;
};

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

const getLineRecoveryStats = (target: number, output: number, projectedEod: number, now: Date) => {
  const { remainingProductiveMins, elapsedProductiveMins } = getProductiveShiftTotals(now);
  const daily = Math.round(target);
  const actual = Math.round(output);
  const shortfall = Math.max(0, daily - projectedEod);
  const gapToTarget = Math.max(0, daily - actual);
  const eodBehind = daily > 0 && projectedEod < daily;
  const pairsPerHrNeeded =
    remainingProductiveMins > 0 && gapToTarget > 0
      ? Math.round((gapToTarget / remainingProductiveMins) * 60 * 10) / 10
      : null;
  const currentPairsPerHr =
    elapsedProductiveMins > 0
      ? Math.round((actual / elapsedProductiveMins) * 60 * 10) / 10
      : null;
  return {
    shortfall,
    gapToTarget,
    eodBehind,
    pairsPerHrNeeded,
    currentPairsPerHr,
    remainingProductiveMins,
  };
};

const addDaysToDateKey = (dateKey: string, deltaDays: number) => {
  const base = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateKey;
  base.setDate(base.getDate() + deltaDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

const resolveTrackerWorkCentreId = (
  pathname: string,
  selectedLine: string,
  workCentres: { id: number }[]
) => {
  const detailMatch = pathname.match(/^\/production_tracker\/line\/([^/]+)$/);
  const routeWcId = detailMatch ? Number(detailMatch[1]) : NaN;
  if (Number.isFinite(routeWcId)) return routeWcId;
  return parseInt(selectedLine, 10) || workCentres[0]?.id || 1;
};

const formatStoppageDetail = (detail?: string | null) => {
  if (!detail) return '';
  return String(detail)
    .replace(/^BOTTLENECK:/i, '')
    .replace(/^BREAKDOWN:/i, '')
    .replace(/\s*\[Approved By:[^\]]+\]\s*$/i, '')
    .trim();
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
  const [machineLossMeta, setMachineLossMeta] = useState<MachineTimeLossMeta[]>([]);
  const [reasonDialog, setReasonDialog] = useState<{ machineId: string; machineName: string } | null>(null);
  const [reasonSaving, setReasonSaving] = useState(false);
  const [yesterdayLineOutput, setYesterdayLineOutput] = useState<number | null>(null);
  const machinePaceTrendRef = useRef<Map<string, number>>(new Map());
  const linePaceTrendRef = useRef<number | null>(null);

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

  const loadAttendanceData = async (silent = false) => {
    if (!silent) setAttendanceLoading(true);
    try {
      const workCentreId = resolveTrackerWorkCentreId(location.pathname, selectedLine, workCentres);
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
      const workCentreId = resolveTrackerWorkCentreId(location.pathname, selectedLine, workCentres);
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
        loadAttendanceData(true);
      }, pollMs);
      return () => clearInterval(interval);
    }
  }, [selectedDate, selectedLine, workCentres, refreshMode, location.pathname]);

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
      setSelectedLineDetail((prev: any) => {
        if (!prev || Number(prev.work_centre_id) !== detailWorkCentreId) return detailLine;
        return detailLine;
      });
    } else if (selectedLineDetail) {
      setSelectedLineDetail(null);
    }
  }, [isDetailRoute, detailWorkCentreId, linePerformance, selectedLineDetail]);

  const loadDetailMachines = useCallback(
    async (silent = false) => {
      if (!Number.isFinite(detailWorkCentreId)) return;
      if (!silent) setDetailMachinesLoading(true);
      try {
        const res = await apiFetch(
          `${API_BASE}/api/tv-dashboard/machine-centres/${detailWorkCentreId}?date=${selectedDate}`
        );
        const result = await res.json();
        setDetailMachineRows(result.success ? result.data || [] : []);
      } catch {
        setDetailMachineRows([]);
      } finally {
        if (!silent) setDetailMachinesLoading(false);
      }
    },
    [detailWorkCentreId, selectedDate]
  );

  const loadMachineTimeLossMeta = useCallback(async () => {
    if (!Number.isFinite(detailWorkCentreId)) return;
    try {
      const res = await apiFetch(
        `${API_BASE}/api/tracker/machine-time-loss?work_centre_id=${detailWorkCentreId}&date=${selectedDate}`
      );
      const json = await res.json();
      setMachineLossMeta(json.success && Array.isArray(json.machines) ? json.machines : []);
    } catch {
      setMachineLossMeta([]);
    }
  }, [detailWorkCentreId, selectedDate]);

  useEffect(() => {
    if (!isDetailRoute || !Number.isFinite(detailWorkCentreId)) {
      setDetailMachineRows([]);
      return;
    }
    loadDetailMachines(false);
  }, [isDetailRoute, detailWorkCentreId, selectedDate, loadDetailMachines]);

  useEffect(() => {
    if (!isDetailRoute || !Number.isFinite(detailWorkCentreId)) {
      setMachineLossMeta([]);
      return;
    }
    loadMachineTimeLossMeta();
  }, [isDetailRoute, detailWorkCentreId, selectedDate, dashboardLastUpdated, loadMachineTimeLossMeta]);

  useEffect(() => {
    if (!isDetailRoute || !Number.isFinite(detailWorkCentreId)) return;
    loadAttendanceData(true);
    if (refreshMode === 'manual') return;
    const pollMs = refreshMode === '30s' ? 30000 : 10000;
    const interval = setInterval(() => loadAttendanceData(true), pollMs);
    return () => clearInterval(interval);
  }, [isDetailRoute, detailWorkCentreId, selectedDate, refreshMode, location.pathname]);

  useEffect(() => {
    if (!isDetailRoute || !Number.isFinite(detailWorkCentreId)) return;
    if (refreshMode === 'manual') return;
    const pollMs = refreshMode === '30s' ? 30000 : 10000;
    const interval = setInterval(() => {
      loadDetailMachines(true);
      loadMachineTimeLossMeta();
    }, pollMs);
    return () => clearInterval(interval);
  }, [isDetailRoute, detailWorkCentreId, selectedDate, refreshMode, loadDetailMachines, loadMachineTimeLossMeta]);

  const findLossMetaForMachine = useCallback(
    (machineId: string) =>
      machineLossMeta.find((row) => machineKeysMatch(row.machine_id, machineId)),
    [machineLossMeta]
  );

  const handleDetailRefresh = async () => {
    setManualRefreshing(true);
    try {
      await Promise.all([
        loadDashboardData(),
        loadDetailMachines(true),
        loadMachineTimeLossMeta(),
        loadYesterdayLineOutput(),
        loadAttendanceData(true),
      ]);
    } finally {
      setManualRefreshing(false);
    }
  };

  const saveTimeLossReason = async (reason: string) => {
    if (!reasonDialog || !Number.isFinite(detailWorkCentreId)) return;
    setReasonSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/tracker/time-loss-reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_centre_id: detailWorkCentreId,
          machine_id: reasonDialog.machineId,
          date: selectedDate,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || json.message || 'Failed to save reason');
        return;
      }
      toast.success('Time loss reason saved');
      setReasonDialog(null);
      await loadMachineTimeLossMeta();
    } catch {
      toast.error('Failed to save time loss reason');
    } finally {
      setReasonSaving(false);
    }
  };

  const detailMachineSnapshots = useMemo(
    () =>
      [...detailMachineRows]
        .map((row: any) => {
          const pace = buildMachinePaceSnapshot(
            String(row.machine_id),
            row.machine_name || row.machine_centre_name || String(row.machine_id),
            Number(row.total_output_pairs || 0),
            Number(row.target_mins_per_box || 0),
            currentTime
          );
          const pacePct =
            pace.expected > 0 ? Math.round((pace.actual / pace.expected) * 100) : null;
          const isStall = pace.hasRouting && pace.actual <= 0 && pace.expected > 0;
          return {
            ...pace,
            pacePct,
            isStall,
            empName: row.emp_name ? String(row.emp_name).trim() : '',
            empCode: row.emp_code ? String(row.emp_code).trim() : '',
          };
        })
        .sort((a, b) =>
          String(a.machineId).localeCompare(String(b.machineId), undefined, { numeric: true })
        ),
    [detailMachineRows, currentTime]
  );

  const getMachinePaceTrend = useCallback((machineId: string, pacePct: number | null) => {
    if (pacePct == null) return null;
    const prev = machinePaceTrendRef.current.get(machineId);
    machinePaceTrendRef.current.set(machineId, pacePct);
    if (prev == null) return null;
    if (pacePct > prev + 2) return 'up' as const;
    if (pacePct < prev - 2) return 'down' as const;
    return 'flat' as const;
  }, []);

  const loadYesterdayLineOutput = useCallback(async () => {
    if (!Number.isFinite(detailWorkCentreId)) return;
    const yesterdayKey = addDaysToDateKey(selectedDate, -1);
    try {
      const res = await apiFetch(
        `${API_BASE}/api/tv-dashboard/dashboard/${detailWorkCentreId}?date=${yesterdayKey}`
      );
      const json = await res.json();
      if (!json.success) {
        setYesterdayLineOutput(null);
        return;
      }
      const line = (json.data?.lowerSection?.linePerformance || []).find(
        (row: any) => Number(row.work_centre_id) === detailWorkCentreId
      );
      setYesterdayLineOutput(line != null ? Math.round(Number(line.output || 0)) : null);
    } catch {
      setYesterdayLineOutput(null);
    }
  }, [detailWorkCentreId, selectedDate]);

  useEffect(() => {
    if (!isDetailRoute || !Number.isFinite(detailWorkCentreId)) {
      setYesterdayLineOutput(null);
      return;
    }
    loadYesterdayLineOutput();
  }, [isDetailRoute, detailWorkCentreId, selectedDate, loadYesterdayLineOutput]);

  const fixFirstMachines = useMemo(() => {
    const losses = machineLossMeta
      .filter((m) => m.net_mins < 0 && Math.abs(m.net_mins) * 60 >= 1)
      .map((m) => {
        const snap = detailMachineSnapshots.find((s) => machineKeysMatch(s.machineId, m.machine_id));
        return {
          machineId: m.machine_id,
          machineName: snap?.machineName || m.machine_name || m.machine_id,
          lossMins: Math.abs(m.net_mins),
          pacePct: snap?.pacePct ?? null,
        };
      })
      .sort((a, b) => b.lossMins - a.lossMins);
    const totalLoss = losses.reduce((sum, row) => sum + row.lossMins, 0);
    return losses.slice(0, 3).map((row, index) => ({
      ...row,
      rank: index + 1,
      pctOfTotal: totalLoss > 0 ? Math.round((row.lossMins / totalLoss) * 100) : 0,
    }));
  }, [machineLossMeta, detailMachineSnapshots]);

  const totalLineLossMins = useMemo(
    () =>
      machineLossMeta
        .filter((m) => m.net_mins < 0 && Math.abs(m.net_mins) * 60 >= 1)
        .reduce((sum, m) => sum + Math.abs(m.net_mins), 0),
    [machineLossMeta]
  );

  const fixFirstRankByMachineId = useMemo(() => {
    const map = new Map<string, number>();
    fixFirstMachines.forEach((row) => map.set(String(row.machineId), row.rank));
    return map;
  }, [fixFirstMachines]);

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
    const dialogMeta = reasonDialog ? findLossMetaForMachine(reasonDialog.machineId) : undefined;
    const dialogNetLabel = dialogMeta ? formatSignedNetBalance(dialogMeta.net_mins) : null;
    const detailLinePace = getLineShiftPace(
      Number(selectedLineDetail.target || 0),
      Number(selectedLineDetail.output || 0),
      currentTime
    );
    const lineRecovery = getLineRecoveryStats(
      Number(selectedLineDetail.target || 0),
      Number(selectedLineDetail.output || 0),
      detailLinePace.projectedEod,
      currentTime
    );
    const totalLossLabel = formatNetBalanceDuration(-totalLineLossMins);
    const yesterdayCompare =
      yesterdayLineOutput != null
        ? detailLinePace.actual - yesterdayLineOutput
        : null;
    const shiftTotals = getProductiveShiftTotals(currentTime);
    const paceGapPairs = Math.max(0, detailLinePace.expected - detailLinePace.actual);
    let linePaceTrend: 'up' | 'down' | 'flat' | null = null;
    if (detailLinePace.pacePct != null) {
      const prevLinePace = linePaceTrendRef.current;
      linePaceTrendRef.current = detailLinePace.pacePct;
      if (prevLinePace != null) {
        if (detailLinePace.pacePct > prevLinePace + 2) linePaceTrend = 'up';
        else if (detailLinePace.pacePct < prevLinePace - 2) linePaceTrend = 'down';
        else linePaceTrend = 'flat';
      }
    }
    const detailLower = dashboardData?.lowerSection || {};
    const liveBottlenecks = (detailLower.bottlenecks || []).filter(
      (row: any) => Number(row.button_status) === 1
    );
    const liveBreakdowns = (detailLower.breakdowns || []).filter(
      (row: any) => Number(row.button_status) === 1
    );
    const liveIssueCount = liveBottlenecks.length + liveBreakdowns.length;
    const stalledMachines = detailMachineSnapshots.filter((s) => s.isStall);
    const lineTarget = Number(selectedLineDetail.target || 0);
    const lineWip = Number(selectedLineDetail.wip || 0);
    const wipRatio = lineTarget > 0 ? lineWip / lineTarget : 0;
    const attendancePresent = Number(attendanceData.present || 0);
    const attendanceTarget = Number(attendanceData.target_employees || 0);
    const attendanceShort = Math.max(0, attendanceTarget - attendancePresent);
    const shiftStartLabel = `${String(Math.floor(SHIFT_START_MINUTES / 60)).padStart(2, '0')}:${String(SHIFT_START_MINUTES % 60).padStart(2, '0')}`;
    const shiftEndLabel = `${String(Math.floor(SHIFT_END_MINUTES / 60)).padStart(2, '0')}:${String(SHIFT_END_MINUTES % 60).padStart(2, '0')}`;
    const lineStatusLabel =
      lineOutputPercent >= 90 ? 'Strong' : lineOutputPercent >= 70 ? 'On track' : 'Needs attention';
    const lineStatusClass =
      lineOutputPercent >= 90
        ? 'bg-emerald-500/25 text-emerald-100 ring-emerald-300/50'
        : lineOutputPercent >= 70
          ? 'bg-amber-500/25 text-amber-50 ring-amber-300/50'
          : 'bg-rose-500/30 text-rose-50 ring-rose-300/50';
    const machinesBehindCount = detailMachineSnapshots.filter((snap) => {
      const pct = snap.expected > 0 ? Math.round((snap.actual / snap.expected) * 100) : null;
      return pct != null && pct < 70;
    }).length;
    const machinesWithLoss = machineLossMeta.filter(
      (m) => m.net_mins < 0 && Math.abs(m.net_mins) * 60 >= 1
    ).length;
    const formattedDate = selectedDate
      ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : '';

    const kpiTiles = [
      {
        icon: Target,
        iconClass: 'text-blue-600',
        label: 'Target',
        value: Number(selectedLineDetail.target || 0).toLocaleString(),
        valueClass: 'text-blue-700',
      },
      {
        icon: ArrowDownToLine,
        iconClass: 'text-cyan-600',
        label: 'Input',
        value: formatInput(selectedLineDetail.input),
        valueClass: 'text-cyan-700',
      },
      {
        icon: TrendingUp,
        iconClass: 'text-indigo-600',
        label: 'Output',
        value: Number(selectedLineDetail.output || 0).toLocaleString(),
        valueClass: 'text-indigo-700',
      },
      {
        icon: Gauge,
        iconClass: 'text-sky-600',
        label: 'Input %',
        value: `${lineInputPercent}%`,
        valueClass: efficiencyPctColor(lineInputPercent),
      },
      {
        icon: Activity,
        iconClass: 'text-violet-600',
        label: 'Output %',
        value: `${lineOutputPercent}%`,
        valueClass: efficiencyPctColor(lineOutputPercent),
      },
      {
        icon: PackageOpen,
        iconClass: lineWip > 0 ? 'text-orange-600' : 'text-emerald-600',
        label: 'WIP',
        value: formatWip(lineWip),
        valueClass: lineCardWipClass(lineWip, lineTarget),
      },
    ] as const;

    return (
      <div className="min-h-full h-full bg-gradient-to-b from-slate-100 via-blue-50/25 to-slate-100 p-2 sm:p-3 lg:p-4">
        <TimeLossReasonDialog
          open={!!reasonDialog}
          machineName={reasonDialog?.machineName || ''}
          netLossLabel={dialogNetLabel}
          initialReason={dialogMeta?.reason || ''}
          saving={reasonSaving}
          onSave={saveTimeLossReason}
          onClose={() => setReasonDialog(null)}
        />

        <div className="mx-auto w-full max-w-7xl space-y-3 sm:space-y-4">
          {/* Hero header */}
          <div className="overflow-hidden rounded-2xl border border-blue-900/30 bg-gradient-to-r from-[#0f2f78] via-[#1847be] to-[#1c3cb5] text-white shadow-lg shadow-blue-900/20">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/production_tracker')}
                  className="mt-0.5 shrink-0 rounded-xl border border-white/20 bg-white/10 p-2.5 transition-colors hover:bg-white/20 touch-manipulation"
                  aria-label="Back to all lines"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200/90">
                    Production line
                  </p>
                  <h1 className="truncate text-xl font-extrabold sm:text-2xl">
                    {selectedLineDetail.line_name || 'Line details'}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {formattedDate && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/20">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {formattedDate}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${lineStatusClass}`}
                    >
                      {lineStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden sm:flex flex-col items-end text-right text-xs text-blue-100/90">
                  <span className="font-medium">Updated</span>
                  <span className={`font-bold ${isDashboardStale ? 'text-amber-200' : 'text-white'}`}>
                    {dashboardAgeLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDetailRefresh()}
                  disabled={manualRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/20 disabled:opacity-60 touch-manipulation"
                  aria-label="Refresh line data"
                >
                  <RefreshCw className={`h-4 w-4 ${manualRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-white/10 bg-black/10 px-4 py-2.5 sm:px-5">
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold">
                <Cpu className="mr-1 inline h-3.5 w-3.5" />
                {detailMachineSnapshots.length} machine
                {detailMachineSnapshots.length === 1 ? '' : 's'}
              </span>
              {machinesBehindCount > 0 && (
                <span className="rounded-lg bg-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-50">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  {machinesBehindCount} behind pace
                </span>
              )}
              {machinesWithLoss > 0 && (
                <span className="rounded-lg bg-rose-500/30 px-2.5 py-1 text-xs font-semibold text-rose-50">
                  {machinesWithLoss} with time loss
                </span>
              )}
              {totalLossLabel && (
                <span className="rounded-lg bg-violet-500/30 px-2.5 py-1 text-xs font-semibold text-violet-50">
                  <Clock className="mr-1 inline h-3.5 w-3.5" />
                  {totalLossLabel} lost today
                </span>
              )}
              {lineRecovery.remainingProductiveMins > 0 && (
                <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-blue-50">
                  {formatShiftTimeLeft(lineRecovery.remainingProductiveMins)} in shift
                </span>
              )}
              {liveIssueCount > 0 && (
                <span className="rounded-lg bg-orange-500/40 px-2.5 py-1 text-xs font-semibold text-orange-50">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  {liveIssueCount} live issue{liveIssueCount === 1 ? '' : 's'}
                </span>
              )}
              {stalledMachines.length > 0 && (
                <span className="rounded-lg bg-slate-700/50 px-2.5 py-1 text-xs font-semibold text-amber-100">
                  {stalledMachines.length} stalled
                </span>
              )}
              <span className="sm:hidden ml-auto text-xs font-medium text-blue-100/80">
                {dashboardAgeLabel}
              </span>
            </div>
          </div>

          {!online && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
              <WifiOff className="h-4 w-4 shrink-0" />
              Offline — showing last synced data
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
            <div className="space-y-4 p-3 sm:p-4 lg:p-5">
              {/* KPI tiles */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:gap-3">
                {kpiTiles.map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <div
                      key={tile.label}
                      className="flex flex-col items-center justify-center rounded-xl border border-[#dbe5ff] bg-[#f7f9ff] p-2.5 text-center sm:p-3"
                    >
                      <Icon className={`mb-1 h-5 w-5 sm:h-6 sm:w-6 ${tile.iconClass}`} aria-hidden />
                      <p className="text-[10px] font-semibold text-slate-500 sm:text-[11px]">{tile.label}</p>
                      <p className={`text-xl font-extrabold tabular-nums leading-tight sm:text-2xl ${tile.valueClass}`}>
                        {tile.value}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Line insights — shift recovery + fix first */}
              {detailLinePace.daily > 0 && (
                <div className="space-y-2.5 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-2.5 sm:p-3">
                  <p className="text-center text-[11px] font-extrabold uppercase tracking-wider text-indigo-900">
                    Line insights
                  </p>
                  <div
                    className={`rounded-xl border px-3 py-3 ${
                      lineRecovery.eodBehind
                        ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50'
                        : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
                          Shift recovery
                        </p>
                        {lineRecovery.eodBehind ? (
                          <p className="text-sm font-bold text-rose-800">
                            EOD forecast {detailLinePace.projectedEod} / {detailLinePace.daily}
                            <span className="font-extrabold">
                              {' '}
                              — short by ~{lineRecovery.shortfall} pairs
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-emerald-800">
                            On track for EOD ({detailLinePace.projectedEod} / {detailLinePace.daily})
                          </p>
                        )}
                        {lineRecovery.pairsPerHrNeeded != null && lineRecovery.gapToTarget > 0 && (
                          <p className="text-xs sm:text-sm text-slate-700">
                            Need ~<span className="font-black tabular-nums">{lineRecovery.pairsPerHrNeeded}</span>{' '}
                            pairs/hr for rest of shift
                            {lineRecovery.currentPairsPerHr != null && (
                              <>
                                {' '}
                                (now ~<span className="font-bold tabular-nums">{lineRecovery.currentPairsPerHr}</span>
                                /hr)
                              </>
                            )}
                          </p>
                        )}
                        {yesterdayCompare != null && (
                          <p className="text-xs text-slate-600">
                            vs yesterday: output{' '}
                            <span
                              className={`font-bold tabular-nums ${
                                yesterdayCompare >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {yesterdayCompare >= 0 ? '+' : ''}
                              {yesterdayCompare}
                            </span>{' '}
                            pairs (was {yesterdayLineOutput})
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-xs font-semibold text-slate-600">
                        <p className="tabular-nums">{formatShiftTimeLeft(lineRecovery.remainingProductiveMins)}</p>
                        <p className="text-slate-500">productive</p>
                      </div>
                    </div>
                  </div>

                  {fixFirstMachines.length > 0 ? (
                    <div className="rounded-xl border border-rose-200 bg-white">
                      <div className="border-b border-rose-100 bg-rose-50 px-3 py-2">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-rose-800">
                          Fix first — time loss
                        </p>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {fixFirstMachines.map((row) => (
                          <li
                            key={row.machineId}
                            className="flex flex-wrap items-center gap-2 px-3 py-2"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-xs font-black text-white">
                              {row.rank}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900">{row.machineName}</p>
                              <p className="text-xs text-slate-500 tabular-nums">
                                {formatNetBalanceDuration(-row.lossMins)}
                                {row.pctOfTotal > 0 ? ` · ${row.pctOfTotal}% of line loss` : ''}
                                {row.pacePct != null ? ` · ${row.pacePct}% pace` : ''}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : machinesWithLoss > 0 ? (
                    <p className="text-center text-xs font-semibold text-rose-700">
                      {machinesWithLoss} machine(s) with time loss — see cards below
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-white bg-white/90 px-2 py-2 text-center">
                      <p className="text-[9px] font-bold uppercase text-slate-500">Attendance</p>
                      <p className="text-sm font-black tabular-nums text-slate-900">
                        {attendancePresent}/{attendanceTarget || '—'}
                      </p>
                      {attendanceShort > 0 && (
                        <p className="text-[10px] font-semibold text-rose-600">−{attendanceShort} short</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-white bg-white/90 px-2 py-2 text-center">
                      <p className="text-[9px] font-bold uppercase text-slate-500">Behind pace</p>
                      <p className="text-sm font-black tabular-nums text-rose-700">
                        {paceGapPairs > 0 ? `−${paceGapPairs}` : '0'} pairs
                      </p>
                      <p className="text-[10px] text-slate-500">vs expected now</p>
                    </div>
                    <div className="rounded-lg border border-white bg-white/90 px-2 py-2 text-center">
                      <p className="text-[9px] font-bold uppercase text-slate-500">Line pace</p>
                      <p className="text-sm font-black tabular-nums">
                        {detailLinePace.pacePct != null ? `${detailLinePace.pacePct}%` : '—'}
                      </p>
                      {linePaceTrend === 'up' && (
                        <p className="text-[10px] font-bold text-emerald-600 inline-flex items-center justify-center gap-0.5">
                          <TrendingUp className="h-3 w-3" /> Improving
                        </p>
                      )}
                      {linePaceTrend === 'down' && (
                        <p className="text-[10px] font-bold text-rose-600 inline-flex items-center justify-center gap-0.5">
                          <TrendingDown className="h-3 w-3" /> Slipping
                        </p>
                      )}
                      {linePaceTrend === 'flat' && (
                        <p className="text-[10px] font-semibold text-slate-500">Steady</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-white bg-white/90 px-2 py-2 text-center">
                      <p className="text-[9px] font-bold uppercase text-slate-500">WIP</p>
                      <p className={`text-sm font-black tabular-nums ${lineCardWipClass(lineWip, lineTarget)}`}>
                        {formatWip(lineWip)}
                      </p>
                      {wipRatio > 0.25 && (
                        <p className="text-[10px] font-semibold text-orange-600">High vs target</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Shift timeline */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Shift {shiftStartLabel}–{shiftEndLabel}
                  </span>
                  <span className="tabular-nums">
                    {shiftTotals.elapsedPct}% elapsed · {formatShiftTimeLeft(shiftTotals.remainingProductiveMins)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, shiftTotals.elapsedPct))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-center text-[10px] text-slate-500">
                  Now {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Line shift pace */}
              <div className="rounded-xl border border-[#dbe5ff] bg-[#f7f9ff] p-3 sm:p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-extrabold text-slate-800 sm:text-base">Line pace today</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {paceGapPairs > 0 && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded ring-1 ring-rose-200">
                        −{paceGapPairs} pairs vs now
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 px-2 py-0.5 rounded ring-1 ring-amber-200">
                      Circle = efficiency %
                    </span>
                  </div>
                </div>
                <LinePaceEodEffBlock
                  actual={detailLinePace.actual}
                  expected={detailLinePace.expected}
                  projectedEod={detailLinePace.projectedEod}
                  daily={detailLinePace.daily}
                  pacePct={detailLinePace.pacePct}
                />
                {totalLossLabel && (
                  <p className="mt-2 text-center text-xs font-semibold text-violet-800">
                    Line time loss today: {totalLossLabel}
                    {lineOutputPercent < 70 ? ' — likely dragging output' : ''}
                  </p>
                )}
              </div>

              {/* Progress bars */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Input progress</p>
                    <span className={`text-sm font-extrabold tabular-nums ${efficiencyPctColor(lineInputPercent)}`}>
                      {lineInputPercent}%
                    </span>
                  </div>
                  <p className="mb-2 text-base font-extrabold text-slate-800 tabular-nums">
                    {formatInput(selectedLineDetail.input)}{' '}
                    <span className="text-slate-400 font-bold">/</span> {lineTarget.toLocaleString()}
                  </p>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all ${
                        lineInputPercent >= 90
                          ? 'bg-emerald-500'
                          : lineInputPercent >= 70
                            ? 'bg-amber-400'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(lineInputPercent, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Output progress</p>
                    <span className={`text-sm font-extrabold tabular-nums ${efficiencyPctColor(lineOutputPercent)}`}>
                      {lineOutputPercent}%
                    </span>
                  </div>
                  <p className="mb-2 text-base font-extrabold text-slate-800 tabular-nums">
                    {Number(selectedLineDetail.output || 0).toLocaleString()}{' '}
                    <span className="text-slate-400 font-bold">/</span> {lineTarget.toLocaleString()}
                  </p>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${Math.min(Math.max(lineOutputPercent, 0), 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Live bottlenecks / breakdowns */}
              {liveIssueCount > 0 && (
                <div className="rounded-xl border-2 border-orange-300 bg-orange-50/80 p-3">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-orange-900">
                    Live on floor — needs attention
                  </p>
                  <ul className="space-y-2">
                    {liveBreakdowns.slice(0, 3).map((row: any, idx: number) => (
                      <li
                        key={`bd-${idx}-${row.machine_centre_name}`}
                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2"
                      >
                        <Wrench className="h-4 w-4 shrink-0 text-red-700 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-red-900">{row.machine_centre_name}</p>
                          <p className="text-xs text-red-800 line-clamp-2">
                            {formatStoppageDetail(row.detail) || 'Breakdown'}
                          </p>
                          <p className="text-[10px] font-semibold text-red-700">
                            {formatSinceTimeHHMM(row.idle_start_time || row.start_time)}
                          </p>
                        </div>
                      </li>
                    ))}
                    {liveBottlenecks.slice(0, 3).map((row: any, idx: number) => (
                      <li
                        key={`bn-${idx}-${row.machine_centre_name}`}
                        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-amber-900">{row.machine_centre_name}</p>
                          <p className="text-xs text-amber-900 line-clamp-2">
                            {formatStoppageDetail(row.detail) || 'Bottleneck'}
                          </p>
                          <p className="text-[10px] font-semibold text-amber-800">
                            {formatSinceTimeHHMM(row.idle_start_time || row.start_time)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stalled machines */}
              {stalledMachines.length > 0 && (
                <div className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5">
                  <p className="text-xs font-extrabold uppercase text-slate-800 mb-1.5">
                    Stalled — routing set, no output yet
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {stalledMachines.map((s) => (
                      <span
                        key={s.machineId}
                        className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-bold text-amber-100"
                      >
                        {s.machineName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hourly output for this line */}
              <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3 min-h-[220px]">
                <h2 className="mb-1 text-sm font-extrabold text-slate-800">Hourly output (this line)</h2>
                <div className="h-[200px] sm:h-[220px]">
                  <HourlyOutputChart
                    workCentreId={detailWorkCentreId}
                    workCentreName={selectedLineDetail.line_name}
                    date={selectedDate}
                    hideTitle
                    fitContainer
                  />
                </div>
              </div>

              {/* Machine pace */}
              <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-extrabold text-blue-900 sm:text-lg">Machine pace</h2>
                    <p className="text-xs text-slate-600">
                      Tap a card for time loss reason · {attendancePresent} operator
                      {attendancePresent === 1 ? '' : 's'} logged in
                    </p>
                  </div>
                  {detailMachinesLoading && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label="Loading machines" />
                  )}
                </div>

                {detailMachinesLoading && detailMachineSnapshots.length === 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white/60"
                      />
                    ))}
                  </div>
                ) : detailMachineSnapshots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 py-10 text-center">
                    <Cpu className="mb-2 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No machines on this line</p>
                    <p className="mt-1 text-xs text-slate-500">Check machine centres are assigned to this work centre.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                    {[...detailMachineSnapshots]
                      .sort((a, b) => {
                        const rankA = fixFirstRankByMachineId.get(String(a.machineId)) ?? 99;
                        const rankB = fixFirstRankByMachineId.get(String(b.machineId)) ?? 99;
                        if (rankA !== rankB) return rankA - rankB;
                        return String(a.machineId).localeCompare(String(b.machineId), undefined, {
                          numeric: true,
                        });
                      })
                      .map((snap) => {
                      const pacePct = snap.pacePct;
                      const paceTrend = getMachinePaceTrend(String(snap.machineId), pacePct);
                      const fixRank = fixFirstRankByMachineId.get(String(snap.machineId));
                      const cardTone =
                        pacePct == null
                          ? 'border-slate-200 bg-white'
                          : pacePct >= 100
                            ? 'border-emerald-200 bg-emerald-50/50 shadow-sm shadow-emerald-100/50'
                            : pacePct >= 70
                              ? 'border-amber-200 bg-amber-50/40 shadow-sm shadow-amber-100/40'
                              : 'border-rose-200 bg-rose-50/40 shadow-sm shadow-rose-100/40';
                      const lossMeta = findLossMetaForMachine(snap.machineId);
                      const netMins = Number(lossMeta?.net_mins ?? 0);
                      const hasNetLoss = netMins < 0 && Math.abs(netMins) * 60 >= 1;
                      const hasNetGain = netMins > 0 && Math.abs(netMins) * 60 >= 1;
                      const netDurationLabel = formatNetBalanceDuration(netMins);
                      const lossSharePct =
                        hasNetLoss && totalLineLossMins > 0
                          ? Math.round((Math.abs(netMins) / totalLineLossMins) * 100)
                          : 0;
                      const reasonParsed = lossMeta?.reason ? parseM4FromDetail(lossMeta.reason) : null;
                      const showReasonRow = hasNetLoss || hasNetGain || !!lossMeta?.reason;
                      const needsReason = hasNetLoss && !reasonParsed?.reason;

                      return (
                        <div
                          key={snap.machineId}
                          className={`rounded-xl border p-2.5 transition-shadow hover:shadow-md ${cardTone}`}
                        >
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-bold leading-tight text-slate-900">
                                {snap.machineName}
                              </p>
                              <span className="mt-0.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 tabular-nums">
                                {snap.machineId}
                              </span>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              {fixRank != null && (
                                <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                  #{fixRank} fix
                                </span>
                              )}
                              {snap.isStall && (
                                <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                                  Stall
                                </span>
                              )}
                              {pacePct != null && pacePct < 70 && !snap.isStall && (
                                <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                                  Behind
                                </span>
                              )}
                              {paceTrend === 'up' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                                  <TrendingUp className="h-3 w-3" /> Pace
                                </span>
                              )}
                              {paceTrend === 'down' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700">
                                  <TrendingDown className="h-3 w-3" /> Pace
                                </span>
                              )}
                              {paceTrend === 'flat' && pacePct != null && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500">
                                  <Minus className="h-3 w-3" /> Pace
                                </span>
                              )}
                            </div>
                          </div>
                          {(snap.empName || snap.empCode) && (
                            <p className="mb-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold text-slate-600">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {snap.empName || 'Operator'}
                                {snap.empCode ? ` (${snap.empCode})` : ''}
                              </span>
                              <span className={snap.isStall ? 'text-amber-700' : 'text-emerald-700'}>
                                {snap.isStall ? '· no output yet' : '· active'}
                              </span>
                            </p>
                          )}
                          {!snap.empName && !snap.empCode && snap.isStall && (
                            <p className="mb-1 text-[10px] font-semibold text-amber-800">No operator session — check mobile</p>
                          )}
                          <MachinePaceInlineRow
                            actual={snap.actual}
                            expected={snap.expected}
                            projectedEod={snap.projectedEod}
                            daily={snap.daily}
                            pacePct={pacePct}
                          />
                          {showReasonRow ? (
                            <button
                              type="button"
                              onClick={() =>
                                setReasonDialog({
                                  machineId: snap.machineId,
                                  machineName: snap.machineName,
                                })
                              }
                              className="mt-2 w-full rounded-lg border border-slate-200/90 bg-white/90 px-2 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/70 touch-manipulation"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                {netDurationLabel ? (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-black tabular-nums ring-1 ${
                                      hasNetLoss
                                        ? 'bg-red-100 text-red-800 ring-red-300'
                                        : 'bg-emerald-100 text-emerald-800 ring-emerald-300'
                                    }`}
                                  >
                                    <span className="text-[10px] font-extrabold uppercase tracking-wide opacity-90">
                                      {hasNetLoss ? 'Time loss' : 'Net balance'}
                                    </span>
                                    <span>
                                      {netDurationLabel}
                                      {lossSharePct > 0 ? ` (${lossSharePct}% of line)` : ''}
                                    </span>
                                  </span>
                                ) : null}
                                {reasonParsed?.reason ? (
                                  <span
                                    className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-black ring-1 ${
                                      M4_REASON_ROW_CLASS[reasonParsed.reasonCategory] ||
                                      'bg-indigo-50 ring-indigo-200'
                                    }`}
                                  >
                                    <span
                                      className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wide ${
                                        M4_REASON_TEXT_CLASS[reasonParsed.reasonCategory] || 'text-indigo-800'
                                      }`}
                                    >
                                      Reason
                                    </span>
                                    {reasonParsed.reasonCategory ? (
                                      <span
                                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ring-1 ${
                                          M4_BADGE_CLASS[reasonParsed.reasonCategory] ||
                                          'bg-indigo-100 text-indigo-900 ring-indigo-300'
                                        }`}
                                      >
                                        {reasonParsed.reasonCategory}
                                      </span>
                                    ) : null}
                                    <span
                                      className={`truncate font-extrabold ${
                                        M4_REASON_TEXT_CLASS[reasonParsed.reasonCategory] || 'text-indigo-900'
                                      }`}
                                    >
                                      {formatReasonDisplayLabel(reasonParsed.reason)}
                                    </span>
                                  </span>
                                ) : needsReason ? (
                                  <span className="text-xs font-bold text-blue-700">
                                    + Add time loss reason
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setReasonDialog({
                                  machineId: snap.machineId,
                                  machineName: snap.machineName,
                                })
                              }
                              className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 touch-manipulation"
                            >
                              Log time loss / reason
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveMobileTab('trends');
              navigate('/production_tracker');
            }}
            className="flex w-full min-h-[3rem] items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white py-3 font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 touch-manipulation"
          >
            <BarChart2 className="h-5 w-5" />
            View hourly trend (all lines)
          </button>
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
