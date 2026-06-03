import React from 'react';
import { Loader2, AlertCircle, Download, Search, BarChart2, Clock, Users, AlertTriangle, Cpu, UserCheck, TrendingUp, ChevronRight, FileSpreadsheet, FileText, RotateCcw, Copy, Wrench, Calendar, Filter, X, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';
import * as XLSX from 'xlsx';
import { minutesToDurationParts } from '../utils/formatCycleDuration';

/** UI tabs (8). Legacy API slugs kept for fetch/export via resolveApiReportType. */
type ReportType =
  | 'hourly-production'
  | 'line-efficiency'
  | 'attendance'
  | 'rework-rejection'
  | 'machine-output'
  | 'employee'
  | 'idle-stoppages'
  | 'shift-summary';

type ApiReportType =
  | 'hourly-production'
  | 'line-efficiency'
  | 'attendance'
  | 'rework-rejection'
  | 'machine-output'
  | 'employee-output'
  | 'employee-performance'
  | 'time-loss'
  | 'attendance-production'
  | 'shift-summary'
  | 'bottleneck'
  | 'breakdown';

type ReportSubView = string;

const REPORT_SUB_VIEWS: Partial<Record<ReportType, { value: ReportSubView; label: string }[]>> = {
  attendance: [
    { value: 'register', label: 'Attendance register' },
    { value: 'vs-output', label: 'Attendance vs output' },
  ],
  employee: [
    { value: 'output', label: 'Output by employee' },
    { value: 'performance', label: 'Performance & efficiency' },
  ],
  'idle-stoppages': [
    { value: 'time-loss', label: 'Time loss (TV)' },
    { value: 'bottleneck', label: 'Bottleneck' },
    { value: 'breakdown', label: 'Breakdown' },
  ],
};

const DEFAULT_SUB_VIEW: Partial<Record<ReportType, ReportSubView>> = {
  attendance: 'register',
  employee: 'output',
  'idle-stoppages': 'time-loss',
};

const defaultSubViewFor = (tab: ReportType): ReportSubView => DEFAULT_SUB_VIEW[tab] || '';

const resolveApiReportType = (tab: ReportType, subView: ReportSubView): ApiReportType => {
  if (tab === 'employee') return subView === 'performance' ? 'employee-performance' : 'employee-output';
  if (tab === 'attendance') return subView === 'vs-output' ? 'attendance-production' : 'attendance';
  if (tab === 'idle-stoppages') {
    if (subView === 'bottleneck') return 'bottleneck';
    if (subView === 'breakdown') return 'breakdown';
    return 'time-loss';
  }
  return tab as ApiReportType;
};

/** Map legacy bookmarks / localStorage reportType to combined tabs. */
const migrateReportTab = (raw: string): { tab: ReportType; subView: ReportSubView } => {
  const legacy: Record<string, { tab: ReportType; subView: ReportSubView }> = {
    'employee-output': { tab: 'employee', subView: 'output' },
    'employee-performance': { tab: 'employee', subView: 'performance' },
    'attendance-production': { tab: 'attendance', subView: 'vs-output' },
    downtime: { tab: 'idle-stoppages', subView: 'time-loss' },
    'all-idle': { tab: 'idle-stoppages', subView: 'time-loss' },
    stoppages: { tab: 'idle-stoppages', subView: 'bottleneck' },
    bottleneck: { tab: 'idle-stoppages', subView: 'bottleneck' },
    breakdown: { tab: 'idle-stoppages', subView: 'breakdown' },
  };
  if (legacy[raw]) return legacy[raw];
  const tab = raw as ReportType;
  return { tab, subView: defaultSubViewFor(tab) };
};

const REPORT_OPTIONS: { value: ReportType; label: string; icon: React.ReactNode; color: string; keywords?: string }[] = [
  { value: 'hourly-production', label: 'Hourly Production', icon: <Clock className="h-5 w-5" />, color: 'blue' },
  { value: 'line-efficiency', label: 'Line & Process Efficiency', icon: <BarChart2 className="h-5 w-5" />, color: 'green' },
  { value: 'attendance', label: 'Attendance', icon: <Users className="h-5 w-5" />, color: 'purple', keywords: 'register vs output production' },
  { value: 'rework-rejection', label: 'Rework & Rejection', icon: <AlertTriangle className="h-5 w-5" />, color: 'yellow' },
  { value: 'machine-output', label: 'Machine-wise Output', icon: <Cpu className="h-5 w-5" />, color: 'indigo' },
  { value: 'employee', label: 'Employee Reports', icon: <UserCheck className="h-5 w-5" />, color: 'teal', keywords: 'output performance efficiency grade' },
  { value: 'idle-stoppages', label: 'Time Loss & Stoppages', icon: <Wrench className="h-5 w-5" />, color: 'orange', keywords: 'time loss cycle late start bottleneck breakdown M4 stoppage' },
  { value: 'shift-summary', label: 'Shift Summary', icon: <BarChart2 className="h-5 w-5" />, color: 'slate' },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   activeBg: 'bg-blue-600',   activeText: 'text-white' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  activeBg: 'bg-green-600',  activeText: 'text-white' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', activeBg: 'bg-purple-600', activeText: 'text-white' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', activeBg: 'bg-yellow-500', activeText: 'text-white' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', activeBg: 'bg-indigo-600', activeText: 'text-white' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   border: 'border-teal-200',   activeBg: 'bg-teal-600',   activeText: 'text-white' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-600',   border: 'border-rose-200',   activeBg: 'bg-rose-600',   activeText: 'text-white' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', activeBg: 'bg-orange-600', activeText: 'text-white' },
  cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   border: 'border-cyan-200',   activeBg: 'bg-cyan-600',   activeText: 'text-white' },
  slate:  { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200',  activeBg: 'bg-slate-600',  activeText: 'text-white' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    activeBg: 'bg-red-600',    activeText: 'text-white' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  activeBg: 'bg-amber-600',  activeText: 'text-white' },
};

const HOVER_BG_MAP: Record<string, string> = {
  blue: 'hover:bg-blue-50', green: 'hover:bg-green-50', purple: 'hover:bg-purple-50',
  yellow: 'hover:bg-yellow-50', indigo: 'hover:bg-indigo-50', teal: 'hover:bg-teal-50',
  rose: 'hover:bg-rose-50', orange: 'hover:bg-orange-50', cyan: 'hover:bg-cyan-50',
  slate: 'hover:bg-slate-50', red: 'hover:bg-red-50', amber: 'hover:bg-amber-50',
};

const LINE_BADGE: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-800 ring-blue-200', green: 'bg-green-50 text-green-800 ring-green-200',
  purple: 'bg-purple-50 text-purple-800 ring-purple-200', yellow: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-200', teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200', orange: 'bg-orange-50 text-orange-800 ring-orange-200',
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-200', slate: 'bg-slate-50 text-slate-800 ring-slate-200',
  red: 'bg-red-50 text-red-800 ring-red-200', amber: 'bg-amber-50 text-amber-900 ring-amber-200',
};

const fmtDate = (d: string) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmtTime = (d: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
const r = (val: any) => Math.round(val ?? 0);

const effBadge = (val: number) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${val >= 90 ? 'bg-green-100 text-green-700' : val >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
    {val}%
  </span>
);

const formatNetBalanceLabel = (netMins: number) => {
  const parts = minutesToDurationParts(Math.abs(netMins));
  const status = Math.abs(netMins) * 60 < 1 ? 'neutral' : netMins > 0 ? 'gain' : 'loss';
  return { parts, status, text: `${parts.wholeMinutes}m ${parts.seconds}s ${status}` };
};

const netBalanceBadge = (netMins: number) => {
  const { parts, status, text } = formatNetBalanceLabel(netMins);
  const tone =
    status === 'gain'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : status === 'loss'
        ? 'bg-red-100 text-red-800 border-red-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border tabular-nums ${tone}`}>
      {text}
    </span>
  );
};

