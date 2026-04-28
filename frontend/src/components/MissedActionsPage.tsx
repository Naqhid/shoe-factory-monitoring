import React from 'react';
import { AlertTriangle, BellOff, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

type MissedAction = {
  issue_key: string;
  session_id: string;
  machine_id: string;
  machine_name: string;
  employee_code: string;
  employee_name: string;
  work_centre_name: string;
  action_type: 'START_PENDING' | 'FINISH_PENDING';
  action_label: string;
  overdue_mins: number;
  details: string;
  state?: {
    acknowledged?: boolean;
    acknowledged_at?: string | null;
    snoozed_until?: string | null;
    is_snoozed?: boolean;
  };
};

type LocalActionMeta = {
  rootCause?: string;
  lastAction?: string;
  lastActionAt?: string;
  trail?: Array<{ action: string; at: string }>;
};

type DailyReportEvent = {
  id: number;
  work_centre_name: string;
  machine_id: string;
  machine_name: string;
  employee_code: string;
  employee_name: string;
  start_time: string;
  finish_time: string;
  target_mins: number;
  actual_mins: number;
  extra_mins: number;
  start_gap_mins: number;
  inactive_mins: number;
};

type DailyReportLine = {
  work_centre_name: string;
  cycles: number;
  inactive_mins: number;
  extra_mins: number;
};

const LOCAL_META_KEY = 'missed_actions_meta_v1';

export const MissedActionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'live' | 'daily'>('live');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isActionLoading, setIsActionLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<MissedAction[]>([]);
  const [summary, setSummary] = React.useState({ total: 0, start_pending: 0, finish_pending: 0 });
  const [selectedLine, setSelectedLine] = React.useState<string>('all');
  const [issueFilter, setIssueFilter] = React.useState<'all' | 'START_PENDING' | 'FINISH_PENDING'>('all');
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [showMuted, setShowMuted] = React.useState(false);
  const [dailyReportDate, setDailyReportDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [dailyLine, setDailyLine] = React.useState<string>('all');
  const [dailyLoading, setDailyLoading] = React.useState(false);
  const [dailyError, setDailyError] = React.useState<string | null>(null);
  const [dailySummary, setDailySummary] = React.useState({
    total_cycles: 0,
    total_inactive_mins: 0,
    total_extra_mins: 0,
    total_lost_mins: 0,
  });
  const [dailyByLine, setDailyByLine] = React.useState<DailyReportLine[]>([]);
  const [dailyEvents, setDailyEvents] = React.useState<DailyReportEvent[]>([]);
  const [expandedMachineKeys, setExpandedMachineKeys] = React.useState<Record<string, boolean>>({});
  const [localMeta, setLocalMeta] = React.useState<Record<string, LocalActionMeta>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'daily') setActiveTab('daily');
    if (tab === 'live') setActiveTab('live');
  }, []);

  const persistMeta = React.useCallback((next: Record<string, LocalActionMeta>) => {
    setLocalMeta(next);
    try {
      localStorage.setItem(LOCAL_META_KEY, JSON.stringify(next));
    } catch {
      // non-blocking
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions?startReminderMins=10&finishGraceMins=0`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load missed actions');
      setItems(result.data || []);
      setSummary(result.summary || { total: 0, start_pending: 0, finish_pending: 0 });
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to load missed actions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const id = window.setInterval(() => {
      fetchData();
    }, 30000);
    return () => window.clearInterval(id);
  }, [fetchData]);

  const fetchDailyReport = React.useCallback(async () => {
    setDailyLoading(true);
    setDailyError(null);
    try {
      const params = new URLSearchParams();
      params.set('date', dailyReportDate);
      if (dailyLine !== 'all') params.set('line', dailyLine);
      params.set('startReminderMins', '10');
      const response = await apiFetch(`${API_BASE}/api/missed-actions/daily-report?${params.toString()}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || result.message || 'Failed to load daily report');
      setDailySummary(result.summary || { total_cycles: 0, total_inactive_mins: 0, total_extra_mins: 0, total_lost_mins: 0 });
      setDailyByLine(result.by_line || []);
      setDailyEvents(result.events || []);
    } catch (e: any) {
      setDailyError(e.message || 'Failed to load daily report');
    } finally {
      setDailyLoading(false);
    }
  }, [dailyLine, dailyReportDate]);

  React.useEffect(() => {
    if (activeTab !== 'daily') return;
    fetchDailyReport();
  }, [activeTab, fetchDailyReport]);

  React.useEffect(() => {
    setExpandedMachineKeys({});
  }, [dailyEvents, dailyReportDate, dailyLine]);

  const lineOptions = React.useMemo(() => {
    return Array.from(new Set(items.map((i) => i.work_centre_name).filter(Boolean))).sort();
  }, [items]);

  const getSeverity = (overdueMins: number) => {
    if (overdueMins >= 60) return { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' };
    if (overdueMins >= 30) return { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (overdueMins >= 10) return { label: 'Medium', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Low', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
  };

  const getSlaStatus = (overdueMins: number) => {
    const rounded = Math.max(0, Math.round(Number(overdueMins || 0)));
    if (rounded >= 30) return { label: `Breached by ${Math.max(0, rounded - 30)}m`, cls: 'text-red-700 bg-red-100' };
    if (rounded >= 15) return { label: `Warning (${rounded}m)`, cls: 'text-amber-700 bg-amber-100' };
    const dueIn = Math.max(0, 15 - rounded);
    return { label: `Due in ${dueIn}m`, cls: 'text-blue-700 bg-blue-100' };
  };

  const getPriorityScore = (item: MissedAction, recurrenceCount: number) => {
    const base = item.overdue_mins >= 60 ? 5 : item.overdue_mins >= 30 ? 4 : item.overdue_mins >= 15 ? 3 : 2;
    const finishWeight = item.action_type === 'FINISH_PENDING' ? 1 : 0;
    const repeatWeight = recurrenceCount >= 3 ? 1 : 0;
    return Math.min(7, base + finishWeight + repeatWeight);
  };

  const visibleItems = React.useMemo(() => {
    if (showMuted) return items;
    return items.filter((item) => {
      if (item.state?.acknowledged) return false;
      if (item.state?.is_snoozed) return false;
      return true;
    });
  }, [items, showMuted]);

  const filteredItems = React.useMemo(() => {
    return visibleItems.filter((item) => {
      if (selectedLine !== 'all' && item.work_centre_name !== selectedLine) return false;
      if (issueFilter !== 'all' && item.action_type !== issueFilter) return false;
      return true;
    });
  }, [visibleItems, selectedLine, issueFilter]);

  const recurrenceMap = React.useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => {
      const key = `${i.machine_id || i.machine_name}|${i.action_type}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [items]);

  const sortedFilteredItems = React.useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const recA = recurrenceMap.get(`${a.machine_id || a.machine_name}|${a.action_type}`) || 0;
      const recB = recurrenceMap.get(`${b.machine_id || b.machine_name}|${b.action_type}`) || 0;
      const priA = getPriorityScore(a, recA);
      const priB = getPriorityScore(b, recB);
      if (priA !== priB) return priB - priA;
      return b.overdue_mins - a.overdue_mins;
    });
  }, [filteredItems, recurrenceMap]);

  const filteredSummary = React.useMemo(() => {
    return {
      total: sortedFilteredItems.length,
      start_pending: sortedFilteredItems.filter((i) => i.action_type === 'START_PENDING').length,
      finish_pending: sortedFilteredItems.filter((i) => i.action_type === 'FINISH_PENDING').length,
    };
  }, [sortedFilteredItems]);

  const groupedItems = React.useMemo(() => {
    return sortedFilteredItems.reduce<Record<string, MissedAction[]>>((acc, item) => {
      const key = item.work_centre_name || 'Unknown Line';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [sortedFilteredItems]);

  const dailyLineMachineGroups = React.useMemo(() => {
    const lineMap = new Map<string, {
      lineName: string;
      cycles: number;
      inactive: number;
      extra: number;
      machines: Map<string, {
        machineKey: string;
        machineName: string;
        cycles: number;
        inactive: number;
        extra: number;
        events: DailyReportEvent[];
      }>;
    }>();

    dailyEvents.forEach((event) => {
      const lineName = event.work_centre_name || 'N/A';
      const machineKey = event.machine_id || event.machine_name || 'UNKNOWN';
      const machineName = event.machine_name || event.machine_id || 'N/A';

      if (!lineMap.has(lineName)) {
        lineMap.set(lineName, {
          lineName,
          cycles: 0,
          inactive: 0,
          extra: 0,
          machines: new Map(),
        });
      }
      const lineGroup = lineMap.get(lineName)!;
      lineGroup.cycles += 1;
      lineGroup.inactive += Number(event.inactive_mins || 0);
      lineGroup.extra += Number(event.extra_mins || 0);

      if (!lineGroup.machines.has(machineKey)) {
        lineGroup.machines.set(machineKey, {
          machineKey,
          machineName,
          cycles: 0,
          inactive: 0,
          extra: 0,
          events: [],
        });
      }
      const machineGroup = lineGroup.machines.get(machineKey)!;
      machineGroup.cycles += 1;
      machineGroup.inactive += Number(event.inactive_mins || 0);
      machineGroup.extra += Number(event.extra_mins || 0);
      machineGroup.events.push(event);
    });

    return Array.from(lineMap.values()).map((line) => ({
      ...line,
      machines: Array.from(line.machines.values()).sort((a, b) => (b.inactive + b.extra) - (a.inactive + a.extra)),
    })).sort((a, b) => (b.inactive + b.extra) - (a.inactive + a.extra));
  }, [dailyEvents]);

  const lineLossRows = React.useMemo(() => {
    return [...dailyByLine]
      .map((line) => {
        const inactive = Number(line.inactive_mins || 0);
        const extra = Number(line.extra_mins || 0);
        const lost = inactive + extra;
        const perCycle = line.cycles > 0 ? lost / line.cycles : 0;
        return {
          ...line,
          inactive,
          extra,
          lost,
          perCycle,
        };
      })
      .sort((a, b) => b.lost - a.lost);
  }, [dailyByLine]);

  const totalLineLoss = React.useMemo(
    () => lineLossRows.reduce((sum, row) => sum + row.lost, 0),
    [lineLossRows]
  );

  const liveLossRows = React.useMemo(() => {
    const map = new Map<string, { line: string; activeLoss: number; issues: number }>();
    sortedFilteredItems.forEach((item) => {
      const line = item.work_centre_name || 'Unknown Line';
      if (!map.has(line)) map.set(line, { line, activeLoss: 0, issues: 0 });
      const current = map.get(line)!;
      current.activeLoss += Number(item.overdue_mins || 0);
      current.issues += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.activeLoss - a.activeLoss);
  }, [sortedFilteredItems]);

  const lineLossTrend = React.useMemo(() => {
    const now = new Date();
    const bucketStarts: Date[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      bucketStarts.push(new Date(now.getTime() - i * 60 * 60 * 1000));
    }
    const rows = bucketStarts.map((start, idx) => {
      const end = idx === bucketStarts.length - 1 ? now : bucketStarts[idx + 1];
      let inactive = 0;
      let extra = 0;
      dailyEvents.forEach((event) => {
        const eventStart = event.start_time ? new Date(event.start_time) : null;
        if (!eventStart || Number.isNaN(eventStart.getTime())) return;
        if (eventStart >= start && eventStart < end) {
          inactive += Number(event.inactive_mins || 0);
          extra += Number(event.extra_mins || 0);
        }
      });
      return {
        label: `${start.getHours().toString().padStart(2, '0')}:00`,
        inactive,
        extra,
        total: inactive + extra,
      };
    });
    return rows;
  }, [dailyEvents]);

  const acknowledgeItem = async (item: MissedAction) => {
    if (!item.issue_key) return;
    setIsActionLoading(item.issue_key);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_key: item.issue_key }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to acknowledge');
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to acknowledge');
    } finally {
      setIsActionLoading(null);
    }
  };

  const snoozeItem = async (item: MissedAction, mins: number) => {
    if (!item.issue_key) return;
    setIsActionLoading(item.issue_key);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_key: item.issue_key, minutes: mins }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to snooze');
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to snooze');
    } finally {
      setIsActionLoading(null);
    }
  };

  const logLocalAction = (item: MissedAction, action: string) => {
    const key = item.issue_key;
    if (!key) return;
    const now = new Date().toISOString();
    const current = localMeta[key] || {};
    const nextTrail = [{ action, at: now }, ...(current.trail || [])].slice(0, 10);
    persistMeta({
      ...localMeta,
      [key]: {
        ...current,
        lastAction: action,
        lastActionAt: now,
        trail: nextTrail,
      },
    });
  };

  const setRootCause = (item: MissedAction, rootCause: string) => {
    const key = item.issue_key;
    if (!key) return;
    const current = localMeta[key] || {};
    persistMeta({
      ...localMeta,
      [key]: {
        ...current,
        rootCause,
      },
    });
  };

  const acknowledgeFiltered = async () => {
    const targets = sortedFilteredItems.filter((i) => i.issue_key);
    if (targets.length === 0) return;
    setIsActionLoading('__bulk__');
    try {
      await Promise.all(
        targets.map((item) =>
          apiFetch(`${API_BASE}/api/missed-actions/ack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issue_key: item.issue_key }),
          })
        )
      );
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to acknowledge filtered items');
    } finally {
      setIsActionLoading(null);
    }
  };

  const exportFilteredCsv = () => {
    if (sortedFilteredItems.length === 0) return;
    const headers = ['line', 'machine', 'operator', 'issue', 'overdue_mins', 'severity', 'priority_score', 'sla_status', 'root_cause', 'last_action', 'details'];
    const rows = [
      `"snapshot_at","${new Date().toISOString()}"`,
      `"filtered_total","${sortedFilteredItems.length}"`,
      '',
      headers.join(','),
      ...sortedFilteredItems.map((i) => {
        const severity = getSeverity(i.overdue_mins).label;
        const recurrence = recurrenceMap.get(`${i.machine_id || i.machine_name}|${i.action_type}`) || 0;
        const priority = getPriorityScore(i, recurrence);
        const sla = getSlaStatus(i.overdue_mins).label;
        const meta = localMeta[i.issue_key] || {};
        const vals = [
          i.work_centre_name,
          i.machine_name,
          `${i.employee_name} (${i.employee_code})`,
          i.action_label,
          String(i.overdue_mins),
          severity,
          String(priority),
          sla,
          meta.rootCause || '',
          meta.lastAction ? `${meta.lastAction}${meta.lastActionAt ? ` @ ${new Date(meta.lastActionAt).toLocaleString()}` : ''}` : '',
          i.details,
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        return vals.join(',');
      }),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missed_actions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportDailyCsv = () => {
    if (dailyEvents.length === 0) return;
    const headers = ['line', 'machine', 'operator', 'start_time', 'finish_time', 'target_mins', 'actual_mins', 'inactive_mins', 'extra_mins'];
    const rows = [
      `"snapshot_at","${new Date().toISOString()}"`,
      `"report_date","${dailyReportDate}"`,
      `"total_cycles","${dailySummary.total_cycles}"`,
      `"total_inactive_mins","${dailySummary.total_inactive_mins}"`,
      `"total_extra_mins","${dailySummary.total_extra_mins}"`,
      `"total_lost_mins","${dailySummary.total_lost_mins}"`,
      '',
      headers.join(','),
      ...dailyEvents.map((i) => {
        const vals = [
          i.work_centre_name,
          i.machine_name || i.machine_id,
          `${i.employee_name} (${i.employee_code})`,
          i.start_time ? new Date(i.start_time).toLocaleString() : '',
          i.finish_time ? new Date(i.finish_time).toLocaleString() : '',
          String(i.target_mins || 0),
          String(i.actual_mins || 0),
          String(i.inactive_mins || 0),
          String(i.extra_mins || 0),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        return vals.join(',');
      }),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missed_actions_daily_${dailyReportDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatMinutes = (value: number) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return (Math.round(n * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 px-2 py-4 sm:px-3 sm:py-6">
      <div className="w-full space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-2 shadow-sm inline-flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'live' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Live Issues
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Daily Inactive Report
          </button>
        </div>

        {activeTab === 'live' ? (
          <>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Missed Start / Finish</h1>
            <p className="text-sm text-gray-500 mt-1">
              Machines where operators likely forgot to click START or FINISH.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Not updated yet'}
            </p>
            <p className="text-xs text-gray-400">Auto-refresh every 30s</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              onClick={() => setShowMuted((v) => !v)}
              className={`inline-flex w-full justify-center items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] sm:text-xs font-semibold border ${
                showMuted ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              <BellOff className="h-3.5 w-3.5" />
              {showMuted ? 'Showing Muted' : 'Hide Muted'}
            </button>
            <button
              onClick={acknowledgeFiltered}
              disabled={sortedFilteredItems.length === 0 || isActionLoading === '__bulk__'}
              className="inline-flex w-full justify-center items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-semibold disabled:opacity-60"
            >
              {isActionLoading === '__bulk__' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Ack Filtered
            </button>
            <button
              onClick={exportFilteredCsv}
              disabled={sortedFilteredItems.length === 0}
              className="inline-flex w-full justify-center items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-[11px] sm:text-xs font-semibold disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="inline-flex w-full justify-center items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-semibold uppercase">Total Alerts</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{filteredSummary.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs text-amber-700 font-semibold uppercase">Start Not Clicked</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{filteredSummary.start_pending}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
            <p className="text-xs text-red-700 font-semibold uppercase">Finish Not Clicked</p>
            <p className="text-3xl font-bold text-red-700 mt-1">{filteredSummary.finish_pending}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="all">All Lines</option>
                {lineOptions.map((line) => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-auto">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Issue Type</label>
              <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setIssueFilter('all')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border ${issueFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setIssueFilter('START_PENDING')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border ${issueFilter === 'START_PENDING' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  Start Pending
                </button>
                <button
                  type="button"
                  onClick={() => setIssueFilter('FINISH_PENDING')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border ${issueFilter === 'FINISH_PENDING' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  Finish Pending
                </button>
              </div>
            </div>
            <div className="w-full md:ml-auto md:w-auto text-xs text-gray-500">
              Showing {filteredItems.length} of {items.length} total
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="py-10 px-6 text-center">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-10 px-6 text-center text-gray-500">
              No records match current filters.
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {Object.entries(groupedItems).map(([lineName, lineItems]) => (
                <div key={lineName} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-700">{lineName}</p>
                    <span className="text-xs text-gray-500">{lineItems.length} issue(s)</span>
                  </div>
                  <div className="md:hidden divide-y divide-gray-100">
                    {lineItems.map((item) => {
                      const severity = getSeverity(item.overdue_mins);
                      const sla = getSlaStatus(item.overdue_mins);
                      const recurrence = recurrenceMap.get(`${item.machine_id || item.machine_name}|${item.action_type}`) || 0;
                      const priority = getPriorityScore(item, recurrence);
                      const meta = localMeta[item.issue_key] || {};
                      return (
                        <div key={`${item.session_id}-${item.machine_id}-${item.action_type}`} className="p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{item.machine_name}</p>
                              <p className="text-xs text-gray-600">{item.employee_name} ({item.employee_code})</p>
                            </div>
                            <span className={`inline-flex items-center justify-center min-w-[118px] px-2.5 py-1 rounded-full text-[11px] leading-none font-semibold whitespace-nowrap ${
                              item.action_type === 'START_PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {item.action_label}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${severity.cls}`}>
                              {severity.label}
                            </span>
                            {recurrence > 1 && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
                                Repeat x{recurrence}
                              </span>
                            )}
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${sla.cls}`}>{sla.label}</span>
                          </div>

                          <div className="grid grid-cols-1 gap-1.5 sm:gap-2 text-xs">
                            <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                              <p className="text-gray-500">Priority</p>
                              <p className="font-bold text-gray-800">{priority}</p>
                            </div>
                          </div>

                          <div className="text-xs text-gray-600">
                            <p>{item.details}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <a className="font-semibold text-blue-600 hover:text-blue-700" href="/production_tracker">Open Tracker</a>
                              <a className="font-semibold text-indigo-600 hover:text-indigo-700" href={`/mobile/${encodeURIComponent(item.machine_id || item.machine_name || '')}`}>Open Machine</a>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase">Root Cause</label>
                            <select
                              value={meta.rootCause || ''}
                              onChange={(e) => setRootCause(item, e.target.value)}
                              className="w-full px-2 py-2 text-xs border border-gray-300 rounded bg-white"
                            >
                              <option value="">Select cause</option>
                              <option value="No operator">No operator</option>
                              <option value="Machine issue">Machine issue</option>
                              <option value="Material shortage">Material shortage</option>
                              <option value="Waiting approval">Waiting approval</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div className="text-xs text-gray-600">
                            {meta.lastAction ? (
                              <div>
                                <div className="font-semibold text-gray-700">{meta.lastAction}</div>
                                <div className="text-[11px] text-gray-500">{meta.lastActionAt ? new Date(meta.lastActionAt).toLocaleString() : ''}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">No action yet</span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => acknowledgeItem(item)}
                              disabled={isActionLoading === item.issue_key}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ack
                            </button>
                            <button
                              type="button"
                              onClick={() => logLocalAction(item, 'Called operator')}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                            >
                              Called
                            </button>
                            <button
                              type="button"
                              onClick={() => logLocalAction(item, 'Resolved')}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
                            >
                              Resolved
                            </button>
                            <button
                              type="button"
                              onClick={() => snoozeItem(item, 30)}
                              disabled={isActionLoading === item.issue_key}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                            >
                              <BellOff className="h-3.5 w-3.5" /> Snooze 30m
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Machine</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Operator</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Issue</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Severity</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Priority</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">SLA</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Details</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Root Cause</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Trail</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lineItems.map((item) => {
                          const severity = getSeverity(item.overdue_mins);
                          const sla = getSlaStatus(item.overdue_mins);
                          const recurrence = recurrenceMap.get(`${item.machine_id || item.machine_name}|${item.action_type}`) || 0;
                          const priority = getPriorityScore(item, recurrence);
                          const meta = localMeta[item.issue_key] || {};
                          return (
                            <tr key={`${item.session_id}-${item.machine_id}-${item.action_type}`}>
                              <td className="px-3 py-2.5 text-sm font-semibold text-gray-800">{item.machine_name}</td>
                              <td className="px-3 py-2.5 text-sm text-gray-700">{item.employee_name} ({item.employee_code})</td>
                              <td className="px-3 py-2.5 text-sm">
                                <span className={`inline-flex items-center justify-center min-w-[118px] px-2.5 py-1 rounded-full text-[11px] leading-none font-semibold whitespace-nowrap ${
                                  item.action_type === 'START_PENDING'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {item.action_label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-sm">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${severity.cls}`}>
                                  {severity.label}
                                </span>
                                {recurrence > 1 && (
                                  <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
                                    Repeat x{recurrence}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-sm font-bold text-gray-800">{priority}</td>
                              <td className="px-3 py-2.5 text-sm">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${sla.cls}`}>{sla.label}</span>
                              </td>
                              <td className="px-3 py-2.5 text-sm text-gray-600">
                                <div>{item.details}</div>
                                <div className="mt-1 flex gap-2">
                                  <a className="text-[11px] font-semibold text-blue-600 hover:text-blue-700" href="/production_tracker">Open Tracker</a>
                                  <a className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700" href={`/mobile/${encodeURIComponent(item.machine_id || item.machine_name || '')}`}>Open Machine</a>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-sm">
                                <select
                                  value={meta.rootCause || ''}
                                  onChange={(e) => setRootCause(item, e.target.value)}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                                >
                                  <option value="">Select cause</option>
                                  <option value="No operator">No operator</option>
                                  <option value="Machine issue">Machine issue</option>
                                  <option value="Material shortage">Material shortage</option>
                                  <option value="Waiting approval">Waiting approval</option>
                                  <option value="Other">Other</option>
                                </select>
                              </td>
                              <td className="px-3 py-2.5 text-sm text-gray-600">
                                {meta.lastAction ? (
                                  <div>
                                    <div className="font-semibold text-gray-700">{meta.lastAction}</div>
                                    <div className="text-[11px] text-gray-500">{meta.lastActionAt ? new Date(meta.lastActionAt).toLocaleString() : ''}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">No action yet</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => acknowledgeItem(item)}
                                    disabled={isActionLoading === item.issue_key}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Ack
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => logLocalAction(item, 'Called operator')}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                                  >
                                    Called
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => logLocalAction(item, 'Resolved')}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
                                  >
                                    Resolved
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => snoozeItem(item, 30)}
                                    disabled={isActionLoading === item.issue_key}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                                  >
                                    <BellOff className="h-3.5 w-3.5" /> Snooze 30m
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={dailyReportDate}
                    onChange={(e) => setDailyReportDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
                  <select
                    value={dailyLine}
                    onChange={(e) => setDailyLine(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="all">All Lines</option>
                    {dailyByLine.map((line) => (
                      <option key={line.work_centre_name} value={line.work_centre_name}>{line.work_centre_name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={fetchDailyReport}
                  disabled={dailyLoading}
                  className="inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {dailyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh Report
                </button>
                <button
                  type="button"
                  onClick={exportDailyCsv}
                  disabled={dailyEvents.length === 0}
                  className="inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
                <p className="text-[11px] text-red-700 font-semibold uppercase tracking-wide">Total Lost Minutes</p>
                <p className="text-3xl font-bold text-red-700 mt-1">{formatMinutes(dailySummary.total_lost_mins)}</p>
                <p className="text-xs text-gray-500 mt-1">Inactive + extra minutes</p>
              </div>
              <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
                <p className="text-[11px] text-blue-700 font-semibold uppercase tracking-wide">Inactive Minutes</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{formatMinutes(dailySummary.total_inactive_mins)}</p>
                <p className="text-xs text-gray-500 mt-1">Waiting / no-start loss</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">Extra Minutes</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{formatMinutes(dailySummary.total_extra_mins)}</p>
                <p className="text-xs text-gray-500 mt-1">Cycle over target duration</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Total Cycles</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{dailySummary.total_cycles}</p>
                <p className="text-xs text-gray-500 mt-1">Completed cycles for selected date</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Live Active Loss</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatMinutes(liveLossRows.reduce((sum, row) => sum + row.activeLoss, 0))}
                </p>
                <p className="text-xs text-gray-500 mt-1">From current live missed issues</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">Worst Line (Today)</p>
                <p className="text-xl font-bold text-amber-700 mt-1">{lineLossRows[0]?.work_centre_name || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {lineLossRows[0] ? `${formatMinutes(lineLossRows[0].lost)} min loss` : 'No data'}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
              <p className="text-[11px] text-red-700 font-semibold uppercase tracking-wide">Projected Shift Loss</p>
              <p className="text-3xl font-bold text-red-700 mt-1">
                {(() => {
                  const elapsedHours = Math.max(1, new Date().getHours() + new Date().getMinutes() / 60 - 9);
                  const projection = (totalLineLoss / elapsedHours) * 9;
                  return formatMinutes(projection);
                })()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Simple 9-hour shift projection</p>
            </div>

            {dailyError ? (
              <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-600 font-medium">{dailyError}</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">Line Loss Ranking</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Line</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Cycles</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Inactive</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Extra</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Total Loss</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Loss / Cycle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lineLossRows.map((row) => (
                          <tr key={row.work_centre_name}>
                            <td className="px-3 py-2.5 text-sm font-semibold text-gray-800">{row.work_centre_name}</td>
                            <td className="px-3 py-2.5 text-sm text-gray-700">{row.cycles}</td>
                            <td className="px-3 py-2.5 text-sm text-blue-700 font-semibold">{formatMinutes(row.inactive)}</td>
                            <td className="px-3 py-2.5 text-sm text-amber-700 font-semibold">{formatMinutes(row.extra)}</td>
                            <td className="px-3 py-2.5 text-sm text-red-700 font-bold">{formatMinutes(row.lost)}</td>
                            <td className="px-3 py-2.5 text-sm text-gray-700">{formatMinutes(row.perCycle)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">Recent Loss Trend (Hourly)</div>
                  <div className="p-3 space-y-2">
                    {lineLossTrend.map((bucket) => {
                      const max = Math.max(1, ...lineLossTrend.map((x) => x.total));
                      const width = `${Math.max(4, Math.round((bucket.total / max) * 100))}%`;
                      return (
                        <div key={bucket.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">{bucket.label}</span>
                            <span className="font-semibold text-gray-800">{formatMinutes(bucket.total)}m</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-700">Cycle Details (Line → Machine)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      dailyLineMachineGroups.forEach((line) => {
                        line.machines.forEach((machine) => {
                          next[`${line.lineName}__${machine.machineKey}`] = true;
                        });
                      });
                      setExpandedMachineKeys(next);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedMachineKeys({})}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-3">
                {dailyLineMachineGroups.map((line) => (
                  <div key={line.lineName} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-700">{line.lineName}</p>
                      <p className="text-xs text-gray-600">
                        Cycles: {line.cycles} | Inactive: {formatMinutes(line.inactive)} | Extra: {formatMinutes(line.extra)}
                      </p>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {line.machines.map((machine) => {
                        const machineKey = `${line.lineName}__${machine.machineKey}`;
                        const isExpanded = !!expandedMachineKeys[machineKey];
                        return (
                          <div key={machineKey}>
                            <button
                              type="button"
                              onClick={() => setExpandedMachineKeys((prev) => ({ ...prev, [machineKey]: !prev[machineKey] }))}
                              className="w-full px-3 py-2.5 bg-white hover:bg-gray-50 flex items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                <span className="text-sm font-semibold text-gray-800">{machine.machineName}</span>
                              </div>
                              <span className="text-xs text-gray-600">
                                Cycles: {machine.cycles} | Inactive: {formatMinutes(machine.inactive)} | Extra: {formatMinutes(machine.extra)}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="overflow-x-auto border-t border-gray-100">
                                <table className="min-w-full">
                                  <thead className="bg-white border-b border-gray-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Operator</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Start</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Finish</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Target</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Actual</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Inactive</th>
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Extra</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {machine.events.map((row) => (
                                      <tr key={row.id}>
                                        <td className="px-3 py-2.5 text-sm text-gray-700">{row.employee_name} ({row.employee_code})</td>
                                        <td className="px-3 py-2.5 text-sm text-gray-700">{row.start_time ? new Date(row.start_time).toLocaleTimeString() : '-'}</td>
                                        <td className="px-3 py-2.5 text-sm text-gray-700">{row.finish_time ? new Date(row.finish_time).toLocaleTimeString() : '-'}</td>
                                        <td className="px-3 py-2.5 text-sm text-gray-700">{formatMinutes(row.target_mins)}</td>
                                        <td className="px-3 py-2.5 text-sm text-gray-700">{formatMinutes(row.actual_mins)}</td>
                                        <td className="px-3 py-2.5 text-sm font-semibold text-blue-700">{formatMinutes(row.inactive_mins)}</td>
                                        <td className="px-3 py-2.5 text-sm font-semibold text-amber-700">{formatMinutes(row.extra_mins)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

