import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL, apiFetch } from '../services/api';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  RotateCcw,
  UserX,
  Filter,
  CalendarDays,
  FileText,
  Loader2,
  Users,
  Activity,
  TrendingUp,
  X,
  History,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from './ConfirmDialog';
import { SearchableSelect } from './SearchableSelect';

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
  total_output: number;
  total_cycles: number;
  total_actual_mins: number;
  total_target_mins: number;
  avg_efficiency: number;
  pace_efficiency?: number;
  pace_in_progress_actual?: number;
  pace_in_progress_expected?: number;
  pace_daily_target?: number;
  total_idle_mins: number;
  has_active_cycle?: number;
  last_finish_time: string | null;
}

interface YesterdayLoginAssignment {
  machine_id: string;
  machine_name: string;
  work_centre_id: number;
  work_centre_name: string;
  emp_code: string;
  emp_name: string;
  last_activity_at: string | null;
  today_status: 'not_logged' | 'same' | 'different';
  today_emp_code?: string | null;
  today_emp_name?: string | null;
}

interface YesterdayLoginPreview {
  source_date: string;
  today_date: string;
  total: number;
  assignments: YesterdayLoginAssignment[];
}

interface YesterdayActivateResult {
  machine_id: string;
  machine_name?: string;
  emp_code: string;
  emp_name?: string;
  success: boolean;
  error?: string;
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
  code?: string;
}

interface EmployeeOption {
  code: string;
  name: string;
  work_centre_id?: number;
}

interface EditableLoginRow extends YesterdayLoginAssignment {
  login_emp_code: string;
  login_emp_name: string;
}

const FILTER_LABEL = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';
const FILTER_CONTROL =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 disabled:opacity-60 transition-shadow';
const BTN_PRIMARY =
  'inline-flex justify-center items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60 transition-colors';

const LOGS_MACHINE_STORAGE_KEY = 'logs_context_machine_id';

const readUserMachineId = (): string => {
  try {
    const raw = localStorage.getItem('user_info');
    if (!raw) return '';
    const user = JSON.parse(raw);
    return String(user.machine_id || '').trim();
  } catch {
    return '';
  }
};

const resolveContextMachineId = (searchParams: URLSearchParams): string => {
  const fromUrl =
    searchParams.get('machine') ||
    searchParams.get('machine_id') ||
    searchParams.get('machineId') ||
    '';
  if (fromUrl.trim()) {
    try {
      localStorage.setItem(LOGS_MACHINE_STORAGE_KEY, fromUrl.trim());
    } catch {
      // ignore storage errors
    }
    return fromUrl.trim();
  }
  try {
    const stored = localStorage.getItem(LOGS_MACHINE_STORAGE_KEY);
    if (stored?.trim()) return stored.trim();
  } catch {
    // ignore storage errors
  }
  return readUserMachineId();
};

const paceEfficiencyClass = (pct: number | null | undefined): string => {
  const n = Number(pct);
  if (!Number.isFinite(n) || n <= 0) return 'text-slate-400';
  if (n > 90) return 'text-emerald-600';
  if (n >= 70) return 'text-amber-600';
  if (n >= 50) return 'text-orange-600';
  return 'text-red-600';
};

const getLogPaceEfficiency = (log: SessionLogEntry): number =>
  Number(log.pace_efficiency ?? 0);

const formatPaceEfficiencyLabel = (log: SessionLogEntry): string => {
  const pct = getLogPaceEfficiency(log);
  const actual = Number(log.pace_in_progress_actual ?? log.total_output ?? 0);
  const expected = Number(log.pace_in_progress_expected ?? 0);
  if (expected > 0) {
    return `In progress ${pct}% (${actual} / ${expected} target so far)`;
  }
  if (pct > 0) return `In progress ${pct}%`;
  return 'No routing target for pace';
};