const HEADER_MAP: Record<string, string> = {
  date: 'Date', line: 'Line', customer: 'Customer', article_no: 'Article No',
  color: 'Color', leather: 'Leather', group: 'Group', total_planned_qty: 'Total Planned',
  total_output: 'Total Output', avg_hourly_output: 'Avg Hourly Output',
  '9_10': '9-10', '10_11': '10-11', '11_12': '11-12', '12_1': '12-1',
  '2_3': '2-3', '3_4': '3-4', '4_5': '4-5', '5_6': '5-6', '6_7': '6-7',
  process: 'Process/Machine',
  total_input: 'Input', input_percent: 'Input %', output_percent: 'Output %',
  line_eol_output: 'EOL Output',
  total_standard_mins_value: 'Std Mins', total_produced_mins_value: 'Actual Mins',
  targeted_output_smv: 'Target @ SMV',
  efficiency_percent: 'Efficiency % (in progress)',
  pace_in_progress_actual: 'Pace actual',
  pace_in_progress_expected: 'Pace target so far',
  pace_daily_target: 'Pace daily target',
  emp_id: 'Emp ID', emp_name: 'Employee Name', emp_code: 'Emp Code', status: 'Status', login_time: 'Login Time',
  machine: 'Machine', output: 'Output', bins_completed: 'Bins', rework_qty: 'Rework',
  rejection_qty: 'Rejection', rework_percent: 'Rework %', rejection_percent: 'Rejection %',
  reason_category: 'Category', reason: 'Reason',
  machine_id: 'Machine ID', machine_name: 'Machine Name', target_mins: 'Target Mins',
  actual_mins: 'Actual Mins', idle_mins: 'Idle Mins', total_output_pairs: 'Output Pairs',
  target: 'EOD target',
  line_plan_target: 'Line plan target',
  line_plan_planned_qty: 'Line plan target',
  wip: 'WIP',
  performance_grade: 'Grade', boxes: 'Box', cycles: 'Cycles', total_output: 'Output',
  routing_mins_per_box: 'Routing Mins/6 prs', shift_target_output: 'Shift Target (pairs)', shift_efficiency_pct: 'Shift Efficiency %',
  line_plan_target: 'Line Plan Target', line_output_percent: 'Line Output %',
  line: 'Line', machine_name: 'Machine Name', emp_name: 'Employee Name',
  start_time: 'Start', finish_time: 'Finish', duration_mins: 'Duration (mins)',
  status: 'Status', m4_category: 'M4 Category', m4_reason: 'Reason', m4_notes: 'Notes', detail: 'Detail',
  net_mins: 'Net balance (mins)', abs_net_mins: 'Abs balance (mins)', net_status: 'Balance',
  time_loss_reason: 'Time loss reason',
};

const parseM4FromDetail = (detail?: string | null) => {
  const text = (detail || '').trim();
  if (!text) return { m4_category: '', m4_reason: '', m4_notes: '' };
  const categories = ['MAN', 'MACHINE', 'MATERIAL', 'METHOD'];
  for (const category of categories) {
    const match = text.match(new RegExp(`^${category}\\s*[-–—:]\\s*(.+)$`, 'i'));
    if (!match) continue;
    const rest = match[1].trim();
    const dashSplit = rest.split(/\s*[-–—]\s*/);
    if (dashSplit.length >= 2) {
      return { m4_category: category, m4_reason: dashSplit[0].trim(), m4_notes: dashSplit.slice(1).join(' — ').trim() };
    }
    return { m4_category: category, m4_reason: rest, m4_notes: '' };
  }
  return { m4_category: '', m4_reason: '', m4_notes: text };
};

const enrichStoppageRow = (row: Record<string, unknown>) => {
  const parsed = parseM4FromDetail(String(row.detail || ''));
  return { ...row, ...parsed };
};

const normalizeReportRows = (rows: any[] | null | undefined, apiType: ApiReportType) => {
  if (!rows) return [];
  if (apiType === 'bottleneck' || apiType === 'breakdown') {
    return rows.map((row) => enrichStoppageRow(row));
  }
  return rows;
};

const FILTER_STORAGE_KEY = 'reports_filters_v1';

/** Shown only on Hourly Production report (table + export). */
const HOURLY_ONLY_FIELDS = ['total_input', 'input_percent'] as const;

const EXPORT_OMIT_BY_REPORT: Partial<Record<ApiReportType, readonly string[]>> = {
  'shift-summary': ['shift_idle_mins'],
  attendance: ['target', 'output_percent'],
};

const INTERNAL_EXPORT_OMIT = [
  'work_centre_id',
  'machine_id',
  'pace_in_progress_actual',
  'pace_in_progress_expected',
  'pace_daily_target',
  'line_plan_target',
  'line_plan_planned_qty',
] as const;

/** Column labels for table, mobile cards, and export — hourly keeps "Planned"/"Total Planned". */
const reportColumnLabel = (fieldKey: string, apiReport: ApiReportType): string => {
  if (fieldKey === 'total_planned_qty') {
    return apiReport === 'hourly-production' ? 'Total Planned' : 'EOD target';
  }
  if (fieldKey === 'target' && apiReport !== 'hourly-production') {
    return 'EOD target';
  }
  return HEADER_MAP[fieldKey] || fieldKey;
};

const stripExportFields = (row: Record<string, unknown>, apiReport: ApiReportType) => {
  const out = { ...row };
  for (const key of INTERNAL_EXPORT_OMIT) delete out[key];
  if (apiReport !== 'hourly-production') {
    for (const key of HOURLY_ONLY_FIELDS) delete out[key];
  }
  const omit = EXPORT_OMIT_BY_REPORT[apiReport];
  if (omit) {
    for (const key of omit) delete out[key];
  }
  return out;
};

type DatePreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom';

const formatDateInput = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPresetRange = (preset: DatePreset) => {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (preset === 'last7') {
    start.setDate(start.getDate() - 6);
  } else if (preset === 'thisMonth') {
    start.setDate(1);
  }

  return { from: formatDateInput(start), to: formatDateInput(end) };
};

