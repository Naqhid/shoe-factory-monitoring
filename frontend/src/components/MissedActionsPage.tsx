import React from 'react';
import {
  AlertTriangle,
  BarChart2,
  BellOff,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  PlayCircle,
  Radio,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Square,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { computeCycleNetLostMins } from '../utils/cycleLostMins';
import { minutesToDurationParts } from '../utils/formatCycleDuration';
import {
  formatOverdueLabel,
  formatRecoveryHint,
  formatTimeLossLabel,
  getFixFirstScore,
  type MissedActionLike,
} from '../utils/missedActionsLiveUtils';

const LIVE_SORT_LABELS: Record<string, string> = {
  fix_first: 'Fix first',
  priority: 'Priority',
  overdue: 'Overdue',
  machine: 'Machine A–Z',
};

type MissedTab = 'live' | 'daily' | 'discipline' | 'operator' | 'reminder';

const MISSED_TABS: { id: MissedTab; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'live', label: 'Live Issues', shortLabel: 'Live', icon: Radio },
  { id: 'daily', label: 'Daily Inactive Report', shortLabel: 'Daily', icon: CalendarDays },
  { id: 'discipline', label: 'Cycle Discipline', shortLabel: 'Discipline', icon: BarChart2 },
  { id: 'operator', label: 'Operator Report', shortLabel: 'Operators', icon: User },
  { id: 'reminder', label: 'Reminder Settings', shortLabel: 'Reminders', icon: Settings2 },
];

/** Temporarily hidden from the tab bar — remove entries to re-enable. */
const HIDDEN_MISSED_TABS: ReadonlySet<MissedTab> = new Set(['operator']);
const VISIBLE_MISSED_TABS = MISSED_TABS.filter((t) => !HIDDEN_MISSED_TABS.has(t.id));
const DEFAULT_VISIBLE_MISSED_TAB: MissedTab = VISIBLE_MISSED_TABS[0]?.id ?? 'live';

const normalizeVisibleMissedTab = (tab: MissedTab): MissedTab =>
  HIDDEN_MISSED_TABS.has(tab) ? DEFAULT_VISIBLE_MISSED_TAB : tab;

const FILTER_LABEL = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';
const FILTER_CONTROL =
  'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 disabled:opacity-60 transition-shadow';
const BTN_PRIMARY =
  'inline-flex justify-center items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60 transition-colors';
const BTN_SECONDARY =
  'inline-flex justify-center items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-60 transition-colors';
const BTN_DARK =
  'inline-flex justify-center items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm disabled:opacity-60 transition-colors';

function eventLostMins(e: {
  lost_mins?: number;
  inactive_mins: number;
  target_mins: number;
  actual_mins: number;
}): number {
  if (e.lost_mins != null && Number.isFinite(Number(e.lost_mins))) {
    return Number(e.lost_mins);
  }
  return computeCycleNetLostMins(
    Number(e.inactive_mins || 0),
    Number(e.target_mins || 0),
    Number(e.actual_mins || 0),
  );
}

type MissedAction = {
  issue_key: string;
  session_id: string;
  machine_id: string;
  machine_name: string;
  employee_code: string;
  employee_name: string;
  work_centre_name: string;
  work_centre_id?: number | null;
  action_type: 'START_PENDING' | 'FINISH_PENDING';
  action_label: string;
  overdue_mins: number;
  target_mins?: number;
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
  lost_mins?: number;
  root_cause?: string | null;
};

type DailyReportLine = {
  work_centre_name: string;
  cycles: number;
  inactive_mins: number;
  extra_mins: number;
  lost_mins?: number;
};

type IdleReminderSettingRow = {
  machine_id: string;
  code?: string;
  machine_name: string;
  work_centre_id: number;
  work_centre_name: string;
  idle_interval_secs: number;
  idle_interval_mins: number;
  idle_interval_secs_part: number;
  alarm_duration_secs: number;
  finish_grace_mins: number;
  is_custom: boolean;
  updated_by?: string | null;
  updated_at?: string | null;
};

type IdleReminderDraft = {
  idle_interval_mins: number;
  idle_interval_secs_part: number;
  alarm_duration_secs: number;
  finish_grace_mins: number;
};

const formatIdleIntervalLabel = (mins: number, secsPart: number) => {
  const total = mins * 60 + secsPart;
  if (total < 60) return `${total}s`;
  if (secsPart === 0) return `${mins}m`;
  return `${mins}m ${secsPart}s`;
};

const draftFromIdleRow = (row: Pick<IdleReminderSettingRow, 'idle_interval_secs' | 'idle_interval_mins' | 'idle_interval_secs_part' | 'alarm_duration_secs' | 'finish_grace_mins'>): IdleReminderDraft => {
  const total = Number(row.idle_interval_secs) > 0
    ? Number(row.idle_interval_secs)
    : (Number(row.idle_interval_mins) || 0) * 60 + (Number(row.idle_interval_secs_part) || 0);
  const safeTotal = Math.min(7200, Math.max(15, Math.round(total)));
  return {
    idle_interval_mins: Math.floor(safeTotal / 60),
    idle_interval_secs_part: safeTotal % 60,
    alarm_duration_secs: row.alarm_duration_secs,
    finish_grace_mins: row.finish_grace_mins,
  };
};

/** In-app confirm for operator bulk root cause when all loss cycles already have a cause */
type OperatorBulkOverwritePending = {
  employeeCode: string;
  employeeName: string;
  lossCycleCount: number;
  rootCause: string;
  /** Loss-cycle row ids at prompt time (same set as former confirm(true) branch) */
  cycleIds: number[];
};

const LOCAL_META_KEY = 'missed_actions_meta_v2';
const DAILY_MY_LINE_KEY = 'missed_actions_daily_my_line_v1';

const ROOT_CAUSE_OPTIONS = ['Forgot to start', 'Forgot to finish', 'No operator', 'Machine issue', 'Material shortage', 'Waiting approval', 'Other'];

