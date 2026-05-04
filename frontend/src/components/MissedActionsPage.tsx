import React from 'react';
import { AlertTriangle, BellOff, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
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
    acknowledged_by?: string | null;
    snoozed_until?: string | null;
    snooze_duration_mins?: number | null;
    is_snoozed?: boolean;
    root_cause?: string | null;
  };
};

type LocalActionMeta = {
  lastAction?: string;
  lastActionAt?: string;
  trail?: Array<{ action: string; at: string }>;
};

const SNOOZE_OPTIONS = [
  { label: '15m', mins: 15 },
  { label: '30m', mins: 30 },
  { label: '1h', mins: 60 },
  { label: 'End of shift', mins: 120 },
];

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
  root_cause?: string | null;
};

type DailyReportLine = {
  work_centre_name: string;
  cycles: number;
  inactive_mins: number;
  extra_mins: number;
};

const LOCAL_META_KEY = 'missed_actions_meta_v2';

export const MissedActionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'live' | 'daily' | 'discipline'>('live');
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
  const [dailyDateTo, setDailyDateTo] = React.useState<string>(new Date().toISOString().slice(0, 10));
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
  const [weeklyTrend, setWeeklyTrend] = React.useState<Array<{ day: string; cycles: number; inactive_mins: number; extra_mins: number; lost_mins: number }>>([]);
  const [dailyPage, setDailyPage] = React.useState(0);
  const [dailyPageSize, setDailyPageSize] = React.useState(10);
  const [expandedMachineKeys, setExpandedMachineKeys] = React.useState<Record<string, boolean>>({});
  const [discExpandedKeys, setDiscExpandedKeys] = React.useState<Record<string, boolean>>({});
  const [discPage, setDiscPage] = React.useState(0);
  const [discPageSize, setDiscPageSize] = React.useState(10);
  const [localMeta, setLocalMeta] = React.useState<Record<string, LocalActionMeta>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [savingRootCause, setSavingRootCause] = React.useState<string | null>(null);
  const prevCriticalKeys = React.useRef<Set<string>>(new Set());
  const isFirstFetch = React.useRef(true);
  const audioCtxRef = React.useRef<AudioContext | null>(null);

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

  const playAlert = React.useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // AudioContext not available
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions?startReminderMins=10&finishGraceMins=0`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load missed actions');
      const incoming: MissedAction[] = result.data || [];
      // Detect new critical issues (60+ min overdue, not acked/snoozed)
      const newCriticalKeys = new Set(
        incoming
          .filter((i) => i.overdue_mins >= 60 && !i.state?.acknowledged && !i.state?.is_snoozed)
          .map((i) => i.issue_key)
      );
      const hasNewCritical = [...newCriticalKeys].some((k) => !prevCriticalKeys.current.has(k));
      if (hasNewCritical && !isFirstFetch.current) playAlert();
      isFirstFetch.current = false;
      prevCriticalKeys.current = newCriticalKeys;
      setItems((prev) => {
        // Preserve root_cause edits made locally so auto-refresh doesn't wipe them
        const prevMap = new Map(prev.map((p) => [p.issue_key, p]));
        return incoming.map((item) => {
          const existing = prevMap.get(item.issue_key);
          if (existing && existing.state?.root_cause && !item.state?.root_cause) {
            return { ...item, state: { ...item.state, root_cause: existing.state.root_cause } };
          }
          return item;
        });
      });
      setSummary(result.summary || { total: 0, start_pending: 0, finish_pending: 0 });
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to load missed actions');
    } finally {
      setIsLoading(false);
    }
  }, [playAlert]);

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
      params.set('date_from', dailyReportDate);
      params.set('date_to', dailyDateTo);
      if (dailyLine !== 'all') params.set('line', dailyLine);
      params.set('startReminderMins', '10');
      const response = await apiFetch(`${API_BASE}/api/missed-actions/daily-report?${params.toString()}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || result.message || 'Failed to load daily report');
      setDailySummary(result.summary || { total_cycles: 0, total_inactive_mins: 0, total_extra_mins: 0, total_lost_mins: 0 });
      setDailyByLine(result.by_line || []);
      setDailyEvents(result.events || []);
      // Fetch 7-day trend anchored to date_to
      apiFetch(`${API_BASE}/api/missed-actions/weekly-trend?date=${dailyDateTo}&startReminderMins=10`)
        .then((r) => r.json())
        .then((r) => { if (r.success) setWeeklyTrend(r.trend || []); })
        .catch(() => {});
    } catch (e: any) {
      setDailyError(e.message || 'Failed to load daily report');
    } finally {
      setDailyLoading(false);
    }
  }, [dailyLine, dailyReportDate, dailyDateTo]);

  React.useEffect(() => {
    if (activeTab !== 'daily') return;
    fetchDailyReport();
  }, [activeTab, fetchDailyReport]);

  React.useEffect(() => {
    if (activeTab !== 'discipline') return;
    // Discipline tab reuses dailyEvents — trigger a fetch if data is empty
    if (dailyEvents.length === 0 && !dailyLoading) fetchDailyReport();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevDailyReportDate = React.useRef(dailyReportDate);
  const prevDailyDateTo = React.useRef(dailyDateTo);
  const prevDailyLine = React.useRef(dailyLine);

  React.useEffect(() => {
    const filterChanged =
      prevDailyReportDate.current !== dailyReportDate ||
      prevDailyDateTo.current !== dailyDateTo ||
      prevDailyLine.current !== dailyLine;
    prevDailyReportDate.current = dailyReportDate;
    prevDailyDateTo.current = dailyDateTo;
    prevDailyLine.current = dailyLine;
    if (filterChanged) {
      setExpandedMachineKeys({});
      setDailyPage(0);
    }
  }, [dailyEvents, dailyReportDate, dailyDateTo, dailyLine]);

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
    if (rounded >= 30) return { label: `Breached by ${Math.max(0, rounded - 30)}m`, cls: 'text-red-700 bg-red-100', pct: 100, color: '#ef4444' };
    if (rounded >= 15) return { label: `Warning (${rounded}m)`, cls: 'text-amber-700 bg-amber-100', pct: Math.round((rounded / 30) * 100), color: '#f59e0b' };
    const dueIn = Math.max(0, 15 - rounded);
    return { label: `Due in ${dueIn}m`, cls: 'text-blue-700 bg-blue-100', pct: Math.round((rounded / 30) * 100), color: '#3b82f6' };
  };

  const SlaCircle: React.FC<{ overdueMins: number }> = ({ overdueMins }) => {
    const sla = getSlaStatus(overdueMins);
    const size = 44;
    const stroke = 4;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const filled = circ - (circ * Math.min(sla.pct, 100)) / 100;
    return (
      <div className="flex flex-col items-center gap-0.5">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={sla.color} strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={filled}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sla.cls}`}>{sla.label}</span>
      </div>
    );
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

  const unmuteItem = async (item: MissedAction) => {
    if (!item.issue_key) return;
    setIsActionLoading(item.issue_key);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions/unmute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_key: item.issue_key }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to unmute');
      await fetchData();
      toast.success('Issue unmuted');
    } catch (e: any) {
      setError(e.message || 'Failed to unmute');
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

  const saveRootCause = async (item: MissedAction, rootCause: string) => {
    if (!item.issue_key) return;
    setSavingRootCause(item.issue_key);
    try {
      await apiFetch(`${API_BASE}/api/missed-actions/root-cause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_key: item.issue_key, root_cause: rootCause }),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.issue_key === item.issue_key
            ? { ...i, state: { ...i.state, root_cause: rootCause } }
            : i
        )
      );
      toast.success(rootCause ? `Root cause saved: ${rootCause}` : 'Root cause cleared');
    } catch {
      toast.error('Failed to save root cause');
    } finally {
      setSavingRootCause(null);
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
    toast.success(`Logged: ${action}`);
  };

  const acknowledgeFiltered = async () => {
    const targets = sortedFilteredItems.filter((i) => i.issue_key);
    if (targets.length === 0) return;
    if (!window.confirm(`Acknowledge all ${targets.length} filtered issue(s)?`)) return;
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
    const headers = ['line', 'machine', 'operator', 'issue', 'overdue_mins', 'severity', 'priority_score', 'sla_status', 'root_cause', 'acknowledged_by', 'last_action', 'details'];
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
          String(Math.round(Number(i.overdue_mins || 0))),
          severity,
          String(priority),
          sla,
          i.state?.root_cause || '',
          i.state?.acknowledged_by || '',
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
      `"report_date","${dailyReportDate} to ${dailyDateTo}"`,
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
          <button
            type="button"
            onClick={() => setActiveTab('discipline')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'discipline' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Cycle Discipline
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
              {showMuted ? 'Hide Muted' : 'Show Muted'}
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
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Priority Score Guide</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">2 — Low overdue</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">3 — 15m+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">4 — 30m+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">5 — 60m+ Critical</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-200 text-red-800 text-xs font-semibold">+1 Finish Pending</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">+1 Repeated 3×</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">max 7</span>
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
                      const overdueMinsRounded = Math.round(Number(item.overdue_mins || 0));
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
                            <SlaCircle overdueMins={item.overdue_mins} />
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{overdueMinsRounded}m overdue</span>
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
                              value={item.state?.root_cause || ''}
                              onChange={(e) => saveRootCause(item, e.target.value)}
                              disabled={savingRootCause === item.issue_key}
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

                          {item.state?.acknowledged && item.state.acknowledged_by && (
                            <p className="text-[11px] text-gray-500">Acked by: <span className="font-semibold">{item.state.acknowledged_by}</span></p>
                          )}

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
                            {(item.state?.is_snoozed || item.state?.acknowledged) && (
                              <button
                                type="button"
                                onClick={() => unmuteItem(item)}
                                disabled={isActionLoading === item.issue_key}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 border border-orange-200"
                              >
                                <BellOff className="h-3.5 w-3.5" /> Unmute
                              </button>
                            )}
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
                            {SNOOZE_OPTIONS.map((opt) => (
                              <button
                                key={opt.mins}
                                type="button"
                                onClick={() => snoozeItem(item, opt.mins)}
                                disabled={isActionLoading === item.issue_key}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                              >
                                <BellOff className="h-3.5 w-3.5" /> {opt.label}
                              </button>
                            ))}
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
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Overdue</th>
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
                              <td className="px-3 py-2.5 text-sm font-bold text-gray-800">{Math.round(Number(item.overdue_mins || 0))}m</td>
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
                                <SlaCircle overdueMins={item.overdue_mins} />
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
                                  value={item.state?.root_cause || ''}
                                  onChange={(e) => saveRootCause(item, e.target.value)}
                                  disabled={savingRootCause === item.issue_key}
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
                                {item.state?.acknowledged && item.state.acknowledged_by && (
                                  <p className="text-[11px] text-gray-500 mb-1">Acked by: <span className="font-semibold">{item.state.acknowledged_by}</span></p>
                                )}
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
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => acknowledgeItem(item)}
                                      disabled={isActionLoading === item.issue_key}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Ack
                                    </button>
                                    {(item.state?.is_snoozed || item.state?.acknowledged) && (
                                      <button
                                        type="button"
                                        onClick={() => unmuteItem(item)}
                                        disabled={isActionLoading === item.issue_key}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 border border-orange-200"
                                      >
                                        <BellOff className="h-3.5 w-3.5" /> Unmute
                                      </button>
                                    )}
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
                                    {SNOOZE_OPTIONS.map((opt) => (
                                      <button
                                        key={opt.mins}
                                        type="button"
                                        onClick={() => snoozeItem(item, opt.mins)}
                                        disabled={isActionLoading === item.issue_key}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                                      >
                                        <BellOff className="h-3.5 w-3.5" /> {opt.label}
                                      </button>
                                    ))}
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
        ) : activeTab === 'daily' ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From</label>
                  <input
                    type="date"
                    value={dailyReportDate}
                    max={dailyDateTo}
                    onChange={(e) => setDailyReportDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To</label>
                  <input
                    type="date"
                    value={dailyDateTo}
                    min={dailyReportDate}
                    onChange={(e) => setDailyDateTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
                  <select
                    value={dailyLine}
                    onChange={(e) => setDailyLine(e.target.value)}
                    disabled={dailyLoading}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white disabled:opacity-60"
                  >
                    <option value="all">{dailyLoading ? 'Loading…' : 'All Lines'}</option>
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
                <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">
                  Worst Line {dailyReportDate === dailyDateTo ? '(Today)' : `(${dailyReportDate} – ${dailyDateTo})`}
                </p>
                <p className="text-xl font-bold text-amber-700 mt-1">{lineLossRows[0]?.work_centre_name || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {lineLossRows[0] ? `${formatMinutes(lineLossRows[0].lost)} min loss` : 'No data'}
                </p>
              </div>
            </div>
            {dailyError ? (
              <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-600 font-medium">{dailyError}</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">Line Loss Ranking</div>
                  <div className="overflow-x-auto">
                    {lineLossRows.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-gray-400 text-center">No loss data for the selected period.</p>
                    ) : (
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
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">Loss Trend</div>
                  <div className="p-3 space-y-3">
                    {dailyReportDate === dailyDateTo && (
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase mb-2">Today (Hourly)</p>
                        <div className="space-y-2">
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
                    )}
                    {weeklyTrend.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase mb-2">Last 7 Days</p>
                        <div className="space-y-2">
                          {weeklyTrend.map((d) => {
                            const max = Math.max(1, ...weeklyTrend.map((x) => x.lost_mins));
                            const width = `${Math.max(4, Math.round((d.lost_mins / max) * 100))}%`;
                            const label = new Date(d.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                            return (
                              <div key={d.day}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-600">{label}</span>
                                  <span className="font-semibold text-gray-800">{formatMinutes(d.lost_mins)}m</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-400 rounded-full" style={{ width }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                {dailyLineMachineGroups.slice(dailyPage * dailyPageSize, (dailyPage + 1) * dailyPageSize).map((line) => (
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
                                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Root Cause</th>
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
                                        <td className="px-3 py-2.5 text-sm">
                                          <select
                                            value={row.root_cause || ''}
                                            onChange={(e) => {
                                              const key = `daily__${row.id}`;
                                              const val = e.target.value;
                                              setDailyEvents((prev) => prev.map((ev) => ev.id === row.id ? { ...ev, root_cause: val } : ev));
                                              apiFetch(`${API_BASE}/api/missed-actions/root-cause`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ issue_key: key, root_cause: val }),
                                              })
                                                .then(() => toast.success(val ? `Root cause saved: ${val}` : 'Root cause cleared'))
                                                .catch(() => toast.error('Failed to save root cause'));
                                            }}
                                            className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white"
                                          >
                                            <option value="">—</option>
                                            <option value="No operator">No operator</option>
                                            <option value="Machine issue">Machine issue</option>
                                            <option value="Material shortage">Material shortage</option>
                                            <option value="Waiting approval">Waiting approval</option>
                                            <option value="Other">Other</option>
                                          </select>
                                        </td>
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
              {dailyLineMachineGroups.length > 0 && (() => {
                const totalDailyPages = dailyPageSize === 0 ? 1 : Math.ceil(dailyLineMachineGroups.length / dailyPageSize);
                return (
                  <div className="px-3 pb-3 pt-3 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100">
                    <span>Page {dailyPageSize === 0 ? 1 : dailyPage + 1} of {totalDailyPages} &mdash; {dailyLineMachineGroups.length} line(s) total</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={dailyPageSize}
                        onChange={(e) => { setDailyPageSize(Number(e.target.value)); setDailyPage(0); }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white font-semibold"
                      >
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={30}>30 / page</option>
                        <option value={0}>All</option>
                      </select>
                      <button type="button" onClick={() => setDailyPage((p) => Math.max(0, p - 1))} disabled={dailyPage === 0 || dailyPageSize === 0} className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 font-semibold">Prev</button>
                      <button type="button" onClick={() => setDailyPage((p) => Math.min(totalDailyPages - 1, p + 1))} disabled={dailyPage >= totalDailyPages - 1 || dailyPageSize === 0} className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 font-semibold">Next</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : null}

        {activeTab === 'discipline' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From</label>
                  <input type="date" value={dailyReportDate} max={dailyDateTo} onChange={(e) => { setDailyReportDate(e.target.value); setDiscPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To</label>
                  <input type="date" value={dailyDateTo} min={dailyReportDate} onChange={(e) => { setDailyDateTo(e.target.value); setDiscPage(0); }} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
                  <select value={dailyLine} onChange={(e) => { setDailyLine(e.target.value); setDiscPage(0); }} disabled={dailyLoading} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white disabled:opacity-60">
                    <option value="all">{dailyLoading ? 'Loading…' : 'All Lines'}</option>
                    {dailyByLine.map((l) => <option key={l.work_centre_name} value={l.work_centre_name}>{l.work_centre_name}</option>)}
                  </select>
                </div>
                <button type="button" onClick={fetchDailyReport} disabled={dailyLoading} className="inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
                  {dailyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
              </div>
            </div>

            {dailyError && (
              <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-600 font-medium">{dailyError}</div>
            )}

            {(() => {
              const disciplineRows = dailyEvents
                .filter((e) => Math.round(e.inactive_mins || 0) > 0 || Math.round(e.extra_mins || 0) > 0)
                .sort((a, b) => (b.inactive_mins + b.extra_mins) - (a.inactive_mins + a.extra_mins));

              if (dailyLoading) return <div className="py-16 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
              if (disciplineRows.length === 0) return <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">No late starts or slow finishes for this period.</div>;

              const machineMap = new Map<string, { machineName: string; rows: typeof disciplineRows }>();
              disciplineRows.forEach((e) => {
                const key = e.machine_id || e.machine_name || 'UNKNOWN';
                const name = e.machine_name || e.machine_id || 'N/A';
                if (!machineMap.has(key)) machineMap.set(key, { machineName: name, rows: [] });
                machineMap.get(key)!.rows.push(e);
              });
              const machineGroups = Array.from(machineMap.values()).map((mg) => ({
                ...mg,
                rows: [...mg.rows].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
              })).sort((a, b) =>
                b.rows.reduce((s, r) => s + r.inactive_mins + r.extra_mins, 0) -
                a.rows.reduce((s, r) => s + r.inactive_mins + r.extra_mins, 0)
              );

              const totalPages = discPageSize === 0 ? 1 : Math.ceil(machineGroups.length / discPageSize);
              const pagedGroups = discPageSize === 0 ? machineGroups : machineGroups.slice(discPage * discPageSize, (discPage + 1) * discPageSize);

              return (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Cycle Discipline — {disciplineRows.length} cycle(s) with issues</span>
                    <button
                      type="button"
                      onClick={() => {
                        const headers = ['operator', 'machine', 'line', 'date', 'start', 'finish', 'started_late_mins', 'finished_extra_mins', 'verdict'];
                        const csv = [headers.join(','), ...disciplineRows.map((e) => [
                          `"${e.employee_name} (${e.employee_code})"`,
                          `"${e.machine_name || e.machine_id}"`,
                          `"${e.work_centre_name}"`,
                          `"${e.start_time ? new Date(e.start_time).toLocaleDateString() : ''}"`,
                          `"${e.start_time ? new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
                          `"${e.finish_time ? new Date(e.finish_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
                          Math.round(e.inactive_mins || 0),
                          Math.round(e.extra_mins || 0),
                          `"${Math.round(e.inactive_mins || 0) > 0 && Math.round(e.extra_mins || 0) > 0 ? 'Late start + slow finish' : Math.round(e.inactive_mins || 0) > 0 ? 'Late start' : 'Slow finish'}"`,
                        ].join(','))].join('\n');
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                        a.download = `cycle_discipline_${dailyReportDate}_to_${dailyDateTo}.csv`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold"
                    >
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {pagedGroups.map((mg) => {
                      const totalLate = mg.rows.reduce((s, r) => s + Math.round(r.inactive_mins || 0), 0);
                      const totalExtra = mg.rows.reduce((s, r) => s + Math.round(r.extra_mins || 0), 0);
                      const machineKey = `disc__${mg.machineName}`;
                      const isOpen = !!discExpandedKeys[machineKey];
                      return (
                        <div key={mg.machineName}>
                          <button
                            type="button"
                            onClick={() => setDiscExpandedKeys((prev) => ({ ...prev, [machineKey]: !prev[machineKey] }))}
                            className="w-full px-3 py-2.5 bg-white hover:bg-gray-50 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-2">
                              {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                              <span className="text-sm font-semibold text-gray-800">{mg.machineName}</span>
                              <span className="text-xs text-gray-500">{mg.rows.length} cycle(s)</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              {totalLate > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{totalLate}m late total</span>}
                              {totalExtra > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">+{totalExtra}m over total</span>}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="overflow-x-auto border-t border-gray-100">
                              <table className="min-w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Cycle</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Operator</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Line</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Start</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Finish</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Started Late</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Finished Extra</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Verdict</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {mg.rows.map((e, idx) => {
                                    const late = Math.round(e.inactive_mins || 0);
                                    const extra = Math.round(e.extra_mins || 0);
                                    const verdict = late > 0 && extra > 0 ? 'Late start + slow finish' : late > 0 ? 'Late start' : 'Slow finish';
                                    return (
                                      <tr key={e.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2.5 text-xs font-bold text-gray-400 w-12">#{idx + 1}</td>
                                        <td className="px-3 py-2.5 text-sm font-semibold text-gray-800">
                                          {e.employee_name} <span className="text-xs font-normal text-gray-400">({e.employee_code})</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-sm text-gray-600">{e.work_centre_name}</td>
                                        <td className="px-3 py-2.5 text-sm text-gray-600">{e.start_time ? new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                        <td className="px-3 py-2.5 text-sm text-gray-600">{e.finish_time ? new Date(e.finish_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                        <td className="px-3 py-2.5 text-sm">
                                          {late > 0 ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{late}m late</span> : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-sm">
                                          {extra > 0 ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">+{extra}m over</span> : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-sm">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                            verdict === 'Late start + slow finish' ? 'bg-red-100 text-red-700'
                                            : verdict === 'Late start' ? 'bg-blue-100 text-blue-700'
                                            : 'bg-amber-100 text-amber-700'
                                          }`}>{verdict}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 pb-3 pt-3 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100">
                    <span>Page {discPageSize === 0 ? 1 : discPage + 1} of {totalPages} &mdash; {machineGroups.length} machine(s) total</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={discPageSize}
                        onChange={(e) => { setDiscPageSize(Number(e.target.value)); setDiscPage(0); }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white font-semibold"
                      >
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={30}>30 / page</option>
                        <option value={0}>All</option>
                      </select>
                      <button type="button" onClick={() => setDiscPage((p) => Math.max(0, p - 1))} disabled={discPage === 0 || discPageSize === 0} className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 font-semibold">Prev</button>
                      <button type="button" onClick={() => setDiscPage((p) => Math.min(totalPages - 1, p + 1))} disabled={discPage >= totalPages - 1 || discPageSize === 0} className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 font-semibold">Next</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

