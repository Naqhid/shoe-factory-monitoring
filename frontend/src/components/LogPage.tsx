import React from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from './ConfirmDialog';

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
  code?: string;
}

const FILTER_LABEL = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';
const FILTER_CONTROL =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 disabled:opacity-60 transition-shadow';
const BTN_PRIMARY =
  'inline-flex justify-center items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60 transition-colors';

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
  const [deactivatingSessions, setDeactivatingSessions] = React.useState<Set<string>>(new Set());
  const [deactivateTarget, setDeactivateTarget] = React.useState<SessionLogEntry | null>(null);

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
    const withEff = logs.filter((l) => Number(l.avg_efficiency) > 0);
    const avgEff =
      withEff.length > 0
        ? withEff.reduce((s, l) => s + Number(l.avg_efficiency), 0) / withEff.length
        : 0;
    return { total: logs.length, active, totalOutput, avgEff };
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
                Mobile operator sessions by line and date — expand a row for cycle details, or deactivate / reactivate logins.
              </p>
            </div>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-700">
                <Clock className="h-4 w-4" aria-hidden />
                <p className="text-[11px] font-bold uppercase tracking-wide">Avg efficiency</p>
              </div>
              <p className="text-3xl font-black text-blue-900 mt-2 tabular-nums">
                {summary.avgEff > 0 ? `${summary.avgEff.toFixed(1)}%` : '—'}
              </p>
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
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Eff %</th>
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
                        <td
                          className={`px-3 py-3 text-sm font-bold text-center tabular-nums ${
                            log.avg_efficiency >= 90
                              ? 'text-green-600'
                              : log.avg_efficiency >= 70
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {formatNumber(log.avg_efficiency, 1)}
                          {log.avg_efficiency > 0 ? '%' : ''}
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
                                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Efficiency</th>
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