const RootCauseSelect: React.FC<{
  value: string | null | undefined;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, disabled, className }) => {
  const isOther = !!value && value !== 'Other' && !ROOT_CAUSE_OPTIONS.slice(0, -1).includes(value);
  const selectValue = isOther ? 'Other' : (value || '');
  const [customText, setCustomText] = React.useState(isOther ? (value || '') : '');
  const [showInput, setShowInput] = React.useState(isOther);
  const prevIsOtherRef = React.useRef(isOther);

  React.useEffect(() => {
    if (isOther) {
      setCustomText(value || '');
      setShowInput(true);
    } else if (prevIsOtherRef.current && !isOther) {
      setShowInput(false);
      setCustomText('');
    }
    prevIsOtherRef.current = isOther;
  }, [value, isOther]);

  if (showInput) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onBlur={() => { if (customText.trim()) onChange(customText.trim()); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && customText.trim()) onChange(customText.trim()); }}
          disabled={disabled}
          placeholder="Type reason…"
          className={`px-2 py-1 text-xs border border-blue-400 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${className || ''}`}
        />
        <button
          type="button"
          onClick={() => { setCustomText(''); setShowInput(false); onChange(''); }}
          className="text-gray-400 hover:text-red-500 text-xs font-bold px-1"
          title="Clear"
        >✕</button>
      </div>
    );
  }

  return (
    <select
      value={selectValue}
      onChange={(e) => {
        if (e.target.value === 'Other') { setCustomText(''); setShowInput(true); }
        else onChange(e.target.value);
      }}
      disabled={disabled}
      className={className}
    >
      <option value="">Select cause</option>
      {ROOT_CAUSE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

type ResolvedIssueFlash = {
  issue_key: string;
  machine_name: string;
  action_label: string;
  resolved_at: string;
};

export const MissedActionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<'live' | 'daily' | 'discipline' | 'operator' | 'reminder'>('live');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSilentRefreshing, setIsSilentRefreshing] = React.useState(false);
  const [isActionLoading, setIsActionLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<MissedAction[]>([]);
  const [summary, setSummary] = React.useState({ total: 0, start_pending: 0, finish_pending: 0 });
  const [selectedLine, setSelectedLine] = React.useState<string>('all');
  const [issueFilter, setIssueFilter] = React.useState<'all' | 'START_PENDING' | 'FINISH_PENDING'>('all');
  const [liveSort, setLiveSort] = React.useState<'fix_first' | 'priority' | 'overdue' | 'machine'>('priority');
  const [liveAutoRefresh, setLiveAutoRefresh] = React.useState(true);
  const [liveLiveTick, setLiveLiveTick] = React.useState(0);
  const [machineLossMinsMap, setMachineLossMinsMap] = React.useState<Record<string, number>>({});
  const [recentlyResolved, setRecentlyResolved] = React.useState<ResolvedIssueFlash[]>([]);
  const [contextItem, setContextItem] = React.useState<MissedAction | null>(null);
  const [contextLoading, setContextLoading] = React.useState(false);
  const [contextCycles, setContextCycles] = React.useState<DailyReportEvent[]>([]);
  const [contextMachineOutput, setContextMachineOutput] = React.useState<number | null>(null);
  const [contextMachineLoss, setContextMachineLoss] = React.useState<number | null>(null);
  const [showPriorityGuide, setShowPriorityGuide] = React.useState(false);
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
  const [dailyTopOffendersOnly, setDailyTopOffendersOnly] = React.useState(false);
  const [dailyBreachedOnly, setDailyBreachedOnly] = React.useState(false);
  const [dailyMyLineOnly, setDailyMyLineOnly] = React.useState(false);
  const [dailyAutoRefresh, setDailyAutoRefresh] = React.useState(true);
  const [dailyLastUpdated, setDailyLastUpdated] = React.useState<Date | null>(null);
  const [isDailySilentRefreshing, setIsDailySilentRefreshing] = React.useState(false);
  const [dailyLiveTick, setDailyLiveTick] = React.useState(0);
  const [showAllLineRows, setShowAllLineRows] = React.useState(false);
  const [preferredDailyLine, setPreferredDailyLine] = React.useState<string>(() => {
    try {
      return localStorage.getItem(DAILY_MY_LINE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [expandedMachineKeys, setExpandedMachineKeys] = React.useState<Record<string, boolean>>({});
  const [discExpandedKeys, setDiscExpandedKeys] = React.useState<Record<string, boolean>>({});
  const [discPage, setDiscPage] = React.useState(0);
  const [discPageSize, setDiscPageSize] = React.useState(10);
  const [discVerdictFilter, setDiscVerdictFilter] = React.useState<'all' | 'late' | 'slow' | 'both'>('all');
  const [discSort, setDiscSort] = React.useState<'combined' | 'late' | 'extra' | 'operator'>('combined');
  const [localMeta, setLocalMeta] = React.useState<Record<string, LocalActionMeta>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [savingRootCause, setSavingRootCause] = React.useState<string | null>(null);
  const [operatorBulkOverwritePending, setOperatorBulkOverwritePending] = React.useState<OperatorBulkOverwritePending | null>(null);
  /** Per operator: `__bulk__` or production row `id` for single-cycle root cause */
  const [operatorRootScope, setOperatorRootScope] = React.useState<Record<string, string>>({});
  const prevCriticalKeys = React.useRef<Set<string>>(new Set());
  const prevIssueKeysRef = React.useRef<Set<string>>(new Set());
  const prevIssueByKeyRef = React.useRef<Map<string, MissedAction>>(new Map());
  const isFirstFetch = React.useRef(true);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const [reminderSettings, setReminderSettings] = React.useState<IdleReminderSettingRow[]>([]);
  const [reminderDefaults, setReminderDefaults] = React.useState<IdleReminderDraft>(
    draftFromIdleRow({
      idle_interval_secs: 40,
      idle_interval_mins: 0,
      idle_interval_secs_part: 40,
      alarm_duration_secs: 12,
      finish_grace_mins: 0,
    })
  );
  const [reminderLoading, setReminderLoading] = React.useState(false);
  const [reminderError, setReminderError] = React.useState<string | null>(null);
  const [reminderSavingId, setReminderSavingId] = React.useState<string | null>(null);
  const [reminderDrafts, setReminderDrafts] = React.useState<Record<string, IdleReminderDraft>>({});
  const [reminderLineFilter, setReminderLineFilter] = React.useState<string>('all');
  const [workCentres, setWorkCentres] = React.useState<Array<{ id: number; name: string; code?: string }>>([]);

  React.useEffect(() => {
    apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`)
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setWorkCentres(result.data || []);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (HIDDEN_MISSED_TABS.has(activeTab)) {
      setActiveTab(DEFAULT_VISIBLE_MISSED_TAB);
    }
  }, [activeTab]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'daily') setActiveTab('daily');
    else if (tab === 'live') setActiveTab('live');
    else if (tab === 'discipline') setActiveTab('discipline');
    else if (tab === 'reminder' || tab === 'settings') setActiveTab('reminder');
    else if (tab === 'operator') setActiveTab(DEFAULT_VISIBLE_MISSED_TAB);
  }, []);

  React.useEffect(() => {
    setOperatorRootScope({});
  }, [dailyReportDate, dailyDateTo, dailyLine]);

  React.useEffect(() => {
    if (dailyLine === 'all') return;
    setPreferredDailyLine(dailyLine);
    try {
      localStorage.setItem(DAILY_MY_LINE_KEY, dailyLine);
    } catch {
      // non-blocking
    }
  }, [dailyLine]);

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

  const fetchData = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setIsLoading(true);
    else setIsSilentRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startReminderMins: '10',
        finishGraceMins: '0',
      });
      if (selectedLine !== 'all') {
        const wc = workCentres.find((w) => w.name === selectedLine);
        if (wc?.id) params.set('work_centre_id', String(wc.id));
      }
      const response = await apiFetch(`${API_BASE}/api/missed-actions?${params.toString()}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load missed actions');
      const incoming: MissedAction[] = result.data || [];
      const incomingKeys = new Set(incoming.map((i) => i.issue_key));
      const incomingMap = new Map(incoming.map((i) => [i.issue_key, i]));

      if (!isFirstFetch.current && prevIssueKeysRef.current.size > 0) {
        const resolved: ResolvedIssueFlash[] = [];
        const resolvedAt = new Date().toISOString();
        prevIssueByKeyRef.current.forEach((prevItem, key) => {
          if (!incomingKeys.has(key)) {
            resolved.push({
              issue_key: key,
              machine_name: prevItem.machine_name,
              action_label: prevItem.action_label,
              resolved_at: resolvedAt,
            });
          }
        });
        if (resolved.length > 0) {
          setLocalMeta((meta) => {
            const next = resolved.reduce(
              (acc, r) => ({
                ...acc,
                [r.issue_key]: {
                  ...(acc[r.issue_key] || {}),
                  lastAction: 'Auto-resolved (mobile)',
                  lastActionAt: resolvedAt,
                  trail: [
                    ...((acc[r.issue_key]?.trail) || []),
                    { action: 'Auto-resolved (mobile)', at: resolvedAt },
                  ],
                },
              }),
              meta
            );
            try {
              localStorage.setItem(LOCAL_META_KEY, JSON.stringify(next));
            } catch {
              // non-blocking
            }
            return next;
          });
          setRecentlyResolved((prev) => [...resolved, ...prev].slice(0, 8));
          resolved.slice(0, 2).forEach((r) => {
            toast.success(`${r.machine_name}: ${r.action_label} cleared on mobile`, { duration: 5000 });
          });
        }
      }

      const newCriticalKeys = new Set(
        incoming
          .filter((i) => i.overdue_mins >= 60 && !i.state?.acknowledged && !i.state?.is_snoozed)
          .map((i) => i.issue_key)
      );
      const hasNewCritical = [...newCriticalKeys].some((k) => !prevCriticalKeys.current.has(k));
      if (hasNewCritical && !isFirstFetch.current) playAlert();
      isFirstFetch.current = false;
      prevCriticalKeys.current = newCriticalKeys;
      prevIssueKeysRef.current = incomingKeys;
      prevIssueByKeyRef.current = incomingMap;

      setItems((prev) => {
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
      if (!silent) setError(e.message || 'Failed to load missed actions');
    } finally {
      if (!silent) setIsLoading(false);
      setIsSilentRefreshing(false);
    }
  }, [playAlert, selectedLine, workCentres]);

  React.useEffect(() => {
    if (activeTab !== 'live') return undefined;
    void fetchData();
    if (!liveAutoRefresh) return undefined;
    const id = window.setInterval(() => {
      void fetchData({ silent: true });
    }, 15_000);
    return () => window.clearInterval(id);
  }, [activeTab, liveAutoRefresh, fetchData]);

  React.useEffect(() => {
    if (activeTab !== 'live') return undefined;
    const id = window.setInterval(() => setLiveLiveTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  React.useEffect(() => {
    if (recentlyResolved.length === 0) return undefined;
    const id = window.setTimeout(() => setRecentlyResolved([]), 90_000);
    return () => window.clearInterval(id);
  }, [recentlyResolved]);

  const liveSecondsSinceRefresh = React.useMemo(() => {
    if (!lastUpdated) return null;
    void liveLiveTick;
    return Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
  }, [lastUpdated, liveLiveTick]);

  React.useEffect(() => {
    const wcIds = Array.from(
      new Set(
        items
          .map((i) => Number(i.work_centre_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
    if (wcIds.length === 0) {
      setMachineLossMinsMap({});
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    let cancelled = false;
    (async () => {
      const merged: Record<string, number> = {};
      await Promise.all(
        wcIds.map(async (wcId) => {
          try {
            const res = await apiFetch(
              `${API_BASE}/api/tracker/machine-time-loss?work_centre_id=${wcId}&date=${today}`
            );
            const json = await res.json();
            if (!json.success || !Array.isArray(json.machines)) return;
            json.machines.forEach((row: { machine_id?: string; net_mins?: number }) => {
              const mid = String(row.machine_id || '');
              if (!mid) return;
              const loss = Number(row.net_mins) || 0;
              merged[`${wcId}:${mid}`] = loss < 0 ? Math.abs(loss) : 0;
            });
          } catch {
            // non-fatal
          }
        })
      );
      if (!cancelled) setMachineLossMinsMap(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const getMachineLossForItem = React.useCallback(
    (item: MissedActionLike) => {
      const wcId = Number(item.work_centre_id);
      const mid = String(item.machine_id || '');
      if (!Number.isFinite(wcId) || !mid) return Number(item.overdue_mins) || 0;
      return machineLossMinsMap[`${wcId}:${mid}`] ?? (Number(item.overdue_mins) || 0);
    },
    [machineLossMinsMap]
  );

  const openMachineContext = React.useCallback(async (item: MissedAction) => {
    setContextItem(item);
    setContextLoading(true);
    setContextCycles([]);
    setContextMachineOutput(null);
    setContextMachineLoss(null);
    const today = new Date().toISOString().slice(0, 10);
    const wcId = Number(item.work_centre_id);
    const machineId = encodeURIComponent(item.machine_id || '');
    try {
      const [cyclesRes, lossRes, machinesRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/mobile-production/machine/${machineId}/daily-cycles?date=${today}`),
        Number.isFinite(wcId)
          ? apiFetch(`${API_BASE}/api/tracker/machine-time-loss?work_centre_id=${wcId}&date=${today}`)
          : Promise.resolve(null),
        Number.isFinite(wcId)
          ? apiFetch(`${API_BASE}/api/tv-dashboard/machine-centres/${wcId}?date=${today}`)
          : Promise.resolve(null),
      ]);
      const cyclesJson = await cyclesRes.json();
      if (cyclesJson.success) {
        setContextCycles((cyclesJson.events || []).slice(-8).reverse());
      }
      if (lossRes) {
        const lossJson = await lossRes.json();
        const row = (lossJson.machines || []).find(
          (m: { machine_id?: string }) => String(m.machine_id) === String(item.machine_id)
        );
        if (row) {
          const net = Number(row.net_mins) || 0;
          setContextMachineLoss(net < 0 ? Math.abs(net) : 0);
        }
      }
      if (machinesRes) {
        const machinesJson = await machinesRes.json();
        const row = (machinesJson.data || []).find(
          (m: { machine_id?: string }) => String(m.machine_id) === String(item.machine_id)
        );
        if (row) setContextMachineOutput(Number(row.total_output_pairs || 0));
      }
    } catch {
      toast.error('Could not load machine context');
    } finally {
      setContextLoading(false);
    }
  }, []);

  const productionTrackerHref = React.useCallback((item: MissedAction) => {
    const wcId = Number(item.work_centre_id);
    if (Number.isFinite(wcId) && wcId > 0) return `/production_tracker/line/${wcId}`;
    return '/production_tracker';
  }, []);

  const fetchDailyReport = React.useCallback(async (opts?: { skipLoading?: boolean }) => {
    const silent = opts?.skipLoading === true;
    if (!silent) setDailyLoading(true);
    if (silent) setIsDailySilentRefreshing(true);
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
      setDailyLastUpdated(new Date());
    } catch (e: any) {
      if (!silent) setDailyError(e.message || 'Failed to load daily report');
    } finally {
      if (!silent) setDailyLoading(false);
      if (silent) setIsDailySilentRefreshing(false);
    }
  }, [dailyLine, dailyReportDate, dailyDateTo]);

  const isViewingTodayDaily = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return dailyReportDate <= today && dailyDateTo >= today;
  }, [dailyReportDate, dailyDateTo]);

  const dailySecondsSinceRefresh = React.useMemo(() => {
    if (!dailyLastUpdated) return null;
    void dailyLiveTick;
    return Math.max(0, Math.floor((Date.now() - dailyLastUpdated.getTime()) / 1000));
  }, [dailyLastUpdated, dailyLiveTick]);

  React.useEffect(() => {
    if (activeTab !== 'daily') return undefined;
    void fetchDailyReport();
    return undefined;
  }, [activeTab, fetchDailyReport]);

  React.useEffect(() => {
    if (activeTab !== 'daily' || !isViewingTodayDaily || !dailyAutoRefresh) return undefined;
    const id = window.setInterval(() => {
      void fetchDailyReport({ skipLoading: true });
    }, 15_000);
    return () => window.clearInterval(id);
  }, [activeTab, isViewingTodayDaily, dailyAutoRefresh, fetchDailyReport]);

  React.useEffect(() => {
    if (activeTab !== 'daily') return undefined;
    const id = window.setInterval(() => setDailyLiveTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== 'discipline') return;
    // Discipline tab reuses dailyEvents — trigger a fetch if data is empty
    if (dailyEvents.length === 0 && !dailyLoading) fetchDailyReport();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (activeTab !== 'operator') return;
    if (dailyEvents.length === 0 && !dailyLoading) fetchDailyReport();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReminderSettings = React.useCallback(async () => {
    setReminderLoading(true);
    setReminderError(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/idle-reminder-settings`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load reminder settings');
      const rows: IdleReminderSettingRow[] = result.data || [];
      setReminderSettings(rows);
      if (result.defaults) {
        setReminderDefaults(draftFromIdleRow({
          idle_interval_secs: Number(result.defaults.idle_interval_secs) || 40,
          idle_interval_mins: Number(result.defaults.idle_interval_mins) || 0,
          idle_interval_secs_part: Number(result.defaults.idle_interval_secs_part) ?? 40,
          alarm_duration_secs: Number(result.defaults.alarm_duration_secs) || 12,
          finish_grace_mins: Number(result.defaults.finish_grace_mins) || 0,
        }));
      }
      setReminderDrafts({});
    } catch (e: any) {
      setReminderError(e.message || 'Failed to load reminder settings');
    } finally {
      setReminderLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'reminder') return;
    fetchReminderSettings();
  }, [activeTab, fetchReminderSettings]);

  const getReminderDraft = React.useCallback((row: IdleReminderSettingRow): IdleReminderDraft => {
    const draft = reminderDrafts[row.machine_id];
    if (draft) return draft;
    return draftFromIdleRow(row);
  }, [reminderDrafts]);

  const patchReminderDraft = (machineId: string, patch: Partial<IdleReminderDraft>) => {
    setReminderDrafts((prev) => {
      const baseRow = reminderSettings.find((r) => r.machine_id === machineId);
      const base = prev[machineId] || (baseRow ? draftFromIdleRow(baseRow) : reminderDefaults);
      return { ...prev, [machineId]: { ...base, ...patch } };
    });
  };

  const saveReminderSettings = async (machineId: string) => {
    const row = reminderSettings.find((r) => r.machine_id === machineId);
    if (!row) return;
    const draft = getReminderDraft(row);
    setReminderSavingId(machineId);
    try {
      const response = await apiFetch(`${API_BASE}/api/idle-reminder-settings/machine/${encodeURIComponent(machineId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Save failed');
      toast.success(`Saved reminder settings for machine ${machineId}`);
      setReminderDrafts((prev) => {
        const next = { ...prev };
        delete next[machineId];
        return next;
      });
      await fetchReminderSettings();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save reminder settings');
    } finally {
      setReminderSavingId(null);
    }
  };

  const resetReminderSettings = async (machineId: string) => {
    setReminderSavingId(machineId);
    try {
      const response = await apiFetch(`${API_BASE}/api/idle-reminder-settings/machine/${encodeURIComponent(machineId)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Reset failed');
      toast.success(`Reset machine ${machineId} to defaults`);
      setReminderDrafts((prev) => {
        const next = { ...prev };
        delete next[machineId];
        return next;
      });
      await fetchReminderSettings();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reset reminder settings');
    } finally {
      setReminderSavingId(null);
    }
  };

  const filteredReminderSettings = React.useMemo(() => {
    if (reminderLineFilter === 'all') return reminderSettings;
    return reminderSettings.filter((r) => r.work_centre_name === reminderLineFilter);
  }, [reminderLineFilter, reminderSettings]);

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

  const lineLabel = (wc: { code?: string; name: string }) =>
    wc.code ? `${wc.code} - ${wc.name}` : wc.name;

  const hasLiveFilters =
    selectedLine !== 'all' || issueFilter !== 'all' || liveSort !== 'priority' || showMuted;

  const clearLiveFilters = () => {
    setSelectedLine('all');
    setIssueFilter('all');
    setLiveSort('priority');
    setShowMuted(false);
  };

  const activeTabMeta = VISIBLE_MISSED_TABS.find((t) => t.id === activeTab) ?? VISIBLE_MISSED_TABS[0];

  const getSeverity = (overdueMins: number) => {
    if (overdueMins >= 60) return { label: 'Critical', cls: 'bg-red-200 text-red-900 border-red-400' };
    if (overdueMins >= 30) return { label: 'High', cls: 'bg-red-100 text-red-800 border-red-300' };
    if (overdueMins >= 10) return { label: 'Medium', cls: 'bg-amber-200 text-amber-900 border-amber-400' };
    return { label: 'Low', cls: 'bg-green-100 text-green-800 border-green-300' };
  };

  const getSlaStatus = (overdueMins: number) => {
    const rounded = Math.max(0, Math.round(Number(overdueMins || 0)));
    if (rounded >= 45) return { label: `Critical breach +${Math.max(0, rounded - 30)}m`, cls: 'text-red-900 bg-red-200', pct: 100, color: '#b91c1c' };
    if (rounded >= 30) return { label: `Breached by ${Math.max(0, rounded - 30)}m`, cls: 'text-red-800 bg-red-100', pct: 100, color: '#ef4444' };
    if (rounded >= 15) return { label: `Warning (${rounded}m)`, cls: 'text-amber-900 bg-amber-200', pct: Math.round((rounded / 30) * 100), color: '#d97706' };
    const dueIn = Math.max(0, 15 - rounded);
    return { label: `Due in ${dueIn}m`, cls: 'text-green-800 bg-green-100', pct: Math.round((rounded / 30) * 100), color: '#16a34a' };
  };

  const SlaCircle: React.FC<{ overdueMins: number }> = ({ overdueMins }) => {
    const sla = getSlaStatus(overdueMins);
    const size = 30;
    const stroke = 3;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const filled = circ - (circ * Math.min(sla.pct, 100)) / 100;
    return (
      <div className="flex items-center justify-center opacity-60">
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
    const list = [...filteredItems];
    if (liveSort === 'fix_first') {
      return list.sort((a, b) => {
        const scoreA = getFixFirstScore(a, getMachineLossForItem(a));
        const scoreB = getFixFirstScore(b, getMachineLossForItem(b));
        if (scoreB !== scoreA) return scoreB - scoreA;
        return Number(b.overdue_mins || 0) - Number(a.overdue_mins || 0);
      });
    }
    if (liveSort === 'overdue') {
      return list.sort((a, b) => Number(b.overdue_mins || 0) - Number(a.overdue_mins || 0));
    }
    if (liveSort === 'machine') {
      return list.sort((a, b) => String(a.machine_name || '').localeCompare(String(b.machine_name || '')));
    }
    return list.sort((a, b) => {
      const recA = recurrenceMap.get(`${a.machine_id || a.machine_name}|${a.action_type}`) || 0;
      const recB = recurrenceMap.get(`${b.machine_id || b.machine_name}|${b.action_type}`) || 0;
      const priA = getPriorityScore(a, recA);
      const priB = getPriorityScore(b, recB);
      if (priA !== priB) return priB - priA;
      return b.overdue_mins - a.overdue_mins;
    });
  }, [filteredItems, recurrenceMap, liveSort, getMachineLossForItem]);

  const fixFirstTopItems = React.useMemo(
    () =>
      [...filteredItems]
        .sort((a, b) => {
          const scoreA = getFixFirstScore(a, getMachineLossForItem(a));
          const scoreB = getFixFirstScore(b, getMachineLossForItem(b));
          return scoreB - scoreA;
        })
        .slice(0, 3),
    [filteredItems, getMachineLossForItem]
  );

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
      machines: Array.from(line.machines.values()).sort((a, b) => {
        const bLost = b.events.reduce((s, e) => s + eventLostMins(e), 0);
        const aLost = a.events.reduce((s, e) => s + eventLostMins(e), 0);
        return bLost - aLost;
      }),
    })).sort((a, b) => {
      const bLost = b.machines.reduce((s, m) => s + m.events.reduce((t, e) => t + eventLostMins(e), 0), 0);
      const aLost = a.machines.reduce((s, m) => s + m.events.reduce((t, e) => t + eventLostMins(e), 0), 0);
      return bLost - aLost;
    });
  }, [dailyEvents]);

  const lineLossRows = React.useMemo(() => {
    return [...dailyByLine]
      .map((line) => {
        const inactive = Number(line.inactive_mins || 0);
        const extra = Number(line.extra_mins || 0);
        const lost = Number(line.lost_mins ?? inactive + extra);
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
      const total = dailyEvents.reduce((sum, event) => {
        const eventStart = event.start_time ? new Date(event.start_time) : null;
        if (!eventStart || Number.isNaN(eventStart.getTime())) return sum;
        if (eventStart >= start && eventStart < end) return sum + eventLostMins(event);
        return sum;
      }, 0);
      return {
        label: `${start.getHours().toString().padStart(2, '0')}:00`,
        inactive,
        extra,
        total,
      };
    });
    return rows;
  }, [dailyEvents]);

  const dailyFilteredEvents = React.useMemo(() => {
    let rows = [...dailyEvents];
    if (dailyMyLineOnly && preferredDailyLine) {
      rows = rows.filter((r) => String(r.work_centre_name) === preferredDailyLine);
    }
    if (dailyBreachedOnly) {
      rows = rows.filter((r) => Number(r.inactive_mins || 0) >= 15 || Number(r.extra_mins || 0) > 0);
    }
    return rows;
  }, [dailyEvents, dailyMyLineOnly, preferredDailyLine, dailyBreachedOnly]);

  const dailyVisibleLineRows = React.useMemo(() => {
    let rows = lineLossRows;
    if (dailyMyLineOnly && preferredDailyLine) {
      rows = rows.filter((r) => r.work_centre_name === preferredDailyLine);
    }
    return rows;
  }, [lineLossRows, dailyMyLineOnly, preferredDailyLine]);

  const dailyVisibleSummary = React.useMemo(() => ({
    total_cycles: dailyVisibleLineRows.reduce((sum, r) => sum + Number(r.cycles || 0), 0),
    total_inactive_mins: dailyVisibleLineRows.reduce((sum, r) => sum + r.inactive, 0),
    total_extra_mins: dailyVisibleLineRows.reduce((sum, r) => sum + r.extra, 0),
    total_lost_mins: dailyVisibleLineRows.reduce((sum, r) => sum + r.lost, 0),
  }), [dailyVisibleLineRows]);

  const dailyVisibleLineLossRows = React.useMemo(() => {
    let rows = [...dailyVisibleLineRows].sort((a, b) => b.lost - a.lost);
    if (dailyTopOffendersOnly) rows = rows.slice(0, 5);
    if (!showAllLineRows) rows = rows.slice(0, 8);
    return rows.map((row) => ({
      work_centre_name: row.work_centre_name,
      cycles: row.cycles,
      inactive: row.inactive,
      extra: row.extra,
      lost: row.lost,
      perCycle: row.perCycle,
    }));
  }, [dailyVisibleLineRows, dailyTopOffendersOnly, showAllLineRows]);

  const dailyVisibleLineMachineGroups = React.useMemo(() => {
    let groups = [...dailyLineMachineGroups];
    if (dailyMyLineOnly && preferredDailyLine) {
      groups = groups.filter((g) => g.lineName === preferredDailyLine);
    }
    if (dailyBreachedOnly) {
      groups = groups
        .map((g) => ({
          ...g,
          machines: g.machines
            .map((m) => ({
              ...m,
              events: m.events.filter((e) => Number(e.inactive_mins || 0) >= 15 || Number(e.extra_mins || 0) > 0),
            }))
            .filter((m) => m.events.length > 0),
        }))
        .filter((g) => g.machines.length > 0);
    }
    if (dailyTopOffendersOnly) groups = groups.slice(0, 5);
    return groups;
  }, [dailyLineMachineGroups, dailyMyLineOnly, preferredDailyLine, dailyBreachedOnly, dailyTopOffendersOnly]);

  const operatorRows = React.useMemo(() => {
    type Agg = {
      employee_code: string;
      employee_name: string;
      total_cycles: number;
      late_cycles: number;
      slow_cycles: number;
      both_cycles: number;
      forgot_start: number;
      forgot_finish: number;
      total_inactive_mins: number;
      total_extra_mins: number;
      total_lost_mins: number;
      rootCauseCounts: Map<string, number>;
    };
    const map = new Map<string, Agg>();
    dailyEvents.forEach((e) => {
      const key = e.employee_code || 'N/A';
      if (!map.has(key)) map.set(key, {
        employee_code: key,
        employee_name: e.employee_name || key,
        total_cycles: 0,
        late_cycles: 0,
        slow_cycles: 0,
        both_cycles: 0,
        forgot_start: 0,
        forgot_finish: 0,
        total_inactive_mins: 0,
        total_extra_mins: 0,
        total_lost_mins: 0,
        rootCauseCounts: new Map(),
      });
      const row = map.get(key)!;
      const late = Math.round(e.inactive_mins || 0);
      const extra = Math.round(e.extra_mins || 0);
      const rc = (e.root_cause || '').toLowerCase();
      const rcLabel = (e.root_cause || '').trim();
      row.total_cycles += 1;
      if (late > 0 && extra > 0) row.both_cycles += 1;
      else if (late > 0) row.late_cycles += 1;
      else if (extra > 0) row.slow_cycles += 1;
      if (rc === 'forgot to start') row.forgot_start += 1;
      if (rc === 'forgot to finish') row.forgot_finish += 1;
      row.total_inactive_mins += late;
      row.total_extra_mins += extra;
      row.total_lost_mins += eventLostMins(e);
      if (rcLabel) {
        row.rootCauseCounts.set(rcLabel, (row.rootCauseCounts.get(rcLabel) || 0) + 1);
      }
    });
    return Array.from(map.values())
      .filter((r) => r.total_lost_mins > 0)
      .sort((a, b) => b.total_lost_mins - a.total_lost_mins)
      .map((r) => {
        const parts = [...r.rootCauseCounts.entries()]
          .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
          .map(([label, n]) => `${label} (${n}×)`);
        const root_cause_summary = parts.length ? parts.join(' · ') : '—';
        const {
          rootCauseCounts: _omit,
          ...rest
        } = r;
        return { ...rest, root_cause_summary };
      });
  }, [dailyEvents]);

  const previousDayTrend = React.useMemo(() => {
    if (!weeklyTrend || weeklyTrend.length < 2) return null;
    const sorted = [...weeklyTrend].sort((a, b) => String(a.day).localeCompare(String(b.day)));
    return sorted[sorted.length - 2] || null;
  }, [weeklyTrend]);

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

  /**
   * Operator-ranking row edits map to many daily cycles (`missed_action_states.issue_key` = `daily__${cycleId}`).
   * Bulk rules: for a non-empty cause, apply to loss cycles (inactive+extra > 0) for that operator that still have an empty root_cause.
   * If every such cycle already has a cause, toast and offer in-app confirm to overwrite all loss cycles for that operator.
   * Clearing: remove root_cause only on cycles that currently have one (among loss cycles).
   */
  const formatCycleOptionLabel = (ev: DailyReportEvent) => {
    const machine = (ev.machine_name || ev.machine_id || '—').toString().trim();
    let timePart = '—';
    try {
      const d = new Date(ev.start_time);
      if (!Number.isNaN(d.getTime())) {
        timePart = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      timePart = String(ev.start_time || '').slice(0, 16) || '—';
    }
    const lost = eventLostMins(ev);
    return `${machine} · ${timePart} · ${lost}m`;
  };

  const saveOperatorSingleCycleRootCause = React.useCallback(
    async (employeeCode: string, cycleId: number, rootCause: string) => {
      const ev = dailyEvents.find((e) => e.id === cycleId);
      if (!ev || (ev.employee_code || 'N/A') !== employeeCode) {
        toast.error('Cycle not found for this operator.');
        return;
      }
      const lost = eventLostMins(ev);
      if (lost <= 0) {
        toast.error('Not a loss cycle.');
        return;
      }
      const trimmed = rootCause.trim();
      if (!trimmed && !(ev.root_cause || '').trim()) {
        toast('Nothing to clear on this cycle.');
        return;
      }
      const saveKey = `operator__${employeeCode}__${cycleId}`;
      setSavingRootCause(saveKey);
      try {
        await apiFetch(`${API_BASE}/api/missed-actions/root-cause`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_key: `daily__${cycleId}`, root_cause: trimmed }),
        });
        setSavingRootCause(null);
        await fetchDailyReport({ skipLoading: true });
        toast.success(trimmed ? 'Root cause saved for this cycle' : 'Root cause cleared for this cycle');
      } catch {
        toast.error('Failed to save root cause');
        await fetchDailyReport({ skipLoading: true });
      } finally {
        setSavingRootCause(null);
      }
    },
    [dailyEvents, fetchDailyReport]
  );

  const applyOperatorBulkRootCause = React.useCallback(
    async (employeeCode: string, trimmed: string, targets: Array<{ id: number }>, usedOverwriteAll: boolean) => {
      const saveKey = `operator__${employeeCode}`;
      setSavingRootCause(saveKey);
      try {
        await Promise.all(
          targets.map((ev) =>
            apiFetch(`${API_BASE}/api/missed-actions/root-cause`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ issue_key: `daily__${ev.id}`, root_cause: trimmed }),
            })
          )
        );
        setSavingRootCause(null);
        await fetchDailyReport({ skipLoading: true });
        if (trimmed) {
          toast.success(
            usedOverwriteAll
              ? `Root cause applied to ${targets.length} cycle(s) (replaced existing)`
              : `Root cause applied to ${targets.length} cycle(s)`
          );
        } else {
          toast.success(`Root cause cleared on ${targets.length} cycle(s)`);
        }
      } catch {
        toast.error('Failed to save root cause(s)');
        await fetchDailyReport({ skipLoading: true });
      } finally {
        setSavingRootCause(null);
      }
    },
    [fetchDailyReport]
  );

  const saveOperatorBulkRootCause = React.useCallback(
    async (employeeCode: string, rootCause: string) => {
      const opKey = (e: DailyReportEvent) => e.employee_code || 'N/A';
      const lostMins = (e: DailyReportEvent) => eventLostMins(e);
      const candidates = dailyEvents.filter((e) => opKey(e) === employeeCode && lostMins(e) > 0);
      if (candidates.length === 0) {
        toast.error('No cycles with time loss for this operator in the current report.');
        return;
      }
      const trimmed = rootCause.trim();
      let targets: DailyReportEvent[];
      let usedOverwriteAll = false;
      if (!trimmed) {
        targets = candidates.filter((e) => !!(e.root_cause || '').trim());
        if (targets.length === 0) {
          toast('Nothing to clear — no saved root causes on loss cycles for this operator.');
          return;
        }
      } else {
        const emptyRoots = candidates.filter((e) => !(e.root_cause || '').trim());
        if (emptyRoots.length > 0) {
          targets = emptyRoots;
        } else {
          toast('All loss cycles already have a root cause.', { duration: 4000 });
          const displayName = (candidates[0]?.employee_name || '').trim() || employeeCode;
          setOperatorBulkOverwritePending({
            employeeCode,
            employeeName: displayName,
            lossCycleCount: candidates.length,
            rootCause: trimmed,
            cycleIds: candidates.map((c) => c.id),
          });
          return;
        }
      }
      await applyOperatorBulkRootCause(employeeCode, trimmed, targets, usedOverwriteAll);
    },
    [dailyEvents, applyOperatorBulkRootCause]
  );

  const cancelOperatorBulkOverwrite = React.useCallback(() => {
    setOperatorBulkOverwritePending(null);
  }, []);

  const confirmOperatorBulkOverwrite = React.useCallback(async () => {
    const pending = operatorBulkOverwritePending;
    if (!pending) return;
    setOperatorBulkOverwritePending(null);
    const targets = pending.cycleIds.map((id) => ({ id }));
    await applyOperatorBulkRootCause(pending.employeeCode, pending.rootCause.trim(), targets, true);
  }, [operatorBulkOverwritePending, applyOperatorBulkRootCause]);

  React.useEffect(() => {
    if (!operatorBulkOverwritePending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOperatorBulkOverwritePending(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [operatorBulkOverwritePending]);

  const operatorRowRootCauseSelectValue = React.useMemo(() => {
    const map = new Map<string, string | undefined>();
    const byOp = new Map<string, DailyReportEvent[]>();
    dailyEvents.forEach((e) => {
      const lost = eventLostMins(e);
      if (lost <= 0) return;
      const k = e.employee_code || 'N/A';
      if (!byOp.has(k)) byOp.set(k, []);
      byOp.get(k)!.push(e);
    });
    byOp.forEach((list, k) => {
      const roots = list.map((e) => (e.root_cause || '').trim()).filter(Boolean);
      if (roots.length === 0) {
        map.set(k, undefined);
        return;
      }
      const first = roots[0]!;
      map.set(k, roots.every((r) => r === first) ? first : undefined);
    });
    return map;
  }, [dailyEvents]);

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

  const handleSecondaryAction = async (item: MissedAction, action: string) => {
    if (!action) return;
    if (action === 'unmute') {
      await unmuteItem(item);
      return;
    }
    if (action.startsWith('snooze_')) {
      const mins = Number(action.replace('snooze_', ''));
      if (Number.isFinite(mins) && mins > 0) {
        await snoozeItem(item, mins);
      }
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
    if (dailyFilteredEvents.length === 0) return;
    const headers = ['line', 'machine', 'operator', 'start_time', 'finish_time', 'target_mins', 'actual_mins', 'inactive_mins', 'extra_mins'];
    const rows = [
      `"snapshot_at","${new Date().toISOString()}"`,
      `"report_date","${dailyReportDate} to ${dailyDateTo}"`,
      `"total_cycles","${dailyVisibleSummary.total_cycles}"`,
      `"total_inactive_mins","${dailyVisibleSummary.total_inactive_mins}"`,
      `"total_extra_mins","${dailyVisibleSummary.total_extra_mins}"`,
      `"total_lost_mins","${dailyVisibleSummary.total_lost_mins}"`,
      '',
      headers.join(','),
      ...dailyFilteredEvents.map((i) => {
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

  const exportDailySummaryCsv = () => {
    if (dailyVisibleLineLossRows.length === 0) return;
    const headers = ['line', 'cycles', 'inactive_mins', 'extra_mins', 'lost_mins', 'loss_per_cycle'];
    const rows = [
      `"snapshot_at","${new Date().toISOString()}"`,
      `"report_date","${dailyReportDate} to ${dailyDateTo}"`,
      `"total_cycles","${dailyVisibleSummary.total_cycles}"`,
      `"total_inactive_mins","${dailyVisibleSummary.total_inactive_mins}"`,
      `"total_extra_mins","${dailyVisibleSummary.total_extra_mins}"`,
      `"total_lost_mins","${dailyVisibleSummary.total_lost_mins}"`,
      '',
      headers.join(','),
      ...dailyVisibleLineLossRows.map((row) => [
        `"${row.work_centre_name}"`,
        row.cycles,
        `"${formatMinutes(row.inactive)}"`,
        `"${formatMinutes(row.extra)}"`,
        `"${formatMinutes(row.lost)}"`,
        `"${formatMinutes(row.perCycle)}"`,
      ].join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missed_actions_daily_summary_${dailyReportDate}.csv`;
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

  const formatDashboardLoss = (value: number) => {
    const parts = minutesToDurationParts(Math.abs(Number(value) || 0));
    return `${parts.wholeMinutes}m ${parts.seconds}s`;
  };

  const criticalItemsCount = React.useMemo(
    () => sortedFilteredItems.filter((item) => Number(item.overdue_mins || 0) >= 60).length,
    [sortedFilteredItems]
  );
  const maxOverdueMins = React.useMemo(
    () => sortedFilteredItems.reduce((max, item) => Math.max(max, Math.round(Number(item.overdue_mins || 0))), 0),
    [sortedFilteredItems]
  );

  const liveTotalTimeLossMins = React.useMemo(
    () =>
      filteredItems.reduce((sum, item) => sum + getMachineLossForItem(item), 0),
    [filteredItems, getMachineLossForItem]
  );

  const renderRecoveryPill = (item: MissedAction, compact = false) => {
    const hint = formatRecoveryHint(item);
    if (!hint) return null;
    const urgent = hint.includes('nearly closed');
    return (
      <span
        title={hint}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium leading-tight ${
          compact ? 'max-w-[200px] truncate' : 'mt-2 items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug'
        } ${
          urgent
            ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
            : 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
        }`}
      >
        <TrendingUp className={`shrink-0 text-current ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5 mt-0.5'}`} aria-hidden />
        <span className={compact ? 'truncate' : undefined}>{hint}</span>
      </span>
    );
  };

  const renderLiveQuickLinks = (item: MissedAction, compact = false) => (
    <div className={`flex gap-1 ${compact ? 'shrink-0' : 'mt-2 flex-wrap gap-1.5'}`}>
      <button
        type="button"
        onClick={() => openMachineContext(item)}
        className={`inline-flex items-center gap-1 font-semibold text-slate-700 hover:bg-slate-200 ${
          compact
            ? 'rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px]'
            : 'rounded-md bg-slate-100 px-2 py-1 text-[11px]'
        }`}
        title="Machine details"
      >
        <Cpu className="h-3 w-3" aria-hidden />
        {!compact && 'Details'}
      </button>
      <button
        type="button"
        onClick={() => navigate(productionTrackerHref(item))}
        className={`inline-flex items-center gap-1 font-semibold text-blue-700 hover:bg-blue-100 ${
          compact
            ? 'rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px]'
            : 'rounded-md bg-blue-50 px-2 py-1 text-[11px]'
        }`}
        title="Open production tracker"
      >
        <ExternalLink className="h-3 w-3" aria-hidden />
        {!compact && 'Tracker'}
      </button>
      <a
        href={`/mobile/${encodeURIComponent(item.machine_id || item.machine_name || '')}`}
        className={`inline-flex items-center gap-1 font-semibold text-indigo-700 hover:bg-indigo-100 ${
          compact
            ? 'rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px]'
            : 'rounded-md bg-indigo-50 px-2 py-1 text-[11px]'
        }`}
        title="Mobile view"
      >
        {!compact && 'Mobile'}
        {compact && <Zap className="h-3 w-3" aria-hidden />}
      </a>
    </div>
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      {contextItem && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setContextItem(null)}>
          <div
            className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="machine-context-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Machine context</p>
                <h2 id="machine-context-title" className="text-lg font-bold text-gray-900 truncate">
                  {contextItem.machine_name}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  {contextItem.work_centre_name} · {contextItem.employee_name} ({contextItem.employee_code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContextItem(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {contextLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[10px] font-bold uppercase text-gray-500">Today output</p>
                      <p className="text-2xl font-black text-gray-900 mt-1">{contextMachineOutput ?? '—'}</p>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <p className="text-[10px] font-bold uppercase text-rose-700 flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        Time loss
                      </p>
                      <p className="text-2xl font-black text-rose-900 mt-1">
                        {contextMachineLoss != null ? formatTimeLossLabel(contextMachineLoss) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className={`rounded-lg border p-3 text-sm ${
                    contextItem.action_type === 'START_PENDING'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
                  }`}>
                    <p className="font-bold text-gray-900 flex items-center gap-1.5">
                      {contextItem.action_type === 'START_PENDING' ? (
                        <PlayCircle className="h-4 w-4 text-amber-700" aria-hidden />
                      ) : (
                        <Square className="h-4 w-4 text-red-700" aria-hidden />
                      )}
                      {contextItem.action_label}
                    </p>
                    <p className="text-gray-700 mt-1">{formatOverdueLabel(contextItem.overdue_mins)}</p>
                    {renderRecoveryPill(contextItem)}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-gray-500 mb-2">Recent cycles today</p>
                    {contextCycles.length === 0 ? (
                      <p className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-300 p-4 text-center">
                        No finished cycles yet today
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {contextCycles.map((c) => (
                          <div key={c.id} className="rounded-lg border border-gray-200 px-3 py-2 text-xs">
                            <div className="flex justify-between gap-2 font-semibold text-gray-800">
                              <span>{c.start_time ? new Date(c.start_time).toLocaleTimeString() : '—'}</span>
                              <span>{Number(c.output_pairs || 0)} pairs</span>
                            </div>
                            <p className="text-gray-500 mt-0.5">
                              {formatMinutes(Number(c.actual_mins || 0))}m actual · target {formatMinutes(Number(c.target_mins || 0))}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="border-t border-gray-200 p-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  navigate(productionTrackerHref(contextItem));
                  setContextItem(null);
                }}
                className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open Production Tracker
              </button>
              <a
                href={`/mobile/${encodeURIComponent(contextItem.machine_id || '')}`}
                className="inline-flex items-center justify-center gap-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-100"
              >
                Open mobile screen
              </a>
            </div>
          </div>
        </div>
      )}
      {operatorBulkOverwritePending && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelOperatorBulkOverwrite();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-bulk-overwrite-title"
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="operator-bulk-overwrite-title" className="text-lg font-bold text-gray-900">
              Replace root causes on all loss cycles?
            </h2>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              Apply{' '}
              <span className="font-semibold text-gray-900">&quot;{operatorBulkOverwritePending.rootCause}&quot;</span>
              {' '}to all{' '}
              <span className="font-semibold text-gray-900">{operatorBulkOverwritePending.lossCycleCount}</span>
              {' '}loss cycle(s) for{' '}
              <span className="font-semibold text-gray-900">{operatorBulkOverwritePending.employeeName}</span>
              {' '}
              <span className="text-gray-500">({operatorBulkOverwritePending.employeeCode})</span>
              . Existing root causes on those cycles will be replaced.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelOperatorBulkOverwrite}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void confirmOperatorBulkOverwrite(); }}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full space-y-5">
        <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 pt-1 pb-3 bg-gradient-to-b from-slate-100 via-slate-100/95 to-transparent backdrop-blur-md">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Operations</p>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Missed Actions</h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 hidden sm:block">
                  Track missed START/FINISH clicks, shift time loss, and mobile reminder settings.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                {activeTab === 'live' && liveSecondsSinceRefresh !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">
                    <Radio className={`h-3 w-3 ${isSilentRefreshing ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} aria-hidden />
                    Live · {liveSecondsSinceRefresh}s ago
                  </span>
                )}
                {activeTab === 'daily' && dailySecondsSinceRefresh !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">
                    <RefreshCw className={`h-3 w-3 ${isDailySilentRefreshing ? 'animate-spin text-blue-600' : 'text-slate-400'}`} aria-hidden />
                    Report · {dailySecondsSinceRefresh}s ago
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {VISIBLE_MISSED_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = activeTabMeta.icon;
              return <Icon className="h-4 w-4 text-blue-600 shrink-0" aria-hidden />;
            })()}
            <div>
              <p className="text-sm font-bold text-slate-900">{activeTabMeta.label}</p>
              <p className="text-xs text-slate-500">
                {activeTab === 'live' && 'Real-time missed START and FINISH alerts across all lines.'}
                {activeTab === 'daily' && 'Completed-cycle inactive and extra minutes for a date range.'}
                {activeTab === 'discipline' && 'Late starts and slow finishes per cycle.'}
                {activeTab === 'operator' && 'Operator-level loss summary and root causes.'}
                {activeTab === 'reminder' && 'Per-machine idle reminder and finish grace on mobile.'}
              </p>
            </div>
          </div>
        </div>

        {activeTab === 'live' ? (
          <>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4 sm:p-5 shadow-sm ring-1 ring-black/[0.02]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-200/80">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Live monitoring</span>
              </div>
              <h2 className="mt-3 text-lg sm:text-xl font-bold text-slate-900">Missed START / FINISH</h2>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Machines where operators likely forgot to click START or FINISH — sorted by time-loss impact.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {liveSecondsSinceRefresh !== null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
                    <Radio className={`h-3.5 w-3.5 ${isSilentRefreshing ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} aria-hidden />
                    Updated {liveSecondsSinceRefresh}s ago
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-slate-200">Not updated yet</span>
                )}
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none rounded-full bg-white px-2.5 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={liveAutoRefresh}
                    onChange={(e) => setLiveAutoRefresh(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Auto-refresh every 15s
                </label>
              </div>
            </div>
            {filteredItems.length > 0 && (
              <div className="shrink-0 rounded-2xl bg-white px-4 py-3 ring-1 ring-rose-200/80 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">Filtered time loss</p>
                <p className="mt-1 text-2xl font-black text-rose-700 tabular-nums">{formatTimeLossLabel(liveTotalTimeLossMins)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{filteredItems.length} issue{filteredItems.length === 1 ? '' : 's'} in view</p>
              </div>
            )}
          </div>
        </div>

        {recentlyResolved.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Recently fixed on mobile
            </p>
            <div className="flex flex-wrap gap-2">
              {recentlyResolved.slice(0, 5).map((r) => (
                <span
                  key={`${r.issue_key}-${r.resolved_at}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 shadow-sm"
                >
                  <Zap className="h-3 w-3 text-emerald-600" aria-hidden />
                  {r.machine_name} — {r.action_label}
                </span>
              ))}
            </div>
          </div>
        )}

        {fixFirstTopItems.length > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Fix first — highest time-loss impact
              </p>
              <span className="text-[10px] font-semibold text-gray-500">Tap for machine details</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {fixFirstTopItems.map((item, idx) => {
                const lossMins = getMachineLossForItem(item);
                const isStart = item.action_type === 'START_PENDING';
                return (
                  <button
                    key={item.issue_key}
                    type="button"
                    onClick={() => openMachineContext(item)}
                    className="group text-left rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/80 to-white p-4 shadow-sm hover:border-rose-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-[11px] font-black text-white">
                        {idx + 1}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        isStart ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isStart ? <PlayCircle className="h-3 w-3" aria-hidden /> : <Square className="h-3 w-3" aria-hidden />}
                        {item.action_label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-blue-900">{item.machine_name}</p>
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden />
                      {formatOverdueLabel(item.overdue_mins)}
                    </p>
                    <p className="text-xs font-bold text-rose-800 mt-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 rotate-180" aria-hidden />
                      {formatTimeLossLabel(lossMins)} today
                    </p>
                    {renderRecoveryPill(item)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="col-span-2 lg:col-span-1 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-indigo-700">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-wide">Total alerts</p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-indigo-900 mt-2 tabular-nums">{filteredSummary.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-amber-700">
              <PlayCircle className="h-4 w-4" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-wide">Start pending</p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-amber-900 mt-2 tabular-nums">{filteredSummary.start_pending}</p>
          </div>
          <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-red-700">
              <Square className="h-4 w-4" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-wide">Finish pending</p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-red-900 mt-2 tabular-nums">{filteredSummary.finish_pending}</p>
          </div>
          <div className="col-span-2 lg:col-span-1 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-rose-700">
              <Clock className="h-4 w-4" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-wide">Time loss (filtered)</p>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-800 mt-2 leading-tight tabular-nums">{formatTimeLossLabel(liveTotalTimeLossMins)}</p>
          </div>
        </div>
        {criticalItemsCount > 0 && (
          <div className="rounded-xl border border-red-300 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Critical: {criticalItemsCount} issue{criticalItemsCount === 1 ? '' : 's'} overdue 60m+
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-200 text-red-900 text-xs font-bold">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Max {formatOverdueLabel(maxOverdueMins)}
            </span>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Priority Score Guide</p>
            <button
              type="button"
              onClick={() => setShowPriorityGuide((v) => !v)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              {showPriorityGuide ? 'Hide guide' : 'Show guide'}
            </button>
          </div>
          {showPriorityGuide && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">2 — Low overdue</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">3 — 15m+</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">4 — 30m+</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">5 — 60m+ Critical</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-200 text-red-800 text-xs font-semibold">+1 Finish Pending</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">+1 Repeated 3×</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">max 7</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ring-1 ring-black/[0.02]">
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden />
                <p className="text-sm font-bold text-slate-800">Filters & actions</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasLiveFilters && (
                  <button
                    type="button"
                    onClick={clearLiveFilters}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Clear filters
                  </button>
                )}
                <span className="text-xs text-slate-500 tabular-nums">
                  {filteredItems.length} of {items.length} shown
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:min-w-[200px] sm:w-auto sm:flex-1 sm:max-w-xs">
              <label className={FILTER_LABEL}>
                <span className="inline-flex items-center gap-1"><Filter className="h-3 w-3" aria-hidden /> Line</span>
              </label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className={FILTER_CONTROL}
              >
                <option value="all">All lines</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.name}>{lineLabel(wc)}</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-auto md:flex-1">
              <label className={FILTER_LABEL}>Issue type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setIssueFilter('all')}
                  className={`px-3 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${issueFilter === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setIssueFilter('START_PENDING')}
                  className={`px-3 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${issueFilter === 'START_PENDING' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => setIssueFilter('FINISH_PENDING')}
                  className={`px-3 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${issueFilter === 'FINISH_PENDING' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  Finish
                </button>
              </div>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <label className={FILTER_LABEL}>Sort by</label>
              <select
                value={liveSort}
                onChange={(e) => setLiveSort(e.target.value as 'fix_first' | 'priority' | 'overdue' | 'machine')}
                className={FILTER_CONTROL}
              >
                <option value="fix_first">Fix first (time loss)</option>
                <option value="priority">Priority score</option>
                <option value="overdue">Overdue (high to low)</option>
                <option value="machine">Machine (A-Z)</option>
              </select>
            </div>
            <div className="w-full lg:w-auto lg:ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => setShowMuted((v) => !v)}
                className={`inline-flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  showMuted ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : `${BTN_SECONDARY} text-xs py-2.5`
                }`}
              >
                <BellOff className="h-3.5 w-3.5" />
                {showMuted ? 'Hide muted' : 'Show muted'}
              </button>
              <button
                onClick={acknowledgeFiltered}
                disabled={sortedFilteredItems.length === 0 || isActionLoading === '__bulk__'}
                className="inline-flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm disabled:opacity-60 transition-colors"
              >
                {isActionLoading === '__bulk__' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Ack filtered
              </button>
              <button
                onClick={exportFilteredCsv}
                disabled={sortedFilteredItems.length === 0}
                className={`${BTN_DARK} text-xs py-2.5`}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                onClick={() => void fetchData()}
                disabled={isLoading}
                className={`${BTN_PRIMARY} text-xs py-2.5`}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>
            </div>
            {(selectedLine !== 'all' || issueFilter !== 'all' || liveSort !== 'priority') && (
              <div className="w-full flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                {selectedLine !== 'all' && <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">Line: {selectedLine}</span>}
                {issueFilter !== 'all' && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">Issue: {issueFilter === 'START_PENDING' ? 'Start pending' : 'Finish pending'}</span>}
                {liveSort !== 'priority' && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">Sort: {LIVE_SORT_LABELS[liveSort] || liveSort}</span>}
              </div>
            )}
          </div>

          {isLoading && items.length === 0 ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="py-10 px-6 text-center">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            items.length === 0 ? (
              <div className="py-20 px-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500" aria-hidden />
                </div>
                <p className="text-lg font-bold text-slate-900 mt-4">All clear</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">No missed START or FINISH issues right now. Live monitoring continues in the background.</p>
              </div>
            ) : (
              <div className="py-16 px-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                  <Filter className="h-7 w-7 text-slate-400" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-4">No issues match current filters</p>
                <p className="text-xs text-slate-500 mt-1">Try a different line or issue type.</p>
                {hasLiveFilters && (
                  <button type="button" onClick={clearLiveFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800">
                    Clear all filters
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="space-y-4 p-3">
              {Object.entries(groupedItems).map(([lineName, lineItems]) => (
                <div key={lineName} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white ring-1 ring-black/[0.03]">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-100 via-slate-50 to-white border-b border-gray-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <Radio className="h-4 w-4" aria-hidden />
                      </div>
                      <p className="text-sm font-bold text-gray-900 truncate">{lineName}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full ring-1 ring-blue-200 tabular-nums">
                      {lineItems.length} issue{lineItems.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="md:hidden divide-y divide-gray-100">
                    {lineItems.map((item) => {
                      const severity = getSeverity(item.overdue_mins);
                      const sla = getSlaStatus(item.overdue_mins);
                      const recurrence = recurrenceMap.get(`${item.machine_id || item.machine_name}|${item.action_type}`) || 0;
                      const priority = getPriorityScore(item, recurrence);
                      const meta = localMeta[item.issue_key] || {};
                      const lossMins = getMachineLossForItem(item);
                      return (
                        <div
                          key={`${item.session_id}-${item.machine_id}-${item.action_type}`}
                          className={`p-3.5 sm:p-4 space-y-3 rounded-none ${Number(item.overdue_mins || 0) >= 60 ? 'bg-red-50/80' : 'bg-white'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <button
                                type="button"
                                onClick={() => openMachineContext(item)}
                                className="text-sm font-semibold text-blue-800 hover:text-blue-900 hover:underline text-left"
                              >
                                {item.machine_name}
                              </button>
                              <p className="text-xs text-gray-600">{item.employee_name} ({item.employee_code})</p>
                            </div>
                            <span className={`inline-flex items-center justify-center min-w-[118px] px-2.5 py-1 rounded-full text-[11px] leading-none font-semibold whitespace-nowrap ${
                              item.action_type === 'START_PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {item.action_label}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] leading-none font-semibold border whitespace-nowrap ${severity.cls}`}>
                              {formatOverdueLabel(item.overdue_mins)}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${severity.cls}`}>
                              {severity.label}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
                              <Clock className="h-3 w-3" aria-hidden />
                              {formatTimeLossLabel(lossMins)}
                            </span>
                            {recurrence > 1 && (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${recurrence >= 3 ? 'bg-red-200 text-red-900' : 'bg-purple-100 text-purple-700'}`}>
                                Repeat ×{recurrence}
                              </span>
                            )}
                            <div className="inline-flex items-center gap-1">
                              <SlaCircle overdueMins={item.overdue_mins} />
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${sla.cls}`}>{sla.label}</span>
                            </div>
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                              P{priority}
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 rounded-lg bg-gray-50 px-3 py-2">
                            <p>{item.details}</p>
                            {renderRecoveryPill(item)}
                            {renderLiveQuickLinks(item)}
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase">Root Cause</label>
                            <RootCauseSelect
                              value={item.state?.root_cause}
                              onChange={(val) => saveRootCause(item, val)}
                              disabled={savingRootCause === item.issue_key}
                              className="w-full px-2 py-2 text-xs border border-gray-300 rounded bg-white"
                            />
                          </div>

                          {item.state?.acknowledged && item.state.acknowledged_by && (
                            <p className="text-[11px] text-gray-500">Acked by: <span className="font-semibold">{item.state.acknowledged_by}</span></p>
                          )}

                          <div className="text-xs text-gray-600">
                            {meta.lastAction ? (
                              <div className="space-y-1">
                                <div className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.lastAction.toLowerCase().includes('resolve') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{meta.lastAction}</div>
                                <div className="text-[11px] text-gray-500">{meta.lastActionAt ? new Date(meta.lastActionAt).toLocaleString() : ''}</div>
                              </div>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">Pending</span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            <button
                              type="button"
                              onClick={() => acknowledgeItem(item)}
                              disabled={isActionLoading === item.issue_key}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ack
                            </button>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                handleSecondaryAction(item, e.target.value);
                                e.target.value = '';
                              }}
                              disabled={isActionLoading === item.issue_key}
                              className="px-2.5 py-1.5 rounded border border-gray-300 text-xs font-semibold text-gray-700 bg-white"
                            >
                              <option value="">Escalate</option>
                              <option value="snooze_15">Snooze 15m</option>
                              <option value="snooze_30">Snooze 30m</option>
                              <option value="snooze_60">Snooze 1h</option>
                              <option value="snooze_120">Snooze end of shift</option>
                              {(item.state?.is_snoozed || item.state?.acknowledged) && <option value="unmute">Unmute</option>}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100/90 border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Machine</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Operator</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Issue</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Overdue</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Impact</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Severity</th>
                          <th className="px-2 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider w-10">P</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">SLA</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[220px]">Details</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Root cause</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Trail</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lineItems.map((item) => {
                          const severity = getSeverity(item.overdue_mins);
                          const sla = getSlaStatus(item.overdue_mins);
                          const recurrence = recurrenceMap.get(`${item.machine_id || item.machine_name}|${item.action_type}`) || 0;
                          const priority = getPriorityScore(item, recurrence);
                          const meta = localMeta[item.issue_key] || {};
                          const lossMins = getMachineLossForItem(item);
                          const isCritical = Number(item.overdue_mins || 0) >= 60;
                          return (
                            <tr
                              key={`${item.session_id}-${item.machine_id}-${item.action_type}`}
                              className={`transition-colors hover:bg-slate-50/90 ${isCritical ? 'bg-red-50/40 border-l-[3px] border-l-red-500' : 'border-l-[3px] border-l-transparent'}`}
                            >
                              <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openMachineContext(item)}
                                  className="text-left text-sm font-semibold text-blue-800 hover:text-blue-900 hover:underline max-w-[140px] truncate block"
                                  title={item.machine_name}
                                >
                                  {item.machine_name}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 align-middle text-gray-700 max-w-[150px]">
                                <span className="inline-flex items-center gap-1 min-w-0" title={`${item.employee_name} (${item.employee_code})`}>
                                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                                  <span className="truncate text-xs">{item.employee_name} <span className="text-gray-400">({item.employee_code})</span></span>
                                </span>
                              </td>
                              <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] leading-none font-bold whitespace-nowrap ring-1 ${
                                  item.action_type === 'START_PENDING'
                                    ? 'bg-amber-50 text-amber-800 ring-amber-200'
                                    : 'bg-red-50 text-red-800 ring-red-200'
                                }`}>
                                  {item.action_type === 'START_PENDING' ? <PlayCircle className="h-3 w-3" aria-hidden /> : <Square className="h-3 w-3" aria-hidden />}
                                  {item.action_label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] leading-none font-bold border whitespace-nowrap tabular-nums ${severity.cls}`}>
                                  <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                                  {formatOverdueLabel(item.overdue_mins)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-800 ring-1 ring-rose-200 whitespace-nowrap tabular-nums">
                                  {formatTimeLossLabel(lossMins)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${severity.cls}`}>
                                    {severity.label}
                                  </span>
                                  {recurrence > 1 && (
                                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${recurrence >= 3 ? 'bg-red-200 text-red-900' : 'bg-purple-100 text-purple-700'}`}>
                                      ×{recurrence}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-2.5 align-middle text-center">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white tabular-nums" title={`Priority ${priority}`}>
                                  {priority}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 align-middle">
                                <div className="flex flex-col items-center gap-0.5 min-w-[88px]">
                                  <SlaCircle overdueMins={item.overdue_mins} />
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold leading-tight text-center max-w-[100px] ${sla.cls}`}>
                                    {sla.label}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 align-top max-w-[280px]">
                                <p className="text-xs text-gray-600 line-clamp-2 leading-snug" title={item.details}>{item.details}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1 min-w-0">
                                  {renderRecoveryPill(item, true)}
                                  {renderLiveQuickLinks(item, true)}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 align-middle">
                                <RootCauseSelect
                                  value={item.state?.root_cause}
                                  onChange={(val) => saveRootCause(item, val)}
                                  disabled={savingRootCause === item.issue_key}
                                  className="min-w-[128px] max-w-[160px] px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              </td>
                              <td className="px-3 py-2.5 align-middle text-gray-600 min-w-[100px]">
                                {item.state?.acknowledged && item.state.acknowledged_by && (
                                  <p className="text-[10px] text-gray-500 mb-0.5 truncate" title={item.state.acknowledged_by}>
                                    <span className="font-semibold">{item.state.acknowledged_by}</span>
                                  </p>
                                )}
                                {meta.lastAction ? (
                                  <div>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.lastAction.toLowerCase().includes('resolve') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {meta.lastAction}
                                    </span>
                                    {meta.lastActionAt && (
                                      <p className="text-[9px] text-gray-400 mt-0.5 tabular-nums">
                                        {new Date(meta.lastActionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Pending</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => acknowledgeItem(item)}
                                    disabled={isActionLoading === item.issue_key}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                    Ack
                                  </button>
                                  <select
                                    defaultValue=""
                                    onChange={(e) => {
                                      handleSecondaryAction(item, e.target.value);
                                      e.target.value = '';
                                    }}
                                    disabled={isActionLoading === item.issue_key}
                                    className="px-2 py-1.5 rounded-lg border border-gray-300 text-[11px] font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                                  >
                                    <option value="">More</option>
                                    <option value="snooze_15">Snooze 15m</option>
                                    <option value="snooze_30">Snooze 30m</option>
                                    <option value="snooze_60">Snooze 1h</option>
                                    <option value="snooze_120">Snooze end of shift</option>
                                    {(item.state?.is_snoozed || item.state?.acknowledged) && <option value="unmute">Unmute</option>}
                                  </select>
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
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ring-1 ring-black/[0.02]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {isViewingTodayDaily ? (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none rounded-full bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200 hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={dailyAutoRefresh}
                        onChange={(e) => setDailyAutoRefresh(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                      />
                      Auto-refresh every 15s
                    </label>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200 text-slate-400">
                      Auto-refresh when viewing today only
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div>
                  <label className={FILTER_LABEL}>From</label>
                  <input
                    type="date"
                    value={dailyReportDate}
                    max={dailyDateTo}
                    onChange={(e) => setDailyReportDate(e.target.value)}
                    className={FILTER_CONTROL}
                  />
                </div>
                <div>
                  <label className={FILTER_LABEL}>To</label>
                  <input
                    type="date"
                    value={dailyDateTo}
                    min={dailyReportDate}
                    onChange={(e) => setDailyDateTo(e.target.value)}
                    className={FILTER_CONTROL}
                  />
                </div>
                <div>
                  <label className={FILTER_LABEL}>
                    <span className="inline-flex items-center gap-1"><Filter className="h-3 w-3" aria-hidden /> Line</span>
                  </label>
                  <select
                    value={dailyLine}
                    onChange={(e) => setDailyLine(e.target.value)}
                    disabled={dailyLoading}
                    className={FILTER_CONTROL}
                  >
                    <option value="all">{dailyLoading ? 'Loading…' : 'All lines'}</option>
                    {workCentres.map((wc) => (
                      <option key={wc.id} value={wc.name}>{lineLabel(wc)}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => { void fetchDailyReport(); }}
                  disabled={dailyLoading}
                  className={BTN_PRIMARY}
                >
                  {dailyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={exportDailyCsv}
                  disabled={dailyFilteredEvents.length === 0}
                  className={BTN_DARK}
                >
                  <Download className="h-4 w-4" />
                  Export detail
                </button>
                <button
                  type="button"
                  onClick={exportDailySummaryCsv}
                  disabled={dailyVisibleLineLossRows.length === 0}
                  className={BTN_SECONDARY}
                >
                  <Download className="h-4 w-4" />
                  Export summary
                </button>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDailyTopOffendersOnly((v) => !v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${dailyTopOffendersOnly ? 'bg-red-100 text-red-800 border-red-300' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                >
                  Top offenders only
                </button>
                <button
                  type="button"
                  onClick={() => setDailyBreachedOnly((v) => !v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${dailyBreachedOnly ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                >
                  Breached only
                </button>
                <button
                  type="button"
                  onClick={() => setDailyMyLineOnly((v) => !v)}
                  disabled={!preferredDailyLine}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${dailyMyLineOnly ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'} disabled:opacity-50`}
                >
                  My line only {preferredDailyLine ? `(${preferredDailyLine})` : '(set line first)'}
                </button>
                <div className="ml-auto text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Inactive = blue</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Extra = amber</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Loss = red</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="bg-red-50 rounded-xl border-2 border-red-300 p-5 shadow-sm">
                <p className="text-[11px] text-red-700 font-semibold uppercase tracking-wide">Total Time Loss</p>
                <p className="text-3xl sm:text-4xl font-black text-red-800 mt-1 tabular-nums">
                  {formatDashboardLoss(dailyVisibleSummary.total_lost_mins)} <span className="text-lg sm:text-xl">loss</span>
                </p>
                {previousDayTrend && (
                  <p className={`text-xs mt-1 font-semibold ${dailyVisibleSummary.total_lost_mins <= previousDayTrend.lost_mins ? 'text-emerald-700' : 'text-red-700'}`}>
                    {dailyVisibleSummary.total_lost_mins <= previousDayTrend.lost_mins ? '↓' : '↑'} vs previous day ({formatDashboardLoss(previousDayTrend.lost_mins)})
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Same calculation as TV dashboard time loss</p>
              </div>
              <div className="bg-blue-50 rounded-xl border-2 border-blue-300 p-5 shadow-sm">
                <p className="text-[11px] text-blue-700 font-semibold uppercase tracking-wide">Inactive Minutes</p>
                <p className="text-4xl font-black text-blue-800 mt-1">{formatMinutes(dailyVisibleSummary.total_inactive_mins)}</p>
                <p className="text-xs text-gray-500 mt-1">Waiting / no-start loss</p>
              </div>
              <div className="bg-amber-50 rounded-xl border-2 border-amber-300 p-5 shadow-sm">
                <p className="text-[11px] text-amber-700 font-semibold uppercase tracking-wide">Extra Minutes</p>
                <p className="text-4xl font-black text-amber-800 mt-1">{formatMinutes(dailyVisibleSummary.total_extra_mins)}</p>
                <p className="text-xs text-gray-500 mt-1">Cycle over target duration</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Total Cycles</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{dailyVisibleSummary.total_cycles}</p>
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
                <p className="text-xl font-bold text-amber-700 mt-1">{dailyVisibleLineLossRows[0]?.work_centre_name || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {dailyVisibleLineLossRows[0] ? `${formatDashboardLoss(dailyVisibleLineLossRows[0].lost)} loss` : 'No data'}
                </p>
              </div>
            </div>
            {dailyError ? (
              <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-600 font-medium">{dailyError}</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-700">Line Loss Ranking</span>
                    <button type="button" onClick={() => setShowAllLineRows((v) => !v)} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                      {showAllLineRows ? 'Show fewer' : 'View all'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    {dailyVisibleLineLossRows.length === 0 ? (
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
                          {dailyVisibleLineLossRows.map((row) => (
                            <tr key={row.work_centre_name}>
                              <td className="px-3 py-2.5 text-sm font-semibold text-gray-800">{row.work_centre_name}</td>
                              <td className="px-3 py-2.5 text-sm text-gray-700">{row.cycles}</td>
                              <td className="px-3 py-2.5 text-sm text-blue-700 font-semibold">{formatMinutes(row.inactive)}</td>
                              <td className="px-3 py-2.5 text-sm text-amber-700 font-semibold">{formatMinutes(row.extra)}</td>
                              <td className="px-3 py-2.5 text-sm text-red-700 font-bold tabular-nums">{formatDashboardLoss(row.lost)}</td>
                              <td className="px-3 py-2.5 text-sm text-gray-700 tabular-nums">{formatDashboardLoss(row.perCycle)}</td>
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
                          {(showAllLineRows ? weeklyTrend : weeklyTrend.slice(-5)).map((d) => {
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
                      dailyVisibleLineMachineGroups.forEach((line) => {
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
                {dailyVisibleLineMachineGroups.slice(dailyPage * dailyPageSize, (dailyPage + 1) * dailyPageSize).map((line) => (
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
                                    <tr className="bg-blue-50">
                                      <td className="px-3 py-2 text-xs font-bold text-blue-800">Summary</td>
                                      <td className="px-3 py-2 text-xs text-blue-800" colSpan={3}>
                                        Cycles: {machine.events.length}
                                      </td>
                                      <td className="px-3 py-2 text-xs font-bold text-blue-800">{formatMinutes(machine.events.reduce((s, e) => s + Number(e.actual_mins || 0), 0))}</td>
                                      <td className="px-3 py-2 text-xs font-bold text-blue-800">{formatMinutes(machine.events.reduce((s, e) => s + Number(e.inactive_mins || 0), 0))}</td>
                                      <td className="px-3 py-2 text-xs font-bold text-amber-800">{formatMinutes(machine.events.reduce((s, e) => s + Number(e.extra_mins || 0), 0))}</td>
                                      <td className="px-3 py-2 text-xs text-gray-500">—</td>
                                    </tr>
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
                                          <RootCauseSelect
                                            value={row.root_cause}
                                            onChange={(val) => {
                                              const key = `daily__${row.id}`;
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
                                          />
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
              {dailyVisibleLineMachineGroups.length > 0 && (() => {
                const totalDailyPages = dailyPageSize === 0 ? 1 : Math.ceil(dailyVisibleLineMachineGroups.length / dailyPageSize);
                return (
                  <div className="px-3 pb-3 pt-3 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100">
                    <span>Page {dailyPageSize === 0 ? 1 : dailyPage + 1} of {totalDailyPages} &mdash; {dailyVisibleLineMachineGroups.length} line(s) total</span>
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

        {activeTab === 'reminder' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/[0.02]">
              <div>
                <p className="text-xs text-slate-500 mt-0">
                  Defaults: idle {formatIdleIntervalLabel(reminderDefaults.idle_interval_mins, reminderDefaults.idle_interval_secs_part)}, alarm {reminderDefaults.alarm_duration_secs}s, finish grace {reminderDefaults.finish_grace_mins} min (min 15s idle).
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void fetchReminderSettings(); }}
                disabled={reminderLoading}
                className={BTN_SECONDARY}
              >
                {reminderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/80 rounded-2xl p-4 text-sm text-blue-900 shadow-sm">
              <p className="font-bold flex items-center gap-2">
                <Settings2 className="h-4 w-4" aria-hidden />
                How it works on mobile
              </p>
              <ul className="list-disc ml-5 mt-2 space-y-1 text-blue-800/90 text-xs sm:text-sm">
                <li><strong>Mobile reminder sound</strong> uses <strong>Idle (min/sec)</strong> per machine (e.g. 10 min for machine 07).</li>
                <li><strong>Late Cycles / daily reports / TV time loss</strong> use shift <strong>9:05 AM – 5:35 PM</strong>; idle before START counts from the first second (lunch excluded).</li>
                <li><strong>Live START alerts</strong> still use <strong>40 seconds</strong> grace before flagging “next cycle not started” (separate from time loss).</li>
                <li><strong>Finish grace</strong> adds extra minutes after target time before a &quot;Finish not clicked&quot; alert appears in Live Issues.</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ring-1 ring-black/[0.02] flex flex-wrap gap-3 items-end">
              <div className="min-w-[200px] flex-1 sm:flex-none sm:max-w-xs">
                <label className={FILTER_LABEL}>
                  <span className="inline-flex items-center gap-1"><Filter className="h-3 w-3" aria-hidden /> Line</span>
                </label>
                <select
                  value={reminderLineFilter}
                  onChange={(e) => setReminderLineFilter(e.target.value)}
                  className={FILTER_CONTROL}
                >
                  <option value="all">All lines</option>
                  {workCentres.map((wc) => (
                    <option key={wc.id} value={wc.name}>{lineLabel(wc)}</option>
                  ))}
                </select>
              </div>
            </div>

            {reminderError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{reminderError}</div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {reminderLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading machines…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Line</th>
                        <th className="px-3 py-2 text-left">Machine</th>
                        <th className="px-3 py-2 text-left">Idle (min)</th>
                        <th className="px-3 py-2 text-left">Idle (sec)</th>
                        <th className="px-3 py-2 text-left">Alarm (sec)</th>
                        <th className="px-3 py-2 text-left">Finish grace (min)</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredReminderSettings.map((row) => {
                        const draft = getReminderDraft(row);
                        const isSaving = reminderSavingId === row.machine_id;
                        const hasDraft = !!reminderDrafts[row.machine_id];
                        return (
                          <tr key={row.machine_id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{row.work_centre_name || '—'}</td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-gray-900">{row.machine_id}</span>
                              {row.machine_name && (
                                <span className="block text-xs text-gray-500">{row.machine_name}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={120}
                                value={draft.idle_interval_mins}
                                onChange={(e) => patchReminderDraft(row.machine_id, { idle_interval_mins: Number(e.target.value) })}
                                className="w-16 px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={59}
                                value={draft.idle_interval_secs_part}
                                onChange={(e) => patchReminderDraft(row.machine_id, { idle_interval_secs_part: Number(e.target.value) })}
                                className="w-16 px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={3}
                                max={60}
                                value={draft.alarm_duration_secs}
                                onChange={(e) => patchReminderDraft(row.machine_id, { alarm_duration_secs: Number(e.target.value) })}
                                className="w-20 px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={60}
                                value={draft.finish_grace_mins}
                                onChange={(e) => patchReminderDraft(row.machine_id, { finish_grace_mins: Number(e.target.value) })}
                                className="w-20 px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {row.is_custom || hasDraft ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">Custom</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">Default</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => { void saveReminderSettings(row.machine_id); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 mr-1"
                              >
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={isSaving || (!row.is_custom && !hasDraft)}
                                onClick={() => { void resetReminderSettings(row.machine_id); }}
                                className="inline-flex px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredReminderSettings.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-10 text-center text-gray-500">No machines found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'discipline' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ring-1 ring-black/[0.02]">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div>
                  <label className={FILTER_LABEL}>From</label>
                  <input type="date" value={dailyReportDate} max={dailyDateTo} onChange={(e) => { setDailyReportDate(e.target.value); setDiscPage(0); }} className={FILTER_CONTROL} />
                </div>
                <div>
                  <label className={FILTER_LABEL}>To</label>
                  <input type="date" value={dailyDateTo} min={dailyReportDate} onChange={(e) => { setDailyDateTo(e.target.value); setDiscPage(0); }} className={FILTER_CONTROL} />
                </div>
                <div>
                  <label className={FILTER_LABEL}>
                    <span className="inline-flex items-center gap-1"><Filter className="h-3 w-3" aria-hidden /> Line</span>
                  </label>
                  <select value={dailyLine} onChange={(e) => { setDailyLine(e.target.value); setDiscPage(0); }} disabled={dailyLoading} className={FILTER_CONTROL}>
                    <option value="all">{dailyLoading ? 'Loading…' : 'All lines'}</option>
                    {workCentres.map((wc) => (
                      <option key={wc.id} value={wc.name}>{lineLabel(wc)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={FILTER_LABEL}>Verdict</label>
                  <select value={discVerdictFilter} onChange={(e) => { setDiscVerdictFilter(e.target.value as 'all' | 'late' | 'slow' | 'both'); setDiscPage(0); }} className={FILTER_CONTROL}>
                    <option value="all">All</option>
                    <option value="late">Late start</option>
                    <option value="slow">Slow finish</option>
                    <option value="both">Late + Slow</option>
                  </select>
                </div>
                <div>
                  <label className={FILTER_LABEL}>Sort by</label>
                  <select value={discSort} onChange={(e) => { setDiscSort(e.target.value as 'combined' | 'late' | 'extra' | 'operator'); setDiscPage(0); }} className={FILTER_CONTROL}>
                    <option value="combined">Combined loss</option>
                    <option value="late">Started late</option>
                    <option value="extra">Finished extra</option>
                    <option value="operator">Operator name</option>
                  </select>
                </div>
                <button type="button" onClick={() => { void fetchDailyReport(); }} disabled={dailyLoading} className={BTN_PRIMARY}>
                  {dailyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Blue = started late</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Amber = finished over</span>
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-semibold">Red = both</span>
              </div>
            </div>

            {dailyError && (
              <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-600 font-medium">{dailyError}</div>
            )}

            {(() => {
              let disciplineRows = dailyEvents
                .filter((e) => Math.round(e.inactive_mins || 0) > 0 || Math.round(e.extra_mins || 0) > 0);

              disciplineRows = disciplineRows.filter((e) => {
                const late = Math.round(e.inactive_mins || 0);
                const extra = Math.round(e.extra_mins || 0);
                if (discVerdictFilter === 'late') return late > 0 && extra === 0;
                if (discVerdictFilter === 'slow') return late === 0 && extra > 0;
                if (discVerdictFilter === 'both') return late > 0 && extra > 0;
                return true;
              });

              disciplineRows = disciplineRows.sort((a, b) => {
                if (discSort === 'late') return Math.round(b.inactive_mins || 0) - Math.round(a.inactive_mins || 0);
                if (discSort === 'extra') return Math.round(b.extra_mins || 0) - Math.round(a.extra_mins || 0);
                if (discSort === 'operator') return String(a.employee_name || '').localeCompare(String(b.employee_name || ''));
                return eventLostMins(b) - eventLostMins(a);
              });

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
              })).sort((a, b) => {
                const aExtra = a.rows.reduce((s, r) => s + Math.round(r.extra_mins || 0), 0);
                const bExtra = b.rows.reduce((s, r) => s + Math.round(r.extra_mins || 0), 0);
                const aLate = a.rows.reduce((s, r) => s + Math.round(r.inactive_mins || 0), 0);
                const bLate = b.rows.reduce((s, r) => s + Math.round(r.inactive_mins || 0), 0);
                const aCombined = a.rows.reduce((s, r) => s + eventLostMins(r), 0);
                const bCombined = b.rows.reduce((s, r) => s + eventLostMins(r), 0);
                if (discSort === 'late') {
                  if (bLate !== aLate) return bLate - aLate;
                  return bCombined - aCombined;
                }
                if (discSort === 'extra') {
                  if (bExtra !== aExtra) return bExtra - aExtra;
                  return bCombined - aCombined;
                }
                if (discSort === 'operator') {
                  return String(a.machineName).localeCompare(String(b.machineName));
                }
                return bCombined - aCombined;
              });

              const totalLateAll = disciplineRows.reduce((s, r) => s + Math.round(r.inactive_mins || 0), 0);
              const totalExtraAll = disciplineRows.reduce((s, r) => s + Math.round(r.extra_mins || 0), 0);
              const totalCombinedAll = disciplineRows.reduce((s, r) => s + eventLostMins(r), 0);
              const topOffenders = machineGroups.slice(0, 3).map((g) => {
                const late = g.rows.reduce((s, r) => s + Math.round(r.inactive_mins || 0), 0);
                const extra = g.rows.reduce((s, r) => s + Math.round(r.extra_mins || 0), 0);
                const combined = g.rows.reduce((s, r) => s + eventLostMins(r), 0);
                return { name: g.machineName, late, extra, combined };
              });

              const csvRowsInMachineOrder = machineGroups.flatMap((mg) => mg.rows);

              const totalPages = discPageSize === 0 ? 1 : Math.ceil(machineGroups.length / discPageSize);
              const pagedGroups = discPageSize === 0 ? machineGroups : machineGroups.slice(discPage * discPageSize, (discPage + 1) * discPageSize);

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-red-50 rounded-xl border-2 border-red-300 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Cycles With Issues</p>
                      <p className="text-4xl font-black text-red-800 mt-1">{disciplineRows.length}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl border-2 border-blue-300 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Started Late (mins)</p>
                      <p className="text-4xl font-black text-blue-800 mt-1">{totalLateAll}</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl border-2 border-amber-300 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Finished Over (mins)</p>
                      <p className="text-4xl font-black text-amber-800 mt-1">{totalExtraAll}</p>
                    </div>
                    <div className="bg-white rounded-xl border-2 border-gray-300 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Net Loss</p>
                      <p className="text-3xl sm:text-4xl font-black text-gray-900 mt-1 tabular-nums">{formatDashboardLoss(totalCombinedAll)}</p>
                    </div>
                  </div>

                  {topOffenders.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">Top Offenders</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {topOffenders.map((o) => (
                          <div key={o.name} className="rounded-lg border border-gray-200 p-2">
                            <p className="text-sm font-semibold text-gray-800">{o.name}</p>
                            <p className="text-xs text-gray-500">Late: <span className="font-semibold text-blue-700">{o.late}m</span> | Over: <span className="font-semibold text-amber-700">{o.extra}m</span></p>
                            <p className="text-xs font-bold text-red-700 mt-0.5 tabular-nums">Total: {formatDashboardLoss(o.combined)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Cycle Discipline — {disciplineRows.length} cycle(s) with issues</span>
                    <button
                      type="button"
                      onClick={() => {
                        const headers = ['operator', 'machine', 'line', 'date', 'start', 'finish', 'started_late_mins', 'finished_extra_mins', 'verdict'];
                        const csv = [headers.join(','), ...csvRowsInMachineOrder.map((e) => [
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
                              <div className="hidden md:block w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-red-400 rounded-full"
                                  style={{
                                    width: `${Math.max(8, Math.min(100, Math.round((mg.rows.reduce((s, r) => s + eventLostMins(r), 0) / Math.max(1, totalCombinedAll)) * 100)))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </button>
                          {isOpen && (
                            <div className="overflow-x-auto border-t border-gray-100">
                              <table className="min-w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Cycle</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Operator</th>
                                    {dailyLine === 'all' && <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Line</th>}
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
                                        <td className="px-3 py-3 text-xs font-bold text-gray-400 w-12">#{idx + 1}</td>
                                        <td className="px-3 py-3 text-sm font-semibold text-gray-800">
                                          {e.employee_name} <span className="text-xs font-normal text-gray-400">({e.employee_code})</span>
                                        </td>
                                        {dailyLine === 'all' && <td className="px-3 py-3 text-sm text-gray-600">{e.work_centre_name}</td>}
                                        <td className="px-3 py-3 text-sm text-gray-600">{e.start_time ? new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                        <td className="px-3 py-3 text-sm text-gray-600">{e.finish_time ? new Date(e.finish_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                        <td className="px-3 py-3 text-sm">
                                          {late > 0 ? <span className="px-2 py-0.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">{late}m late</span> : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-3 py-3 text-sm">
                                          {extra > 0 ? <span className="px-2 py-0.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">+{extra}m over</span> : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-3 py-3 text-sm">
                                          <span className={`px-2 py-0.5 rounded-full text-sm font-semibold ${
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
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'operator' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ring-1 ring-black/[0.02]">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className={FILTER_LABEL}>From</label>
                  <input type="date" value={dailyReportDate} max={dailyDateTo} onChange={(e) => setDailyReportDate(e.target.value)} className={FILTER_CONTROL} />
                </div>
                <div>
                  <label className={FILTER_LABEL}>To</label>
                  <input type="date" value={dailyDateTo} min={dailyReportDate} onChange={(e) => setDailyDateTo(e.target.value)} className={FILTER_CONTROL} />
                </div>
                <div>
                  <label className={FILTER_LABEL}>
                    <span className="inline-flex items-center gap-1"><Filter className="h-3 w-3" aria-hidden /> Line</span>
                  </label>
                  <select value={dailyLine} onChange={(e) => setDailyLine(e.target.value)} disabled={dailyLoading} className={FILTER_CONTROL}>
                    <option value="all">{dailyLoading ? 'Loading…' : 'All lines'}</option>
                    {workCentres.map((wc) => (
                      <option key={wc.id} value={wc.name}>{lineLabel(wc)}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => { void fetchDailyReport(); }} disabled={dailyLoading} className={BTN_PRIMARY}>
                  {dailyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
                <button
                  type="button"
                  disabled={operatorRows.length === 0}
                  onClick={() => {
                    const headers = ['operator', 'code', 'total_cycles', 'late_starts', 'slow_finishes', 'both', 'root_causes', 'inactive_mins', 'extra_mins', 'total_lost_mins'];
                    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
                    const csv = [headers.join(','), ...operatorRows.map((r) => [
                      esc(r.employee_name), esc(r.employee_code),
                      r.total_cycles, r.late_cycles, r.slow_cycles, r.both_cycles,
                      esc(r.root_cause_summary || '—'),
                      r.total_inactive_mins, r.total_extra_mins, r.total_lost_mins,
                    ].join(','))].join('\n');
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                    a.download = `operator_report_${dailyReportDate}_to_${dailyDateTo}.csv`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  }}
                  className={`${BTN_DARK} disabled:opacity-60`}
                >
                  <Download className="h-4 w-4" /> Export CSV
                </button>
              </div>
            </div>

            {dailyLoading ? (
              <div className="py-16 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : operatorRows.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">No operator issues found for this period.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-red-50 rounded-xl border-2 border-red-300 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase text-red-700">Operators With Issues</p>
                    <p className="text-4xl font-black text-red-800 mt-1">{operatorRows.length}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl border-2 border-blue-300 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase text-blue-700">Forgot to Start</p>
                    <p className="text-4xl font-black text-blue-800 mt-1">{operatorRows.reduce((s, r) => s + r.forgot_start, 0)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl border-2 border-amber-300 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase text-amber-700">Forgot to Finish</p>
                    <p className="text-4xl font-black text-amber-800 mt-1">{operatorRows.reduce((s, r) => s + r.forgot_finish, 0)}</p>
                  </div>
                  <div className="bg-white rounded-xl border-2 border-gray-300 p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase text-gray-500">Total Lost Mins</p>
                    <p className="text-4xl font-black text-gray-900 mt-1">{operatorRows.reduce((s, r) => s + r.total_lost_mins, 0)}</p>
                  </div>
                </div>

                {/* Forget Tracker — top 5 operators who forget most */}
                {(() => {
                  const forgotStart = [...operatorRows]
                    .map((r) => ({ ...r, forgot: r.forgot_start }))
                    .filter((r) => r.forgot > 0)
                    .sort((a, b) => b.forgot - a.forgot)
                    .slice(0, 5);
                  const forgotFinish = [...operatorRows]
                    .map((r) => ({ ...r, forgot: r.forgot_finish }))
                    .filter((r) => r.forgot > 0)
                    .sort((a, b) => b.forgot - a.forgot)
                    .slice(0, 5);
                  if (forgotStart.length === 0 && forgotFinish.length === 0) return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                      No "Forgot to start" or "Forgot to finish" root causes recorded yet for this period. Set root cause on cycles to track this.
                    </div>
                  );
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                          <span className="text-sm font-semibold text-amber-800">🟡 Forgot to START</span>
                          <span className="ml-2 text-xs text-amber-600">(late start cycles)</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {forgotStart.map((r, idx) => {
                            const rate = r.total_cycles > 0 ? Math.round((r.forgot / r.total_cycles) * 100) : 0;
                            const severity = rate >= 50 ? 'bg-red-100 text-red-700' : rate >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-50 text-yellow-700';
                            return (
                              <div key={r.employee_code} className="flex items-center justify-between px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-400 w-5">#{idx + 1}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{r.employee_name}</p>
                                    <p className="text-xs text-gray-400">{r.employee_code}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${severity}`}>{rate}% of cycles</span>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{r.forgot}× forgot</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                        <div className="px-3 py-2 bg-red-50 border-b border-red-200">
                          <span className="text-sm font-semibold text-red-800">🔴 Forgot to FINISH</span>
                          <span className="ml-2 text-xs text-red-500">(slow/over-target cycles)</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {forgotFinish.map((r, idx) => {
                            const rate = r.total_cycles > 0 ? Math.round((r.forgot / r.total_cycles) * 100) : 0;
                            const severity = rate >= 50 ? 'bg-red-100 text-red-700' : rate >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-orange-50 text-orange-700';
                            return (
                              <div key={r.employee_code} className="flex items-center justify-between px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-400 w-5">#{idx + 1}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{r.employee_name}</p>
                                    <p className="text-xs text-gray-400">{r.employee_code}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${severity}`}>{rate}% of cycles</span>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">{r.forgot}× forgot</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">Operator Ranking — worst first</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">#</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Operator</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Cycles</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Late Starts</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Slow Finishes</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Both</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Forget Rate</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase min-w-[10rem]">Root Causes</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Inactive (m)</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Extra (m)</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Total Lost</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Bar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {operatorRows.map((row, idx) => {
                          const maxLost = operatorRows[0].total_lost_mins;
                          const barPct = Math.max(4, Math.round((row.total_lost_mins / maxLost) * 100));
                          const isWorst = idx === 0;
                          return (
                            <tr key={row.employee_code} className={isWorst ? 'bg-red-50' : 'hover:bg-gray-50'}>
                              <td className="px-3 py-3 text-xs font-bold text-gray-400">#{idx + 1}</td>
                              <td className="px-3 py-3">
                                <p className="text-sm font-semibold text-gray-800">{row.employee_name}</p>
                                <p className="text-xs text-gray-400">{row.employee_code}</p>
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-700">{row.total_cycles}</td>
                              <td className="px-3 py-3">
                                {row.late_cycles + row.both_cycles > 0
                                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{row.late_cycles + row.both_cycles}×</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-3">
                                {row.slow_cycles + row.both_cycles > 0
                                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{row.slow_cycles + row.both_cycles}×</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-3">
                                {row.both_cycles > 0
                                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">{row.both_cycles}×</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-3">
                                {(() => {
                                  const totalForgot = row.forgot_start + row.forgot_finish;
                                  const rate = row.total_cycles > 0 ? Math.round((totalForgot / row.total_cycles) * 100) : 0;
                                  const cls = rate >= 50 ? 'bg-red-100 text-red-700' : rate >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
                                  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{rate}%</span>;
                                })()}
                              </td>
                              <td className="px-3 py-3 max-w-[18rem] align-top">
                                {(() => {
                                  const lossList = dailyEvents
                                    .filter((e) => {
                                      const lost = eventLostMins(e);
                                      return (e.employee_code || 'N/A') === row.employee_code && lost > 0;
                                    })
                                    .slice()
                                    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
                                  const scopeKey = row.employee_code;
                                  const scope = operatorRootScope[scopeKey] || '__bulk__';
                                  const opCode = String(row.employee_code);
                                  const bulkSaveKey = `operator__${opCode}`;
                                  const savingThisOperator =
                                    savingRootCause === bulkSaveKey ||
                                    (typeof savingRootCause === 'string' && savingRootCause.startsWith(`${bulkSaveKey}__`));
                                  const rcValue =
                                    scope === '__bulk__'
                                      ? operatorRowRootCauseSelectValue.get(row.employee_code)
                                      : (lossList.find((e) => String(e.id) === scope)?.root_cause ?? '');
                                  return (
                                    <>
                                      {lossList.length > 1 && (
                                        <label className="block mb-1">
                                          <span className="sr-only">Apply root cause to</span>
                                          <select
                                            value={scope}
                                            onChange={(e) => {
                                              setOperatorRootScope((prev) => ({ ...prev, [scopeKey]: e.target.value }));
                                            }}
                                            disabled={dailyLoading || savingThisOperator}
                                            className="w-full max-w-[16rem] mb-1.5 px-1.5 py-1 text-[11px] font-semibold border border-gray-300 rounded bg-gray-50 text-gray-800"
                                          >
                                            <option value="__bulk__">All loss cycles ({lossList.length})</option>
                                            {lossList.map((ev) => (
                                              <option key={ev.id} value={String(ev.id)}>
                                                One: {formatCycleOptionLabel(ev)}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      )}
                                      <RootCauseSelect
                                        key={`${opCode}-${scope}-${rcValue ?? ''}`}
                                        value={rcValue}
                                        onChange={(val) => {
                                          if (scope === '__bulk__') {
                                            void saveOperatorBulkRootCause(row.employee_code, val);
                                          } else {
                                            void saveOperatorSingleCycleRootCause(row.employee_code, Number(scope), val);
                                          }
                                        }}
                                        disabled={dailyLoading || savingThisOperator}
                                        className="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white w-full max-w-[16rem]"
                                      />
                                      {row.root_cause_summary !== '—' && (
                                        <p
                                          className="text-[10px] text-gray-400 mt-1 leading-snug line-clamp-2"
                                          title={row.root_cause_summary}
                                        >
                                          Summary: {row.root_cause_summary}
                                        </p>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-3 text-sm font-semibold text-blue-700">{row.total_inactive_mins}m</td>
                              <td className="px-3 py-3 text-sm font-semibold text-amber-700">{row.total_extra_mins}m</td>
                              <td className="px-3 py-3 text-sm font-bold text-red-700">{row.total_lost_mins}m</td>
                              <td className="px-3 py-3 w-28">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${barPct}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