const LogPage: React.FC = () => {
  const [searchParams] = useSearchParams();
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
  const [deactivatingSessions, setDeactivatingSessions] = React.useState<Set<string>>(new Set());
  const [deactivateTarget, setDeactivateTarget] = React.useState<SessionLogEntry | null>(null);
  const [yesterdayPreviewOpen, setYesterdayPreviewOpen] = React.useState(false);
  const [yesterdayPreview, setYesterdayPreview] = React.useState<YesterdayLoginPreview | null>(null);
  const [yesterdayPreviewLoading, setYesterdayPreviewLoading] = React.useState(false);
  const [yesterdayActivating, setYesterdayActivating] = React.useState(false);
  const [clearActiveBeforeYesterdayLogin, setClearActiveBeforeYesterdayLogin] = React.useState(false);
  const [yesterdayActivateResults, setYesterdayActivateResults] = React.useState<YesterdayActivateResult[] | null>(null);
  const [editableLoginRows, setEditableLoginRows] = React.useState<EditableLoginRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [sourceDate, setSourceDate] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  });

  const todayKey = React.useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  const contextMachineId = React.useMemo(
    () => resolveContextMachineId(searchParams),
    [searchParams]
  );

  const thisMachineLogin = React.useMemo(() => {
    if (!contextMachineId || selectedDate !== todayKey) return null;
    return (
      logs.find(
        (log) =>
          String(log.machine_id) === String(contextMachineId) &&
          (log.status === 'active' || log.status === 'waiting')
      ) || null
    );
  }, [contextMachineId, logs, selectedDate, todayKey]);

  const contextMachineLabel = React.useMemo(() => {
    if (!contextMachineId) return '';
    const anyRow = logs.find((log) => String(log.machine_id) === String(contextMachineId));
    if (anyRow?.machine_name) return `${anyRow.machine_name} (${contextMachineId})`;
    return contextMachineId;
  }, [contextMachineId, logs]);

  const showThisMachineNotLoggedIn =
    Boolean(contextMachineId) && selectedDate === todayKey && !loading && !thisMachineLogin;

  const lineLabel = (wc: WorkCentre) => (wc.code ? `${wc.code} - ${wc.name}` : wc.name);

  const hasFilters = selectedWorkCentre !== 'all' || selectedDate !== today;

  const clearFilters = () => {
    setSelectedWorkCentre('all');
    setSelectedDate(today);
  };

  const setDatePreset = (preset: 'today' | 'yesterday') => {
    const d = new Date();
    if (preset === 'yesterday') d.setDate(d.getDate() - 1);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  };

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

  const summary = React.useMemo(() => {
    const active = logs.filter((l) => l.status === 'active' || l.status === 'waiting').length;
    const totalOutput = logs.reduce((s, l) => s + (Number(l.total_output) || 0), 0);
    return { total: logs.length, active, totalOutput };
  }, [logs]);

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

  const statusBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'active') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
      );
    }
    if (s === 'waiting') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
          Waiting
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 capitalize">
        {status || '—'}
      </span>
    );
  };

  const toggleExpand = async (sessionId: string, log: SessionLogEntry) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
      setExpandedRows(newExpanded);
      return;
    }

    newExpanded.add(sessionId);
    setExpandedRows(newExpanded);

    if (!cycleDetails[sessionId] && log.total_cycles > 0) {
      setLoadingCycles((prev) => new Set(prev).add(sessionId));
      try {
        const params = new URLSearchParams({
          machine_id: log.machine_id,
          emp_code: log.emp_code,
          date: selectedDate,
        });
        const response = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/cycles?${params}`);
        const result = await response.json();
        if (result.success) {
          setCycleDetails((prev) => ({ ...prev, [sessionId]: result.data }));
        }
      } catch {
        // Silent fail - don't show error for cycle details
      } finally {
        setLoadingCycles((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    }
  };

  const getEmployeeLabel = (log: SessionLogEntry) =>
    log.emp_name ? `${log.emp_name} (${log.emp_code})` : log.emp_code || 'this employee';

  const performDeactivate = async (log: SessionLogEntry) => {
    if (!log?.session_id || deactivatingSessions.has(log.session_id)) return;
    setDeactivatingSessions((prev) => new Set(prev).add(log.session_id));
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/deactivate`, {
        method: 'POST',
        body: JSON.stringify({ session_id: log.session_id }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(result.message || 'Session deactivated');
        await handleRefresh();
      } else {
        toast.error(result.message || 'Failed to deactivate session');
      }
    } catch {
      toast.error('Unable to deactivate session');
    } finally {
      setDeactivatingSessions((prev) => {
        const next = new Set(prev);
        next.delete(log.session_id);
        return next;
      });
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

  const closeYesterdayModal = () => {
    setYesterdayPreviewOpen(false);
    setYesterdayPreview(null);
    setYesterdayActivateResults(null);
    setClearActiveBeforeYesterdayLogin(false);
    setEditableLoginRows([]);
  };

  const employeesForWorkCentre = React.useCallback(
    (workCentreId?: number) => {
      if (!workCentreId) return employees;
      const onLine = employees.filter((e) => Number(e.work_centre_id) === Number(workCentreId));
      return onLine.length > 0 ? onLine : employees;
    },
    [employees]
  );

  const buildEditableRows = (assignments: YesterdayLoginAssignment[]): EditableLoginRow[] =>
    assignments.map((row) => ({
      ...row,
      login_emp_code: row.emp_code,
      login_emp_name: row.emp_name || row.emp_code,
    }));

  const updateLoginOperator = (machineId: string, empCode: string) => {
    if (!empCode) return;
    const emp = employees.find((e) => String(e.code) === String(empCode));
    setEditableLoginRows((prev) =>
      prev.map((row) =>
        String(row.machine_id) === String(machineId)
          ? {
              ...row,
              login_emp_code: empCode,
              login_emp_name: emp?.name || empCode,
            }
          : row
      )
    );
  };

  const removeLoginRow = (machineId: string) => {
    setEditableLoginRows((prev) => prev.filter((row) => String(row.machine_id) !== String(machineId)));
  };

  const operatorSelectOptions = React.useCallback(
    (row: EditableLoginRow) => {
      const lineEmployees = employeesForWorkCentre(row.work_centre_id);
      const list =
        lineEmployees.some((e) => String(e.code) === String(row.login_emp_code))
          ? lineEmployees
          : [
              { code: row.login_emp_code, name: row.login_emp_name, work_centre_id: row.work_centre_id },
              ...lineEmployees,
            ];
      return list.map((emp) => ({
        value: String(emp.code),
        label: emp.name,
        subLabel: String(emp.code),
      }));
    },
    [employeesForWorkCentre]
  );

  const getTodayStatusForLogin = (row: EditableLoginRow) => {
    if (!row.today_emp_code) return 'not_logged' as const;
    if (String(row.today_emp_code) === String(row.login_emp_code)) return 'same' as const;
    return 'different' as const;
  };

  const loadYesterdayLoginPreview = async () => {
    setYesterdayPreviewLoading(true);
    setYesterdayActivateResults(null);
    try {
      const params = new URLSearchParams();
      if (selectedWorkCentre !== 'all') params.set('work_centre_id', selectedWorkCentre);
      params.set('date', sourceDate);

      const [previewRes, employeesRes] = await Promise.all([
        apiFetch(
          `${API_BASE_URL}/api/mobile-sessions/yesterday-login-preview${params.toString() ? `?${params.toString()}` : ''}`
        ),
        apiFetch(`${API_BASE_URL}/api/masters/employees?limit=2000`),
      ]);

      const result = await previewRes.json();
      if (!result.success) {
        toast.error(result.message || 'Failed to load yesterday logins');
        return;
      }

      try {
        const empJson = await employeesRes.json();
        if (empJson.success && Array.isArray(empJson.data)) {
          setEmployees(
            empJson.data.map((e: { code: string; name: string; work_centre_id?: number }) => ({
              code: String(e.code),
              name: String(e.name || e.code),
              work_centre_id: e.work_centre_id,
            }))
          );
        }
      } catch {
        // Preview still works; operator dropdown may be limited
      }

      const preview = result.data as YesterdayLoginPreview;
      setYesterdayPreview(preview);
      setEditableLoginRows(buildEditableRows(preview.assignments || []));
      setYesterdayPreviewOpen(true);
      if (!preview.assignments?.length) {
        toast.error(`No machine logins found for ${preview.source_date || 'yesterday'}.`);
      }
    } catch {
      toast.error('Unable to load yesterday login preview');
    } finally {
      setYesterdayPreviewLoading(false);
    }
  };

  const handleActivateYesterdayLogins = async () => {
    if (!editableLoginRows.length) return;
    setYesterdayActivating(true);
    try {
      const params = new URLSearchParams();
      if (selectedWorkCentre !== 'all') params.set('work_centre_id', selectedWorkCentre);
      const assignments = editableLoginRows.map((row) => ({
        machine_id: row.machine_id,
        machine_name: row.machine_name,
        work_centre_id: row.work_centre_id,
        work_centre_name: row.work_centre_name,
        emp_code: row.login_emp_code,
        emp_name: row.login_emp_name,
      }));
      const response = await apiFetch(
        `${API_BASE_URL}/api/mobile-sessions/activate-yesterday-logins${params.toString() ? `?${params.toString()}` : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_date: yesterdayPreview?.source_date,
            clear_active_sessions: clearActiveBeforeYesterdayLogin,
            assignments,
          }),
        }
      );
      const result = await response.json();
      if (!result.success) {
        toast.error(result.message || 'Bulk login failed');
        return;
      }
      setYesterdayActivateResults((result.data?.results || []) as YesterdayActivateResult[]);
      toast.success(result.message || 'Bulk login completed');
      if (selectedDate === todayKey) {
        await handleRefresh();
      } else {
        setSelectedDate(todayKey);
      }
    } catch {
      toast.error('Unable to activate yesterday logins');
    } finally {
      setYesterdayActivating(false);
    }
  };

  const todayStatusLabel = (row: EditableLoginRow) => {
    const status = getTodayStatusForLogin(row);
    const changed = String(row.login_emp_code) !== String(row.emp_code);
    if (status === 'same') {
      return (
        <span className="text-emerald-700 font-semibold">
          {changed ? 'Will update login' : 'Already same'}
        </span>
      );
    }
    if (status === 'different') {
      return (
        <span className="text-amber-700 font-semibold">
          Different today
          {row.today_emp_code ? ` (${row.today_emp_name || row.today_emp_code})` : ''}
        </span>
      );
    }
    return <span className="text-slate-500">Not logged in</span>;
  };

  const deactivateMessage = deactivateTarget
    ? `Deactivate login for ${getEmployeeLabel(deactivateTarget)} on ${deactivateTarget.machine_name || deactivateTarget.machine_id}? They will need to scan and log in again on mobile.`
    : '';

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-5">
        <ConfirmDialog
          isOpen={deactivateTarget !== null}
          title="Deactivate session?"
          message={deactivateMessage}
          confirmText="Deactivate"
          cancelText="Cancel"
          onConfirm={() => {
            if (!deactivateTarget) return;
            const log = deactivateTarget;
            setDeactivateTarget(null);
            void performDeactivate(log);
          }}
          onCancel={() => setDeactivateTarget(null)}
        />

        <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5 ring-1 ring-black/[0.02]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Operations</p>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
                <FileText className="h-6 w-6 text-blue-600 shrink-0" aria-hidden />
                Machine Login Logs
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Mobile operator sessions by line and date — expand a row for cycle details, deactivate / reactivate, or bulk login same as yesterday.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void loadYesterdayLoginPreview()}
                disabled={yesterdayPreviewLoading || yesterdayActivating}
                className="inline-flex justify-center items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-sm font-semibold shadow-sm disabled:opacity-60 transition-colors"
              >
                {yesterdayPreviewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <History className="h-4 w-4" />
                )}
                Same as yesterday
              </button>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={loading}
                className={`${BTN_PRIMARY} shrink-0`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {showThisMachineNotLoggedIn && (
          <div
            className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 shadow-sm ring-1 ring-amber-200/70 flex items-start gap-3"
            role="alert"
          >
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-950">This machine is not logged in</p>
              <p className="text-sm text-amber-900/90 mt-0.5">
                <span className="font-semibold">{contextMachineLabel}</span> has no active operator session today.
                Use{' '}
                <Link
                  to={`/line_setup_form?machine=${encodeURIComponent(contextMachineId)}`}
                  className="font-semibold underline underline-offset-2 hover:text-amber-950"
                >
                  Line Setup
                </Link>{' '}
                or <span className="font-semibold">Same as yesterday</span> above to log in.
              </p>
            </div>
          </div>
        )}

        {yesterdayPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 sm:px-5 py-4">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Bulk login</p>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">Login same as selected date</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {yesterdayPreview
                      ? `Last operator per machine from ${yesterdayPreview.source_date} → activate for ${yesterdayPreview.today_date}. Edit any row if a new operator joined.`
                      : 'Loading assignments…'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <label htmlFor="sourceDate" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Copy from date
                    </label>
                    <input
                      id="sourceDate"
                      type="date"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400"
                      value={sourceDate}
                      onChange={(e) => setSourceDate(e.target.value)}
                      max={new Date().toLocaleDateString('en-CA')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadYesterdayLoginPreview()}
                    disabled={yesterdayPreviewLoading || yesterdayActivating}
                    className="mt-5 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                  >
                    {yesterdayPreviewLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Load
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeYesterdayModal}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4 space-y-4">
                {yesterdayPreviewLoading && !yesterdayPreview ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    Loading yesterday logins…
                  </div>
                ) : yesterdayPreview && yesterdayPreview.assignments.length === 0 ? (
                  <p className="text-sm text-slate-600 py-8 text-center">
                    No machine logins found for {yesterdayPreview.source_date}.
                  </p>
                ) : yesterdayPreview ? (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Line</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Machine</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Yesterday</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Login as</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Today</th>
                            {yesterdayActivateResults && (
                              <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Result</th>
                            )}
                            {!yesterdayActivateResults && (
                              <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase w-10"></th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {editableLoginRows.map((row) => {
                            const result = yesterdayActivateResults?.find(
                              (r) => String(r.machine_id) === String(row.machine_id)
                            );
                            const isChanged = String(row.login_emp_code) !== String(row.emp_code);
                            return (
                              <tr key={`${row.machine_id}-${row.emp_code}`} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 text-slate-700">{row.work_centre_name || '—'}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">{row.machine_name || row.machine_id}</td>
                                <td className="px-3 py-2 text-slate-600">
                                  {row.emp_name ? (
                                    <>
                                      <span className="font-medium">{row.emp_name}</span>
                                      <span className="block text-xs text-slate-500">{row.emp_code}</span>
                                    </>
                                  ) : (
                                    row.emp_code
                                  )}
                                </td>
                                <td className="px-3 py-2 min-w-[200px]">
                                  {!yesterdayActivateResults ? (
                                    <div className="space-y-1">
                                      <SearchableSelect
                                        compact
                                        value={row.login_emp_code}
                                        options={operatorSelectOptions(row)}
                                        onChange={(code) => updateLoginOperator(row.machine_id, code)}
                                        placeholder="Select operator"
                                        searchPlaceholder="Search name or code…"
                                        footerCountLabel="operators"
                                        className="min-w-[180px]"
                                      />
                                      {isChanged && (
                                        <span className="inline-flex rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                                          Changed from yesterday
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="font-medium text-slate-900">{row.login_emp_name}</span>
                                      <span className="block text-xs text-slate-500">{row.login_emp_code}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs">{todayStatusLabel(row)}</td>
                                {yesterdayActivateResults && (
                                  <td className="px-3 py-2 text-xs">
                                    {result ? (
                                      result.success ? (
                                        <span className="text-emerald-700 font-semibold">Logged in</span>
                                      ) : (
                                        <span className="text-red-700 font-semibold" title={result.error}>
                                          Failed
                                        </span>
                                      )
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                )}
                                {!yesterdayActivateResults && (
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeLoginRow(String(row.machine_id))}
                                      className="p-1 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                                      title="Remove this row from login"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {!yesterdayActivateResults && (
                      <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearActiveBeforeYesterdayLogin}
                          onChange={(e) => setClearActiveBeforeYesterdayLogin(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          Clear today&apos;s active sessions on selected line(s) before logging in
                          <span className="block text-xs text-slate-500 mt-0.5">
                            Use if operators are stuck on wrong machines and bulk login fails.
                          </span>
                        </span>
                      </label>
                    )}
                  </>
                ) : null}
              </div>

              <div className="border-t border-slate-200 px-4 sm:px-5 py-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeYesterdayModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  {yesterdayActivateResults ? 'Close' : 'Cancel'}
                </button>
                {!yesterdayActivateResults && editableLoginRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleActivateYesterdayLogins()}
                    disabled={yesterdayActivating}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {yesterdayActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                    Login all ({editableLoginRows.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ring-1 ring-black/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" aria-hidden />
              <p className="text-sm font-bold text-slate-800">Filters</p>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label htmlFor="lineFilter" className={FILTER_LABEL}>
                <span className="inline-flex items-center gap-1"><Filter className="h-3 w-3" aria-hidden /> Line</span>
              </label>
              <select
                id="lineFilter"
                className={FILTER_CONTROL}
                value={selectedWorkCentre}
                onChange={(e) => setSelectedWorkCentre(e.target.value)}
              >
                <option value="all">All lines</option>
                {workCentres.map((line) => (
                  <option key={line.id} value={String(line.id)}>{lineLabel(line)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dateFilter" className={FILTER_LABEL}>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden /> Date</span>
              </label>
              <input
                id="dateFilter"
                type="date"
                className={FILTER_CONTROL}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDatePreset('today')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  selectedDate === today
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('yesterday')}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold border bg-white text-slate-600 border-slate-200 hover:border-slate-300 transition-colors"
              >
                Yesterday
              </button>
            </div>
          </div>
        </div>

        {!loading && !error && logs.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="h-4 w-4" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-wide">Sessions</p>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2 tabular-nums">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <Activity className="h-4 w-4" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-wide">Active now</p>
              </div>
              <p className="text-3xl font-black text-emerald-900 mt-2 tabular-nums">{summary.active}</p>
            </div>
            <div className="rounded-2xl border border-green-200/80 bg-gradient-to-br from-green-50/50 to-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-green-700">
                <TrendingUp className="h-4 w-4" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-wide">Total output</p>
              </div>
              <p className="text-3xl font-black text-green-900 mt-2 tabular-nums">{summary.totalOutput}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">pairs</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm font-medium flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-black/[0.02]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/90 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Line</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Machine</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Login</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last activity</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cycles</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Output</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pace eff</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cycle</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                      <p className="text-sm text-slate-500 mt-3">Loading login logs…</p>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center">
                      <FileText className="h-10 w-10 text-slate-300 mx-auto" aria-hidden />
                      <p className="text-sm font-semibold text-slate-700 mt-3">No login logs found</p>
                      <p className="text-xs text-slate-500 mt-1">Try another date or line, or clear filters.</p>
                      {hasFilters && (
                        <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800">
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.session_id}>
                      <tr
                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                          expandedRows.has(log.session_id) ? 'bg-blue-50/40' : ''
                        }`}
                        onClick={() => toggleExpand(log.session_id, log)}
                      >
                        <td className="px-3 py-3 text-sm text-slate-700">
                          <div className="flex items-center gap-1.5 min-w-[120px]">
                            {expandedRows.has(log.session_id) ? (
                              <ChevronDown className="h-4 w-4 text-blue-600 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                            )}
                            <span className="font-medium truncate">{log.work_centre_name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-slate-800">{log.machine_name || log.machine_id}</td>
                        <td className="px-3 py-3 text-sm text-slate-700">
                          {log.emp_name ? (
                            <>
                              <span className="font-medium">{log.emp_name}</span>
                              <span className="text-slate-500 text-xs block">{log.emp_code}</span>
                            </>
                          ) : (
                            log.emp_code
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDateTime(log.activated_at)}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDateTime(log.last_finish_time)}</td>
                        <td className="px-3 py-3 text-sm text-slate-700 text-center tabular-nums">{formatNumber(log.total_cycles)}</td>
                        <td className="px-3 py-3 text-sm font-bold text-green-700 text-center tabular-nums">{formatNumber(log.total_output)}</td>
                        <td className="px-3 py-3 text-sm text-center">
                          {Number(log.pace_in_progress_expected) > 0 || getLogPaceEfficiency(log) > 0 ? (
                            <div title={formatPaceEfficiencyLabel(log)}>
                              <p className={`font-bold tabular-nums ${paceEfficiencyClass(getLogPaceEfficiency(log))}`}>
                                {getLogPaceEfficiency(log)}%
                              </p>
                              {Number(log.pace_in_progress_expected) > 0 && (
                                <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                                  {Number(log.pace_in_progress_actual ?? log.total_output ?? 0)} / {Number(log.pace_in_progress_expected)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600 text-center">{formatDuration(log.total_actual_mins)}</td>
                        <td className="px-3 py-3 text-xs text-blue-700 font-medium text-center max-w-[140px]">
                          {getCycleStatus(log.total_cycles, log.status, log.has_active_cycle)}
                        </td>
                        <td className="px-3 py-3">{statusBadge(log.status)}</td>
                        <td className="px-3 py-3 text-sm text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {log.status === 'active' || log.status === 'waiting' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeactivateTarget(log);
                                }}
                                disabled={deactivatingSessions.has(log.session_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                <UserX className={`h-3 w-3 ${deactivatingSessions.has(log.session_id) ? 'animate-pulse' : ''}`} />
                                {deactivatingSessions.has(log.session_id) ? '…' : 'Deactivate'}
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReactivate(log);
                                }}
                                disabled={reactivatingSessions.has(log.session_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                              >
                                <RotateCcw className={`h-3 w-3 ${reactivatingSessions.has(log.session_id) ? 'animate-spin' : ''}`} />
                                {reactivatingSessions.has(log.session_id) ? '…' : 'Reactivate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedRows.has(log.session_id) && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={12} className="px-4 py-4">
                            <div className="ml-4 border-l-2 border-blue-400 pl-4 rounded-r-xl bg-white p-4 ring-1 ring-slate-200/80">
                              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-600" aria-hidden />
                                Cycle details
                                <span className="text-xs font-semibold text-slate-500">({log.total_cycles} cycles)</span>
                              </h4>

                              {loadingCycles.has(log.session_id) ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                  Loading cycles…
                                </div>
                              ) : cycleDetails[log.session_id]?.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-slate-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Cycle</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Start</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Finish</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Duration</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Output</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Cycle eff</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {cycleDetails[log.session_id].map((cycle) => (
                                        <tr key={cycle.id} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 font-bold text-blue-700">#{cycle.cycle_number}</td>
                                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDateTime(cycle.start_time)}</td>
                                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDateTime(cycle.finish_time)}</td>
                                          <td className="px-3 py-2 text-slate-600">{formatDuration(cycle.actual_mins)}</td>
                                          <td className="px-3 py-2 text-slate-700 font-medium">{cycle.output_pairs} pairs</td>
                                          <td
                                            className={`px-3 py-2 font-bold ${
                                              cycle.efficiency >= 90
                                                ? 'text-green-600'
                                                : cycle.efficiency >= 70
                                                  ? 'text-amber-600'
                                                  : 'text-red-600'
                                            }`}
                                          >
                                            {cycle.efficiency}%
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500 italic">No cycle details available for this session.</p>
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
      </div>
    </div>
  );
};

export default LogPage;