export const Reports: React.FC = () => {
  const defaultRange = getPresetRange('today');
  const [fromDate, setFromDate] = React.useState(defaultRange.from);
  const [toDate, setToDate] = React.useState(defaultRange.to);
  const [datePreset, setDatePreset] = React.useState<DatePreset>('today');
  const [reportType, setReportType] = React.useState<ReportType>('hourly-production');
  const [reportSubView, setReportSubView] = React.useState<ReportSubView>(() => defaultSubViewFor('hourly-production'));
  const apiReportType = React.useMemo(
    () => resolveApiReportType(reportType, reportSubView),
    [reportType, reportSubView]
  );
  const [workCentres, setWorkCentres] = React.useState<any[]>([]);
  const [machines, setMachines] = React.useState<any[]>([]);
  const [selectedLine, setSelectedLine] = React.useState('');
  const [selectedMachine, setSelectedMachine] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [data, setData] = React.useState<any[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExportLoading, setIsExportLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [lastReportGeneratedAt, setLastReportGeneratedAt] = React.useState<Date | null>(null);
  const [isShareLoading, setIsShareLoading] = React.useState(false);
  const [reportTypeQuery, setReportTypeQuery] = React.useState('');
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const reportTableRef = React.useRef<HTMLDivElement>(null);
  const generatedFilterSnapshotRef = React.useRef<string | null>(null);
  const currentFilterSnapshot = React.useMemo(() => JSON.stringify({
    fromDate,
    toDate,
    reportType,
    reportSubView,
    selectedLine,
    selectedMachine,
    search: search.trim(),
    limit,
    datePreset,
  }), [fromDate, toDate, reportType, reportSubView, selectedLine, selectedMachine, search, limit, datePreset]);
  const hasUnsavedReportFilterChanges = React.useMemo(() => {
    if (!data || data.length === 0) return false;
    if (!generatedFilterSnapshotRef.current) return false;
    return generatedFilterSnapshotRef.current !== currentFilterSnapshot;
  }, [data, currentFilterSnapshot]);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlReportType = params.get('reportType');
      const urlSubView = params.get('subView');
      const urlFromDate = params.get('fromDate');
      const urlToDate = params.get('toDate');
      const urlSelectedLine = params.get('workCentreId');
      const urlSelectedMachine = params.get('machineId');
      const urlSearch = params.get('search');
      const urlLimit = params.get('limit');
      const urlPreset = params.get('datePreset') as DatePreset | null;

      if (urlReportType) {
        const migrated = migrateReportTab(urlReportType);
        setReportType(migrated.tab);
        const subViews = REPORT_SUB_VIEWS[migrated.tab];
        const validSub = urlSubView && subViews?.some((s) => s.value === urlSubView) ? urlSubView : migrated.subView;
        setReportSubView(validSub);
      }
      if (urlFromDate) setFromDate(urlFromDate);
      if (urlToDate) setToDate(urlToDate);
      if (urlSelectedLine) setSelectedLine(urlSelectedLine);
      if (urlSelectedMachine) setSelectedMachine(urlSelectedMachine);
      if (urlSearch) setSearch(urlSearch);
      if (urlLimit && !Number.isNaN(Number(urlLimit))) setLimit(Number(urlLimit));
      if (urlPreset) setDatePreset(urlPreset);

      // If URL has report params, treat it as source-of-truth and skip localStorage restore.
      if (urlReportType || urlFromDate || urlToDate || urlSelectedLine || urlSelectedMachine || urlSearch) return;

      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.reportType) {
        const migrated = migrateReportTab(saved.reportType);
        setReportType(migrated.tab);
        setReportSubView(saved.reportSubView && REPORT_SUB_VIEWS[migrated.tab]?.some((s) => s.value === saved.reportSubView)
          ? saved.reportSubView
          : migrated.subView);
      }
      if (saved.fromDate) setFromDate(saved.fromDate);
      if (saved.toDate) setToDate(saved.toDate);
      if (saved.selectedLine) setSelectedLine(saved.selectedLine);
      if (saved.selectedMachine) setSelectedMachine(saved.selectedMachine);
      if (saved.search) setSearch(saved.search);
      if (saved.limit) setLimit(saved.limit);
      if (saved.datePreset) setDatePreset(saved.datePreset);
    } catch {
      // ignore invalid stored state
    }
  }, []);

  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        fromDate,
        toDate,
        reportType,
        reportSubView,
        selectedLine,
        selectedMachine,
        search,
        limit,
        datePreset,
      })
    );

    const params = new URLSearchParams();
    params.set('reportType', reportType);
    if (REPORT_SUB_VIEWS[reportType]) params.set('subView', reportSubView);
    params.set('fromDate', fromDate);
    params.set('toDate', toDate);
    if (selectedLine) params.set('workCentreId', selectedLine);
    if (selectedMachine && reportType === 'hourly-production') params.set('machineId', selectedMachine);
    if (search.trim()) params.set('search', search.trim());
    params.set('limit', String(limit));
    params.set('datePreset', datePreset);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, [fromDate, toDate, reportType, reportSubView, selectedLine, selectedMachine, search, limit, datePreset]);

  React.useEffect(() => {
    if (!hasUnsavedReportFilterChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedReportFilterChanges]);

  React.useEffect(() => {
    apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`)
      .then(r => r.json())
      .then(res => { if (res.success) setWorkCentres(res.data); })
      .catch(() => {});

    apiFetch(`${API_BASE}/api/masters/machine_centres`)
      .then(r => r.json())
      .then(res => { if (res.success) setMachines(res.data); })
      .catch(() => {});
  }, []);

  const filteredMachines = React.useMemo(() => {
    const list = selectedLine
      ? machines.filter((m: any) => String(m.work_centre_id) === String(selectedLine))
      : machines;
    return [...list].sort((a: any, b: any) => String(a.machine_id || '').localeCompare(String(b.machine_id || '')));
  }, [machines, selectedLine]);

  React.useEffect(() => {
    if (!selectedMachine) return;
    const stillExists = filteredMachines.some((m: any) => String(m.machine_id) === String(selectedMachine));
    if (!stillExists) setSelectedMachine('');
  }, [filteredMachines, selectedMachine]);

  const validateDateRange = React.useCallback(() => {
    if (!fromDate || !toDate) {
      setDateError('Please select both From Date and To Date.');
      return false;
    }
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) {
      setDateError('From Date cannot be after To Date.');
      return false;
    }
    setDateError(null);
    return true;
  }, [fromDate, toDate]);

  React.useEffect(() => {
    validateDateRange();
  }, [fromDate, toDate, validateDateRange]);

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const range = getPresetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setPage(1);
  };

  const clearAllFilters = () => {
    const todayRange = getPresetRange('today');
    setDatePreset('today');
    setFromDate(todayRange.from);
    setToDate(todayRange.to);
    setSelectedLine('');
    setSelectedMachine('');
    setSearch('');
    setPage(1);
    setError(null);
    setData(null);
  };

  const buildReportParams = React.useCallback((opts?: { page?: number; limit?: number; search?: string }) => {
    const params = new URLSearchParams({
      fromDate,
      toDate,
      page: String(opts?.page ?? page),
      limit: String(opts?.limit ?? limit),
    });
    if (selectedLine) params.set('workCentreId', selectedLine);
    if (reportType === 'hourly-production' && selectedMachine) params.set('machineId', selectedMachine);
    const s = opts?.search !== undefined ? opts.search : search;
    if (s.trim()) params.set('search', s.trim());
    return params;
  }, [fromDate, toDate, page, limit, selectedLine, reportType, selectedMachine, search]);

  const fetchReport = async (overridePage?: number, overrideSearch?: string) => {
    if (!validateDateRange()) return;
    setIsLoading(true); setError(null);
    const currentPage = overridePage ?? page;
    const currentSearch = overrideSearch !== undefined ? overrideSearch : search;
    try {
      const params = buildReportParams({ page: currentPage, search: currentSearch });
      const response = await apiFetch(`${API_BASE}/api/reports/${apiReportType}?${params}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setData(normalizeReportRows(result.data, apiReportType));
      setLastReportGeneratedAt(new Date());
      generatedFilterSnapshotRef.current = JSON.stringify({
        fromDate,
        toDate,
        reportType,
        reportSubView,
        selectedLine,
        selectedMachine,
        search: currentSearch.trim(),
        limit,
        datePreset,
      });
      if (result.pagination) setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchReport(newPage, search);
  };

  const handleLimitChange = (newLimit: number) => {
    if (!validateDateRange()) return;
    setLimit(newLimit);
    setPage(1);
    const params = buildReportParams({ page: 1, limit: newLimit });
    setIsLoading(true); setError(null);
    apiFetch(`${API_BASE}/api/reports/${apiReportType}?${params}`)
      .then(r => r.json())
      .then(result => {
        if (!result.success) throw new Error(result.error);
        setData(normalizeReportRows(result.data, apiReportType));
        setLastReportGeneratedAt(new Date());
        generatedFilterSnapshotRef.current = JSON.stringify({
          fromDate,
          toDate,
          reportType,
          reportSubView,
          selectedLine,
          selectedMachine,
          search: search.trim(),
          limit: newLimit,
          datePreset,
        });
        if (result.pagination) setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setIsLoading(false));
  };

  const fetchAllRowsForExport = async () => {
    const exportLimit = 500;
    const firstParams = buildReportParams({ page: 1, limit: exportLimit });
    const firstRes = await apiFetch(`${API_BASE}/api/reports/${apiReportType}?${firstParams}`);
    const first = await firstRes.json();
    if (!first.success) throw new Error(first.error || 'Failed to load report for export');
    let allRows = [...(first.data || [])];
    const totalPages = first.pagination?.totalPages || 1;
    for (let p = 2; p <= totalPages; p++) {
      const params = buildReportParams({ page: p, limit: exportLimit });
      const res = await apiFetch(`${API_BASE}/api/reports/${apiReportType}?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || `Failed on export page ${p}`);
      allRows = allRows.concat(json.data || []);
    }
    return {
      rows: normalizeReportRows(allRows, apiReportType),
      total: first.pagination?.total || allRows.length,
    };
  };

  const exportCSV = async () => {
    setIsExportLoading(true);
    try {
      const { rows } = await fetchAllRowsForExport();
      if (!rows || rows.length === 0) {
        toast.error('No data to export');
        return;
      }
      const headers = Object.keys(stripExportFields(rows[0], apiReportType));
    const csvRows = [
      headers.map(h => `"${reportColumnLabel(h, apiReportType)}"`).join(','),
      ...rows.map(row => {
        const filtered = stripExportFields(row, apiReportType);
        return headers.map(h => {
          const v = filtered[h] === null || filtered[h] === undefined ? '' : String(filtered[h]);
          return `"${v.replace(/"/g, '""')}"`;
        }).join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${apiReportType}_${fromDate}_${toDate}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setIsExportLoading(false);
    }
  };

  const exportExcel = async () => {
    setIsExportLoading(true);
    try {
      const { rows: exportRows } = await fetchAllRowsForExport();
      if (!exportRows || exportRows.length === 0) {
        toast.error('No data to export');
        return;
      }
      const headers = Object.keys(stripExportFields(exportRows[0], apiReportType));
      const rows = exportRows.map((row) => {
      const filtered = stripExportFields(row, apiReportType);
      const mapped: Record<string, any> = {};
      headers.forEach((h) => {
        mapped[reportColumnLabel(h, apiReportType)] = filtered[h];
      });
      return mapped;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${apiReportType}_${fromDate}_${toDate}.xlsx`);
    toast.success('Excel downloaded');
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setIsExportLoading(false);
    }
  };

  const exportPDF = async () => {
    setIsExportLoading(true);
    try {
      const { rows: exportRows } = await fetchAllRowsForExport();
      if (!exportRows || exportRows.length === 0) {
        toast.error('No data to export');
        return;
      }
      const headers = Object.keys(stripExportFields(exportRows[0], apiReportType));
    const subLabel = REPORT_SUB_VIEWS[reportType]?.find((s) => s.value === reportSubView)?.label;
    const title = `${activeOption.label}${subLabel ? ` — ${subLabel}` : ''} (${fmtDate(fromDate)} - ${fmtDate(toDate)})`;
    const tableHead = headers.map(h => `<th style="border:1px solid #ddd;padding:6px;text-align:left;font-size:11px;">${reportColumnLabel(h, apiReportType)}</th>`).join('');
    const tableRows = exportRows.map((row) => {
      const filtered = stripExportFields(row, apiReportType);
      return `<tr>${headers.map(h => `<td style="border:1px solid #ddd;padding:6px;font-size:10px;">${String(filtered[h] ?? '')}</td>`).join('')}</tr>`;
    }).join('');

    const html = `
      <html>
      <head><title>${title}</title></head>
      <body style="font-family:Arial, sans-serif; padding:16px;">
        <h2 style="margin-bottom:4px;">${title}</h2>
        <p style="color:#666; margin-top:0;">Generated at ${new Date().toLocaleString()}</p>
        <table style="border-collapse:collapse; width:100%;">
          <thead><tr style="background:#f3f4f6;">${tableHead}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setIsExportLoading(false);
    }
  };

  const shareViaWhatsApp = async () => {
    if (!reportTableRef.current) return;
    setIsShareLoading(true);
    try {
      const canvas = await html2canvas(reportTableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const dateLabel = fromDate === toDate ? fmtDate(fromDate) : `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;
      const lineName = selectedLine && workCentres.length > 0
        ? workCentres.find((w: any) => String(w.id) === String(selectedLine))?.name || 'All Lines'
        : 'All Lines';
      const rowCount = pagination.total || (data?.length ?? 0);
      const viewSuffix = activeSubViewLabel ? ` (${activeSubViewLabel})` : '';
      const messageText =
        `📊 *${activeOption.label}${viewSuffix} Report*\n` +
        `📅 Date: ${dateLabel}\n` +
        `🏭 Line: ${lineName}\n` +
        `📋 Records: ${rowCount}\n` +
        `🕐 Generated: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

      // Try Web Share API first (works on mobile — opens native share sheet with image)
      if (navigator.canShare) {
        canvas.toBlob(async (blob) => {
          if (!blob) { toast.error('Failed to create image'); setIsShareLoading(false); return; }
          const file = new File([blob], `${activeOption.label.replace(/\s+/g, '_')}_${fromDate}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], text: messageText });
              setIsShareLoading(false);
              return;
            } catch (err: any) {
              // User cancelled share — don't fall through to download
              if (err?.name === 'AbortError') { setIsShareLoading(false); return; }
            }
          }
          // canShare exists but files not supported — fall through to download
          fallbackDownloadAndOpen(canvas, messageText);
        }, 'image/png');
      } else {
        // Desktop or unsupported browser — download image + open WhatsApp with text
        fallbackDownloadAndOpen(canvas, messageText);
      }
    } catch {
      toast.error('Failed to capture screenshot');
      setIsShareLoading(false);
    }
  };

  const fallbackDownloadAndOpen = (canvas: HTMLCanvasElement, messageText: string) => {
    const link = document.createElement('a');
    link.download = `${activeOption.label.replace(/\s+/g, '_')}_${fromDate}_${toDate}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-gray-800">📸 Screenshot downloaded!</p>
          <p className="text-sm text-gray-600">Open WhatsApp, start a chat, tap the attachment icon and select the downloaded image.</p>
          <button
            onClick={() => {
              window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, '_blank');
              toast.dismiss(t.id);
            }}
            className="mt-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg"
          >
            Open WhatsApp
          </button>
        </div>
      ),
      { duration: 12000 }
    );
    setIsShareLoading(false);
  };

  const activeOption = REPORT_OPTIONS.find(o => o.value === reportType)!;
  const activeColor = COLOR_MAP[activeOption.color];
  const lineBadgeClass = LINE_BADGE[activeOption.color] || LINE_BADGE.slate;

  const activeSubViewLabel = REPORT_SUB_VIEWS[reportType]?.find((s) => s.value === reportSubView)?.label;

  const selectReportTab = (tab: ReportType) => {
    setReportType(tab);
    setReportSubView(defaultSubViewFor(tab));
    setData(null);
    setError(null);
    setPage(1);
    setSearch('');
  };

  const selectReportSubView = (sub: ReportSubView) => {
    setReportSubView(sub);
    setData(null);
    setError(null);
    setPage(1);
  };

  const filteredReportOptions = React.useMemo(() => {
    const q = reportTypeQuery.trim().toLowerCase();
    if (!q) return REPORT_OPTIONS;
    return REPORT_OPTIONS.filter((o) => {
      const hay = `${o.label} ${o.keywords || ''}`.toLowerCase();
      if (hay.includes(q)) return true;
      const subs = REPORT_SUB_VIEWS[o.value];
      return subs?.some((s) => s.label.toLowerCase().includes(q)) ?? false;
    });
  }, [reportTypeQuery]);

  const reportSummaryStats = React.useMemo(() => {
    if (!data?.length) return [];
    const sum = (key: string) => data.reduce((s, row) => s + (Number(row[key]) || 0), 0);
    const avg = (key: string) => Math.round(data.reduce((s, row) => s + (parseFloat(row[key]) || 0), 0) / data.length);
    switch (apiReportType) {
      case 'hourly-production':
        return [
          { label: 'Total output', value: sum('total_output') },
          { label: 'Total planned', value: sum('total_planned_qty') },
          { label: 'WIP', value: sum('wip') },
        ];
      case 'line-efficiency':
        return [
          { label: 'Rows', value: data.length },
          { label: 'Avg efficiency', value: `${avg('efficiency_percent')}%` },
          { label: 'Total output', value: sum('total_output') },
        ];
      case 'attendance': {
        const present = data.filter((r) => r.status === 'Present').length;
        return [
          { label: 'Present', value: present },
          { label: 'Absent', value: data.length - present },
          { label: 'Attendance rate', value: `${Math.round((present / data.length) * 100)}%` },
        ];
      }
      case 'rework-rejection':
        return [
          { label: 'Rework qty', value: sum('rework_qty') },
          { label: 'Rejection qty', value: sum('rejection_qty') },
          { label: 'Output', value: sum('output') },
        ];
      case 'machine-output':
        return [
          { label: 'Total output', value: sum('output') },
          { label: 'Avg efficiency', value: `${avg('efficiency_percent')}%` },
          { label: 'Machines', value: data.length },
        ];
      case 'employee-output':
        return [{ label: 'Total output', value: sum('total_output') }, { label: 'Employees', value: data.length }];
      case 'employee-performance':
        return [
          { label: 'Total output', value: sum('output') },
          { label: 'Avg efficiency', value: `${avg('efficiency_percent')}%` },
          { label: 'Records', value: data.length },
        ];
      case 'attendance-production':
        return [
          { label: 'Sessions', value: data.length },
          { label: 'Zero output', value: data.filter((row) => Number(row.total_output) === 0).length },
          { label: 'Total output', value: sum('total_output') },
        ];
      case 'time-loss': {
        const netTotal = Math.round(data.reduce((s, row) => s + Number(row.net_mins || 0), 0) * 100) / 100;
        const lossRows = data.filter((row) => row.net_status === 'loss').length;
        return [
          { label: 'Machines', value: data.length },
          { label: 'With time loss', value: lossRows },
          { label: 'Net balance', value: `${netTotal}m` },
        ];
      }
      case 'shift-summary':
        return [
          { label: 'Total output', value: sum('total_output') },
          { label: 'Cycles', value: sum('cycles') },
          { label: 'Avg shift eff.', value: `${avg('shift_efficiency_pct')}%` },
        ];
      case 'bottleneck':
      case 'breakdown':
        return [
          { label: 'Events', value: data.length },
          { label: 'Total duration', value: `${sum('duration_mins')}m` },
          { label: 'In progress', value: data.filter((r) => r.status === 'In progress').length },
        ];
      default:
        return [{ label: 'Rows on page', value: data.length }];
    }
  }, [data, apiReportType]);

  const LineBadge = ({ name }: { name: string }) => (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset ${lineBadgeClass}`}>{name}</span>
  );

  const Th = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
    <th className={`px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-sm ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
  const Td = ({ children, center, muted }: { children: React.ReactNode; center?: boolean; muted?: boolean }) => (
    <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${center ? 'text-center' : ''} ${muted ? 'text-slate-400' : 'text-slate-700'}`}>{children}</td>
  );
  const TableWrap = ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-x-auto scroll-smooth [scrollbar-width:thin]">{children}</div>
  );

  const renderReportKpis = () => {
    if (!reportSummaryStats.length) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        {reportSummaryStats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className={`text-lg font-bold tabular-nums ${activeColor.text}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const activeFilterChips = React.useMemo(() => {
    const chips: string[] = [];
    if (selectedLine) {
      chips.push(`Line: ${workCentres.find((w) => String(w.id) === String(selectedLine))?.name || selectedLine}`);
    }
    if (reportType === 'hourly-production') {
      chips.push(selectedMachine ? `Machine: ${selectedMachine}` : 'Machine: End-of-line (07)');
    }
    if (search.trim()) chips.push(`Search: ${search.trim()}`);
    return chips;
  }, [selectedLine, selectedMachine, search, reportType, workCentres]);

  const renderMobileCards = () => {
    if (!data || data.length === 0) return null;
    const columnsByType: Partial<Record<ApiReportType, string[]>> = {
      'hourly-production': ['date', 'line', 'customer', 'total_planned_qty', 'total_input', 'input_percent', 'total_output', 'output_percent'],
      'line-efficiency': ['date', 'line', 'process', 'total_planned_qty', 'total_output', 'output_percent', 'efficiency_percent'],
      'attendance': ['date', 'line', 'emp_code', 'emp_name', 'status', 'login_time'],
      'rework-rejection': ['date', 'line', 'machine', 'target', 'output', 'output_percent', 'rework_qty', 'rejection_qty'],
      'machine-output': ['date', 'line', 'machine_id', 'target', 'output', 'output_percent', 'efficiency_percent'],
      'employee-output': ['date', 'line', 'emp_code', 'target', 'total_output', 'output_percent'],
      'employee-performance': ['date', 'line', 'emp_code', 'target', 'output', 'output_percent', 'efficiency_percent'],
      bottleneck: ['date', 'line', 'machine_id', 'emp_id', 'status', 'duration_mins', 'm4_category', 'm4_reason'],
      breakdown: ['date', 'line', 'machine_id', 'emp_id', 'status', 'duration_mins', 'm4_category', 'm4_reason'],
      'time-loss': ['date', 'line', 'machine_id', 'machine_name', 'net_mins', 'net_status', 'time_loss_reason'],
      'attendance-production': ['date', 'emp_code', 'work_centre_name', 'target', 'output_percent', 'total_output', 'status'],
      'shift-summary': ['date', 'machine_id', 'shift_target_output', 'total_output', 'shift_efficiency_pct'],
    };
    const keys = columnsByType[apiReportType] || Object.keys(data[0] || {}).slice(0, 8);
    return (
      <div className="space-y-3 p-3">
        {data.map((row, i) => (
          <div
            key={i}
            className={`rounded-xl border bg-white shadow-sm overflow-hidden border-l-4 ${activeColor.border}`}
          >
            <div className={`px-3 py-2 flex items-center justify-between gap-2 ${activeColor.bg}`}>
              <span className={`text-xs font-bold ${activeColor.text}`}>{fmtDate(row.date) || '—'}</span>
              {(row.line || row.work_centre_name) && (
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[55%]">
                  {row.line || row.work_centre_name}
                </span>
              )}
            </div>
            <div className="p-3 space-y-0">
              {keys.filter((k) => k !== 'date' && k !== 'line' && k !== 'work_centre_name').map((key) => {
                let value: any = row[key];
                if (key === 'login_time') value = fmtTime(value);
                if (key === 'input_percent' || key === 'output_percent' || key === 'shift_efficiency_pct') {
                  value = key === 'shift_efficiency_pct' ? effBadge(r(value)) : `${r(value)}%`;
                }
                if (key === 'efficiency_percent') value = effBadge(r(value));
              if (key === 'net_mins') value = netBalanceBadge(Number(value));
              if (key === 'net_status') value = String(value);
                if (key === 'status' && value === 'Present') value = <span className="text-green-700 font-semibold">Present</span>;
                if (key === 'status' && value === 'Absent') value = <span className="text-red-600 font-semibold">Absent</span>;
                if (value === null || value === undefined || value === '') value = '—';
                return (
                  <div key={key} className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
                    <span className="text-xs font-semibold text-slate-500">{reportColumnLabel(key, apiReportType)}</span>
                    <span className="text-sm font-medium text-slate-800 text-right">{typeof value === 'object' ? value : String(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStoppageReport = (accent: 'red' | 'amber') => {
    const rows = data!;
    const totalMins = rows.reduce((s, row) => s + Number(row.duration_mins || 0), 0);
    const inProgress = rows.filter((row) => row.status === 'In progress').length;
    const statusClass =
      accent === 'red'
        ? { active: 'bg-red-100 text-red-700', resolved: 'bg-gray-100 text-gray-700' }
        : { active: 'bg-amber-100 text-amber-800', resolved: 'bg-gray-100 text-gray-700' };
    const m4Class: Record<string, string> = {
      MAN: 'bg-blue-100 text-blue-800',
      MACHINE: 'bg-violet-100 text-violet-800',
      MATERIAL: 'bg-emerald-100 text-emerald-800',
      METHOD: 'bg-indigo-100 text-indigo-800',
    };
    const footBg = accent === 'red' ? 'bg-red-600' : 'bg-amber-600';
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead>
            <tr>
              {['Date', 'Line', 'Machine', 'Operator', 'Start', 'Finish', 'Duration', 'Status', 'M4 Category', 'Reason', 'Notes'].map((h) => (
                <Th key={h} center={h === 'Duration'}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row: any, i: number) => (
              <tr key={row.id ?? i} className={`transition-colors even:bg-slate-50/50 ${accent === 'red' ? 'hover:bg-red-50/40' : 'hover:bg-amber-50/40'}`}>
                <Td><span className="font-medium text-slate-600">{row.date ? fmtDate(row.date) : '—'}</span></Td>
                <Td>{row.line ? <LineBadge name={row.line} /> : '—'}</Td>
                <Td>
                  <span className="font-medium">{row.machine_id}</span>
                  {row.machine_name ? <span className="text-slate-500 text-xs block">{row.machine_name}</span> : null}
                </Td>
                <Td>
                  <span className="font-mono text-xs">{row.emp_id}</span>
                  {row.emp_name ? <span className="text-slate-600 block">{row.emp_name}</span> : null}
                </Td>
                <Td>{fmtTime(row.start_time || row.idle_start_time)}</Td>
                <Td>
                  {row.status === 'In progress' ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass.active}`}>In progress</span>
                  ) : (
                    fmtTime(row.finish_time)
                  )}
                </Td>
                <Td center><span className="font-semibold">{row.duration_mins != null ? `${row.duration_mins}m` : '—'}</span></Td>
                <Td>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.status === 'In progress' ? statusClass.active : statusClass.resolved}`}>
                    {row.status}
                  </span>
                </Td>
                <Td>
                  {row.m4_category ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${m4Class[row.m4_category] || 'bg-gray-100 text-gray-700'}`}>
                      {row.m4_category}
                    </span>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>{row.m4_reason || '—'}</Td>
                <Td muted>{row.m4_notes || '—'}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={`${footBg} text-white`}>
              <td colSpan={6} className="px-3 py-2.5 text-sm font-bold">
                {rows.length} events{inProgress > 0 ? ` · ${inProgress} in progress` : ''}
              </td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalMins}m</td>
              <td colSpan={4} className="px-3 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderTimeLoss = () => {
    const netTotal = data!.reduce((s, row) => s + Number(row.net_mins || 0), 0);
    const { text: netTotalLabel } = formatNetBalanceLabel(netTotal);
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead>
            <tr>
              {['Date', 'Line', 'Machine ID', 'Machine', 'Net balance', 'Reason'].map((h) => (
                <Th key={h} center={h === 'Net balance'}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row: any, i: number) => {
              const net = Number(row.net_mins || 0);
              const rowTone = net > 0 ? 'hover:bg-emerald-50/40' : net < 0 ? 'hover:bg-red-50/30' : 'hover:bg-orange-50/20';
              return (
                <tr key={`${row.date}-${row.machine_id}-${i}`} className={`${rowTone} even:bg-slate-50/40 transition-colors`}>
                  <Td><span className="font-medium text-slate-600">{row.date ? fmtDate(row.date) : '—'}</span></Td>
                  <Td>{row.line ? <LineBadge name={row.line} /> : '—'}</Td>
                  <Td center><span className="font-mono font-semibold text-slate-600">{row.machine_id}</span></Td>
                  <Td><span className="font-medium">{row.machine_name || '—'}</span></Td>
                  <Td center>{netBalanceBadge(net)}</Td>
                  <Td muted>{row.time_loss_reason?.trim() ? row.time_loss_reason : '—'}</Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-orange-600 text-white">
              <td colSpan={4} className="px-3 py-2.5 text-sm font-bold">{data!.length} machine-days</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center tabular-nums">{netTotalLabel}</td>
              <td className="px-3 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderAttendanceProduction = () => {
    const zeroCount = data!.filter((row) => Number(row.total_output) === 0).length;
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead>
            <tr>
              {['Date', 'Employee', 'Line', 'EOD target', 'Output %', 'Session Start', 'Session End', 'Session Mins', 'Cycles', 'Active Mins', 'Output', 'Status'].map((h) => (
                <Th key={h} center={h === 'EOD target' || h === 'Output %'}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row: any, i: number) => {
              const isZero = Number(row.total_output) === 0;
              return (
                <tr key={i} className={`transition-colors even:bg-slate-50/40 ${isZero ? 'bg-red-50/80 hover:bg-red-50' : 'hover:bg-cyan-50/30'}`}>
                  <Td><span className="font-medium text-slate-600">{row.date ? fmtDate(row.date) : '—'}</span></Td>
                  <Td>
                    <span className="font-mono text-xs">{row.emp_code}</span>
                    {row.employee_name ? <span className="block font-medium">{row.employee_name}</span> : null}
                  </Td>
                  <Td>{row.work_centre_name ? <LineBadge name={row.work_centre_name} /> : '—'}</Td>
                  <Td center>{r(row.target)}</Td>
                  <Td center>{effBadge(r(row.output_percent))}</Td>
                  <Td>{row.session_start ? new Date(row.session_start).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '—'}</Td>
                  <Td>
                    {row.session_end
                      ? new Date(row.session_end).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' })
                      : <span className="text-emerald-600 text-xs font-semibold">Active</span>}
                  </Td>
                  <Td>{row.session_mins != null ? `${row.session_mins}m` : '—'}</Td>
                  <Td center>{row.cycles_completed ?? '—'}</Td>
                  <Td>{row.active_mins != null ? `${row.active_mins}m` : '—'}</Td>
                  <Td><span className="font-bold text-slate-800">{row.total_output}</span></Td>
                  <Td>
                    {isZero
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Zero output</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">OK</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-cyan-600 text-white">
              <td colSpan={10} className="px-3 py-2.5 text-sm font-bold">
                {data!.length} sessions{zeroCount > 0 ? ` · ${zeroCount} zero output` : ''}
              </td>
              <td className="px-3 py-2.5 text-sm font-bold">{data!.reduce((s, row) => s + Number(row.total_output || 0), 0)}</td>
              <td className="px-3 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderShiftSummary = () => (
    <TableWrap>
      <table className="min-w-full">
        <thead>
          <tr>
            {['Date', 'Machine', 'Employee', 'Line', 'Shift target', 'Cycles', 'Box', 'Output', 'Active Mins', 'Utilisation', 'Shift Efficiency'].map((h) => (
              <Th key={h} center={h === 'Shift target' || h === 'Box' || h === 'Utilisation' || h === 'Shift Efficiency'}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data!.map((row: any, i: number) => (
            <tr key={i} className="hover:bg-slate-50/80 even:bg-slate-50/40 transition-colors">
              <Td><span className="font-medium text-slate-600">{row.date ? fmtDate(row.date) : '—'}</span></Td>
              <Td>
                <span className="font-medium">{row.machine_id}</span>
                {row.machine_name ? <span className="text-xs text-slate-500 block">{row.machine_name}</span> : null}
              </Td>
              <Td>
                <span className="font-mono text-xs">{row.emp_id}</span>
                {row.employee_name ? <span className="block">{row.employee_name}</span> : null}
              </Td>
              <Td>{row.work_centre_name ? <LineBadge name={row.work_centre_name} /> : '—'}</Td>
              <Td center title={row.routing_mins_per_box ? `Routing: ${row.routing_mins_per_box} min / 6 prs` : 'No routing'}>
                {row.shift_target_output != null && Number(row.shift_target_output) > 0 ? r(row.shift_target_output) : '—'}
              </Td>
              <Td center>{row.cycles ?? '—'}</Td>
              <Td center>
                <span className="font-semibold">
                  {row.boxes != null ? row.boxes : (Number(row.total_output || 0) > 0 ? Math.round(Number(row.total_output) / 6) : 0)}
                </span>
              </Td>
              <Td><span className="font-bold">{row.total_output}</span></Td>
              <Td>{row.shift_actual_mins != null ? `${row.shift_actual_mins}m` : '—'}</Td>
              <Td center>{effBadge(r(row.shift_utilisation_pct))}</Td>
              <Td center>{effBadge(r(row.shift_efficiency_pct))}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-700 text-white">
            <td colSpan={5} className="px-3 py-2.5 text-xs sm:text-sm font-bold">
              Totals · Shift 09:05–17:35 (480 min excl. lunch)
            </td>
            <td className="px-3 py-2.5 text-sm font-bold text-center">{data!.reduce((s: number, r: any) => s + Number(r.cycles || 0), 0)}</td>
            <td className="px-3 py-2.5 text-sm font-bold text-center">
              {data!.reduce((s: number, r: any) => s + Number(r.boxes ?? (Number(r.total_output || 0) > 0 ? Math.round(Number(r.total_output) / 6) : 0)), 0)}
            </td>
            <td className="px-3 py-2.5 text-sm font-bold">{data!.reduce((s: number, r: any) => s + Number(r.total_output || 0), 0)}</td>
            <td className="px-3 py-2.5 text-sm font-bold">{data!.reduce((s: number, r: any) => s + Number(r.shift_actual_mins || 0), 0)}m</td>
            <td colSpan={2} className="px-3 py-2.5" />
          </tr>
        </tfoot>
      </table>
    </TableWrap>
  );

  const renderTable = () => {
    if (!data || data.length === 0) return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="p-4 rounded-full bg-slate-100 mb-4">
          <Search className="h-10 w-10 text-slate-300" />
        </div>
        <p className="text-lg font-semibold text-slate-600">No rows match your filters</p>
        <p className="text-sm text-slate-400 mt-2 max-w-xs">Try a wider date range, another line, or clear the search box.</p>
        <button type="button" onClick={clearAllFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800">
          Reset all filters
        </button>
      </div>
    );
    switch (apiReportType) {
      case 'hourly-production':    return renderHourly();
      case 'line-efficiency':      return renderLineEfficiency();
      case 'attendance':           return renderAttendance();
      case 'rework-rejection':     return renderRework();
      case 'machine-output':       return renderMachineOutput();
      case 'employee-output':      return renderEmployeeOutput();
      case 'employee-performance': return renderEmployeePerformance();
      case 'time-loss':            return renderTimeLoss();
      case 'attendance-production':return renderAttendanceProduction();
      case 'shift-summary':        return renderShiftSummary();
      case 'bottleneck':           return renderStoppageReport('red');
      case 'breakdown':            return renderStoppageReport('amber');
    }
  };

  const renderHourly = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.total_output), 0);
    const totalPlanned = data!.reduce((s, row) => s + r(row.total_planned_qty), 0);
    const totalInput = data!.reduce((s, row) => s + r(row.total_input), 0);
    const totalWip = data!.reduce((s, row) => s + r(row.wip), 0);
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {['Date','Line','Customer','Article No','Color','Leather','Group','Planned','Input','Input %','Output','Output %','WIP','Avg/Hr','9-10','10-11','11-12','12-1','2-3','3-4','4-5','5-6','6-7'].map(h => <Th key={h} center={!['Date','Line','Customer','Article No','Color','Leather','Group'].includes(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => {
              const wip = r(row.wip);
              return (
                <tr key={i} className="hover:bg-blue-50/30 even:bg-slate-50/30 transition-colors">
                  <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                  <Td><LineBadge name={row.line} /></Td>
                  <Td>{row.customer}</Td><Td>{row.article_no}</Td><Td>{row.color}</Td><Td>{row.leather}</Td><Td>{row.group}</Td>
                  <Td center><span className="font-semibold text-gray-700">{r(row.total_planned_qty)}</span></Td>
                  <Td center><span className="font-semibold text-blue-700">{r(row.total_input)}</span></Td>
                  <Td center>{effBadge(r(row.input_percent))}</Td>
                  <Td center><span className="font-bold text-green-600">{r(row.total_output)}</span></Td>
                  <Td center>{effBadge(r(row.output_percent))}</Td>
                  <Td center><span className={`font-semibold ${wip > 0 ? 'text-red-500' : 'text-gray-400'}`}>{wip}</span></Td>
                  <Td center>{r(row.avg_hourly_output)}</Td>
                  {['9_10','10_11','11_12','12_1','2_3','3_4','4_5','5_6','6_7'].map(k => (
                    <Td key={k} center><span className={row[k] > 0 ? 'text-gray-700' : 'text-gray-300'}>{ r(row[k]) || '—'}</span></Td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-blue-600 text-white">
              <td colSpan={7} className="px-3 py-2.5 text-sm font-bold">TOTAL — {data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalPlanned}</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalInput}</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">
                {totalPlanned > 0 ? effBadge(Math.round((totalInput / totalPlanned) * 100)) : '—'}
              </td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput}</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">
                {totalPlanned > 0 ? effBadge(Math.round((totalOutput / totalPlanned) * 100)) : '—'}
              </td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalWip}</td>
              <td colSpan={9}></td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderLineEfficiency = () => {
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {['Date','Line','Machine','Customer','Article No','Color','Leather','Group','EOD target','Output','Output %','Std Mins','Actual Mins','Target@SMV','Efficiency % (in progress)'].map(h => <Th key={h} center={!['Date','Line','Machine','Customer','Article No','Color','Leather','Group'].includes(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-green-50/30 even:bg-slate-50/30 transition-colors">
                <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                <Td><LineBadge name={row.line} /></Td>
                <Td><span className="font-medium">{row.process}</span></Td>
                <Td>{row.customer}</Td><Td>{row.article_no}</Td><Td>{row.color}</Td><Td>{row.leather}</Td><Td>{row.group}</Td>
                <Td center>{r(row.total_planned_qty)}</Td>
                <Td center><span className="font-bold text-green-600">{r(row.total_output)}</span></Td>
                <Td center>{effBadge(r(row.output_percent))}</Td>
                <Td center>{r(row.total_standard_mins_value)}</Td>
                <Td center>{r(row.total_produced_mins_value)}</Td>
                <Td center>{r(row.targeted_output_smv)}</Td>
                <Td center>{effBadge(r(row.efficiency_percent))}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-600 text-white">
              <td colSpan={14} className="px-3 py-2.5 text-sm font-bold">AVG EFFICIENCY — {data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{avgEff}%</td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderAttendance = () => {
    const present = data!.filter(row => row.status === 'Present').length;
    const absent = data!.filter(row => row.status === 'Absent').length;
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {['Date','Line','Emp Code','Employee Name','Status','Login Time'].map(h => <Th key={h} center={['Status','Login Time'].includes(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => (
              <tr key={i} className={`hover:bg-purple-50/30 even:bg-slate-50/30 transition-colors ${row.status === 'Absent' ? 'bg-red-50/40' : ''}`}>
                <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                <Td><LineBadge name={row.line} /></Td>
                <Td><span className="font-mono text-gray-600">{row.emp_code}</span></Td>
                <Td><span className="font-medium">{row.emp_name}</span></Td>
                <Td center>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Present' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {row.status}
                  </span>
                </Td>
                <Td center><span className="font-mono text-sm">{fmtTime(row.login_time)}</span></Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-purple-600 text-white">
              <td colSpan={4} className="px-3 py-2.5 text-sm font-bold">{data!.length} records</td>
              <td className="px-3 py-2.5 text-sm text-center font-bold">
                ✓ {present} Present &nbsp;|&nbsp; ✗ {absent} Absent
              </td>
              <td className="px-3 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderRework = () => {
    const totalRework = data!.reduce((s, row) => s + r(row.rework_qty), 0);
    const totalRejection = data!.reduce((s, row) => s + r(row.rejection_qty), 0);
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {['Date','Line','Machine','EOD target','Output','Output %','Bins','Rework','Rejection','Rework %','Rejection %','Category','Reason'].map(h => <Th key={h} center={!['Date','Line','Machine','Category','Reason'].includes(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-yellow-50/30 even:bg-slate-50/30 transition-colors">
                <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                <Td><LineBadge name={row.line} /></Td>
                <Td>{row.machine}</Td>
                <Td center>{r(row.target)}</Td>
                <Td center><span className="font-semibold">{r(row.output)}</span></Td>
                <Td center>{effBadge(r(row.output_percent))}</Td>
                <Td center>{r(row.bins_completed)}</Td>
                <Td center><span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-bold">{r(row.rework_qty)}</span></Td>
                <Td center><span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-bold">{r(row.rejection_qty)}</span></Td>
                <Td center>{row.rework_percent ?? 0}%</Td>
                <Td center>{row.rejection_percent ?? 0}%</Td>
                <Td>{row.reason_category ? <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{row.reason_category}</span> : '—'}</Td>
                <Td>{row.reason || '—'}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-yellow-500 text-white">
              <td colSpan={7} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalRework} rework</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalRejection} rejection</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderMachineOutput = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.output), 0);
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {['Date','Line','Machine ID','Machine Name','EOD target','Output','Output %','Target Mins','Actual Mins','Idle Mins','Efficiency % (in progress)'].map(h => <Th key={h} center={!['Date','Line','Machine Name'].includes(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-indigo-50/30 even:bg-slate-50/30 transition-colors">
                <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                <Td><LineBadge name={row.line} /></Td>
                <Td center><span className="font-mono font-bold text-gray-600">{row.machine_id}</span></Td>
                <Td><span className="font-medium">{row.machine_name}</span></Td>
                <Td center>{r(row.target)}</Td>
                <Td center><span className="font-bold text-green-600">{r(row.output)}</span></Td>
                <Td center>{effBadge(r(row.output_percent))}</Td>
                <Td center>{r(row.target_mins)}</Td>
                <Td center>{r(row.actual_mins)}</Td>
                <Td center><span className={r(row.idle_mins) > 0 ? 'text-orange-500 font-semibold' : 'text-gray-400'}>{r(row.idle_mins)}</span></Td>
                <Td center>{effBadge(r(row.efficiency_percent))}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-600 text-white">
              <td colSpan={6} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput} total output</td>
              <td colSpan={3}></td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{avgEff}% avg eff.</td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderEmployeeOutput = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.total_output), 0);
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {['Date','Line','Emp Code','Employee Name','Machine ID','Machine Name','EOD target','Total Output','Output %'].map(h => <Th key={h} center={!['Date','Line','Emp Code','Employee Name','Machine Name'].includes(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-teal-50/30 even:bg-slate-50/30 transition-colors">
                <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                <Td><LineBadge name={row.line} /></Td>
                <Td><span className="font-mono text-gray-600">{row.emp_code}</span></Td>
                <Td><span className="font-medium">{row.emp_name}</span></Td>
                <Td center><span className="font-mono font-bold text-gray-500">{row.machine_id}</span></Td>
                <Td>{row.machine_name}</Td>
                <Td center>{r(row.target)}</Td>
                <Td center>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-green-100 text-green-700 font-bold text-sm">{r(row.total_output)}</span>
                </Td>
                <Td center>{effBadge(r(row.output_percent))}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-teal-600 text-white">
              <td colSpan={7} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput} total pairs</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderEmployeePerformance = () => {
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    const totalOutput = data!.reduce((s, row) => s + r(row.output), 0);
    const gradeStyle: Record<string, string> = {
      'Excellent':    'bg-green-100 text-green-700',
      'Good':         'bg-blue-100 text-blue-700',
      'Average':      'bg-yellow-100 text-yellow-700',
      'Below Target': 'bg-red-100 text-red-700',
    };
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {['Date','Line','Emp Code','Employee','Machine ID','Machine','EOD target','Output','Output %','Target Mins','Actual Mins','Idle Mins','Efficiency % (in progress)','Grade'].map(h => <Th key={h} center={!['Date','Line','Emp Code','Employee','Machine'].includes(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-rose-50/30 even:bg-slate-50/30 transition-colors">
                <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                <Td><LineBadge name={row.line} /></Td>
                <Td><span className="font-mono text-gray-600">{row.emp_code}</span></Td>
                <Td><span className="font-medium">{row.emp_name}</span></Td>
                <Td center><span className="font-mono font-bold text-gray-500">{row.machine_id}</span></Td>
                <Td>{row.machine_name}</Td>
                <Td center>{r(row.target)}</Td>
                <Td center><span className="font-bold text-green-600">{r(row.output)}</span></Td>
                <Td center>{effBadge(r(row.output_percent))}</Td>
                <Td center>{r(row.target_mins)}</Td>
                <Td center>{r(row.actual_mins)}</Td>
                <Td center><span className={r(row.idle_mins) > 0 ? 'text-orange-500 font-semibold' : 'text-gray-400'}>{r(row.idle_mins)}</span></Td>
                <Td center>{effBadge(r(row.efficiency_percent))}</Td>
                <Td center>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${gradeStyle[row.performance_grade] || 'bg-gray-100 text-gray-600'}`}>
                    {row.performance_grade}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-rose-600 text-white">
              <td colSpan={7} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput}</td>
              <td></td>
              <td colSpan={3}></td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{avgEff}% avg</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 p-3 sm:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-5">

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 ring-1 ring-white/20">
                <Sparkles className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Reports</h1>
                <p className="text-sm text-slate-300 mt-0.5">Production analytics · export · share</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data && data.length > 0 && (
                <div className="flex items-center gap-2 bg-white/10 ring-1 ring-white/15 rounded-lg px-3 py-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${activeColor.activeBg}`} />
                  <span className="font-medium">{data.length} / {pagination.total || data.length} rows</span>
                </div>
              )}
              {lastReportGeneratedAt && (
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Last run {lastReportGeneratedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white/90 backdrop-blur border border-blue-200/80 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Daily lost minutes</p>
              <p className="text-xs text-slate-500">Drill down in Missed Actions → Daily Inactive Report.</p>
            </div>
          </div>
          <a
            href="/missed_actions?tab=daily"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Open Missed Actions
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Report type picker */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">Report type</p>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={reportTypeQuery}
                onChange={(e) => setReportTypeQuery(e.target.value)}
                placeholder="Filter reports…"
                className="w-full border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {reportTypeQuery && (
                <button type="button" onClick={() => setReportTypeQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <span className="text-xs text-slate-400">{filteredReportOptions.length} of {REPORT_OPTIONS.length}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:thin]">
            {filteredReportOptions.map((opt) => {
              const c = COLOR_MAP[opt.color];
              const hoverBg = HOVER_BG_MAP[opt.color] || 'hover:bg-slate-50';
              const isActive = reportType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectReportTab(opt.value)}
                  className={`snap-start shrink-0 flex flex-col items-center gap-1.5 min-w-[108px] max-w-[120px] p-3 rounded-xl border-2 transition-all text-center ${
                    isActive
                      ? `${c.activeBg} ${c.activeText} border-transparent shadow-md ring-2 ring-offset-1 ring-slate-300`
                      : `bg-white ${c.text} ${c.border} ${hoverBg} hover:shadow-sm`
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : c.bg}`}>{opt.icon}</div>
                  <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {filteredReportOptions.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">No reports match your search.</p>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className={`px-4 py-3 border-b border-slate-100 flex items-center gap-2 ${activeColor.bg}`}>
            <Filter className={`h-4 w-4 ${activeColor.text}`} />
            <span className={`text-sm font-bold ${activeColor.text}`}>
              {activeOption.label}{activeSubViewLabel ? ` · ${activeSubViewLabel}` : ''} — filters
            </span>
          </div>
          <div className="p-4">
          {REPORT_SUB_VIEWS[reportType] && (
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 w-full sm:w-auto sm:mr-1 self-center">View</span>
              {REPORT_SUB_VIEWS[reportType]!.map((sub) => (
                <button
                  key={sub.value}
                  type="button"
                  onClick={() => selectReportSubView(sub.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                    reportSubView === sub.value
                      ? `${activeColor.activeBg} ${activeColor.activeText} border-transparent`
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'last7', label: 'Last 7 Days' },
              { key: 'thisMonth', label: 'This Month' },
              { key: 'custom', label: 'Custom' },
            ] as { key: DatePreset; label: string }[]).map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyDatePreset(preset.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  datePreset === preset.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Line</label>
              <select value={selectedLine} onChange={e => setSelectedLine(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                <option value="">All Lines</option>
                {workCentres.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
              </select>
            </div>
            {reportType === 'hourly-production' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Machine</label>
                <select value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 min-w-[180px]">
                  <option value="">End-of-line (Default)</option>
                  {filteredMachines.map((machine: any) => (
                    <option key={machine.id || machine.machine_id} value={machine.machine_id}>
                      {machine.machine_id} {machine.machine_name || machine.name ? `- ${machine.machine_name || machine.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> From
              </label>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDatePreset('custom'); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> To
              </label>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDatePreset('custom'); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input type="text" value={search} onChange={e => {
                    const val = e.target.value;
                    setSearch(val);
                    if (data !== null) {
                      if (searchTimeout.current) clearTimeout(searchTimeout.current);
                      searchTimeout.current = setTimeout(() => { setPage(1); fetchReport(1, val); }, 500);
                    }
                  }}
                  onKeyDown={e => e.key === 'Enter' && fetchReport(1, search)}
                  placeholder="Name, line, machine..."
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); if (data !== null) fetchReport(1, ''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setPage(1); fetchReport(1); }}
                disabled={isLoading || !!dateError}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 ${activeColor.activeBg} hover:opacity-90 shadow-md`}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
                Generate report
              </button>
              <button
                type="button"
                onClick={shareViaWhatsApp}
                disabled={!data || data.length === 0 || isShareLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 shadow-sm"
              >
                {isShareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                WhatsApp
              </button>
              <button type="button" onClick={clearAllFilters} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                    .then(() => toast.success('Report link copied'))
                    .catch(() => toast.error('Could not copy link'));
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                <Copy className="h-4 w-4" /> Copy link
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu((v) => !v)}
                  disabled={!data || data.length === 0 || isExportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40 shadow-sm"
                >
                  {isExportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export
                  <ChevronRight className={`h-4 w-4 transition-transform ${showExportMenu ? 'rotate-90' : ''}`} />
                </button>
                {showExportMenu && (
                  <div className="absolute left-0 top-full mt-1 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                    <button type="button" onClick={() => { exportCSV(); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>
                    <button type="button" onClick={() => { exportExcel(); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
                    </button>
                    <button type="button" onClick={() => { exportPDF(); setShowExportMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-rose-600" /> PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Exports include all filtered rows (not just this page).</span>
              <div className="flex flex-wrap items-center gap-2">
                {hasUnsavedReportFilterChanges && (
                  <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md font-semibold">
                    Filters changed — regenerate
                  </span>
                )}
              </div>
            </div>
          </div>

          {dateError && (
            <p className="mt-3 text-sm text-red-600 font-medium flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" /> {dateError}
            </p>
          )}

          {activeFilterChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <span key={chip} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold ring-1 ring-slate-200">
                  {chip}
                </span>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className={`h-11 w-11 animate-spin mx-auto mb-4 ${activeColor.text}`} />
              <p className="text-slate-600 font-semibold">Generating {activeOption.label}…</p>
              <p className="text-slate-400 text-sm mt-1">{fmtDate(fromDate)} — {fmtDate(toDate)}</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-10 text-center">
            <AlertCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-red-800 mb-1">Could not load report</h2>
            <p className="text-red-600 text-sm max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={() => fetchReport(page, search)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-sm"
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : data === null ? (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-slate-300 flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className={`p-5 rounded-2xl ${activeColor.bg} mb-4 ring-4 ring-white shadow-inner`}>
              <div className={`scale-125 ${activeColor.text}`}>{activeOption.icon}</div>
            </div>
            <p className="text-slate-700 font-semibold text-lg">Ready to generate</p>
            <p className="text-slate-500 text-sm mt-2 max-w-sm">
              Choose filters above, then click <strong>Generate report</strong> for {activeOption.label}.
            </p>
            <p className="text-slate-400 text-xs mt-3 flex items-center justify-center gap-1">
              {fmtDate(fromDate)} <ChevronRight className="h-3 w-3" /> {fmtDate(toDate)}
            </p>
          </div>
        ) : (
          <div ref={reportTableRef} className="bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden">
            <div className={`px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 ${activeColor.bg} border-b ${activeColor.border}`}>
              <div className="flex items-center gap-2.5">
                <span className={`p-1.5 rounded-lg bg-white/60 ${activeColor.text}`}>{activeOption.icon}</span>
                <div>
                  <span className={`font-bold text-sm block ${activeColor.text}`}>
                    {activeOption.label}{activeSubViewLabel ? ` · ${activeSubViewLabel}` : ''}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {pagination.total ? `${pagination.total} total records` : `${data.length} rows`}
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-600 font-medium">
                {fmtDate(fromDate)} — {fmtDate(toDate)}
                {selectedLine && workCentres.length > 0 && ` · ${workCentres.find((w) => w.id == selectedLine)?.name}`}
                {reportType === 'hourly-production' && selectedMachine && ` · M${selectedMachine}`}
              </span>
            </div>
            {renderReportKpis()}
            {isMobile ? (
              <>
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50">
                  Card layout for mobile — use landscape or desktop for full grid.
                </div>
                {renderMobileCards()}
              </>
            ) : (
              <>
                <div className="px-4 py-1.5 text-[11px] text-slate-400 border-b border-slate-50 flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 rotate-90" /> Scroll horizontally for all columns
                </div>
                {renderTable()}
              </>
            )}
            {data && data.length > 0 && (
              <Pagination
                currentPage={page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={limit}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleLimitChange}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
