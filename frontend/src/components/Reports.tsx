import React from 'react';
import { Loader2, AlertCircle, Download, Search, BarChart2, Clock, Users, AlertTriangle, Cpu, UserCheck, TrendingUp, ChevronRight, FileSpreadsheet, FileText, RotateCcw, Copy, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';
import * as XLSX from 'xlsx';

type ReportType = 'hourly-production' | 'line-efficiency' | 'attendance' | 'rework-rejection' | 'machine-output' | 'employee-output' | 'employee-performance' | 'downtime' | 'attendance-production' | 'shift-summary' | 'bottleneck' | 'breakdown';

const REPORT_OPTIONS: { value: ReportType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'hourly-production',    label: 'Hourly Production',         icon: <Clock className="h-5 w-5" />,       color: 'blue' },
  { value: 'line-efficiency',      label: 'Line & Process Efficiency', icon: <BarChart2 className="h-5 w-5" />,   color: 'green' },
  { value: 'attendance',           label: 'Attendance',                icon: <Users className="h-5 w-5" />,       color: 'purple' },
  { value: 'rework-rejection',     label: 'Rework & Rejection',        icon: <AlertTriangle className="h-5 w-5" />, color: 'yellow' },
  { value: 'machine-output',       label: 'Machine-wise Output',       icon: <Cpu className="h-5 w-5" />,         color: 'indigo' },
  { value: 'employee-output',      label: 'Employee-wise Output',      icon: <UserCheck className="h-5 w-5" />,   color: 'teal' },
  { value: 'employee-performance', label: 'Employee Performance',      icon: <TrendingUp className="h-5 w-5" />,  color: 'rose' },
  { value: 'downtime',             label: 'Downtime Analysis',         icon: <AlertTriangle className="h-5 w-5" />, color: 'orange' },
  { value: 'attendance-production',label: 'Attendance vs Output',      icon: <Users className="h-5 w-5" />,       color: 'cyan' },
  { value: 'shift-summary',        label: 'Shift Summary',             icon: <BarChart2 className="h-5 w-5" />,   color: 'slate' },
  { value: 'bottleneck',           label: 'Bottleneck Report',         icon: <AlertTriangle className="h-5 w-5" />, color: 'red' },
  { value: 'breakdown',            label: 'Breakdown Report',          icon: <Wrench className="h-5 w-5" />,        color: 'amber' },
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
  targeted_output_smv: 'Target @ SMV', efficiency_percent: 'Efficiency %',
  emp_id: 'Emp ID', emp_name: 'Employee Name', emp_code: 'Emp Code', status: 'Status', login_time: 'Login Time',
  machine: 'Machine', output: 'Output', bins_completed: 'Bins', rework_qty: 'Rework',
  rejection_qty: 'Rejection', rework_percent: 'Rework %', rejection_percent: 'Rejection %',
  reason_category: 'Category', reason: 'Reason',
  machine_id: 'Machine ID', machine_name: 'Machine Name', target_mins: 'Target Mins',
  actual_mins: 'Actual Mins', idle_mins: 'Idle Mins', total_output_pairs: 'Output Pairs',
  target: 'Target', performance_grade: 'Grade', boxes: 'Box', cycles: 'Cycles', total_output: 'Output',
  routing_mins_per_box: 'Routing Mins/6 prs', shift_target_output: 'Shift Target (pairs)', shift_efficiency_pct: 'Shift Efficiency %',
  line_plan_target: 'Line Plan Target', line_output_percent: 'Line Output %',
  line: 'Line', machine_name: 'Machine Name', emp_name: 'Employee Name',
  start_time: 'Start', finish_time: 'Finish', duration_mins: 'Duration (mins)',
  status: 'Status', m4_category: 'M4 Category', m4_reason: 'Reason', m4_notes: 'Notes', detail: 'Detail',
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

const normalizeReportRows = (rows: any[] | null | undefined, type: ReportType) => {
  if (!rows) return [];
  if (type === 'bottleneck' || type === 'breakdown') {
    return rows.map((row) => enrichStoppageRow(row));
  }
  return rows;
};

const FILTER_STORAGE_KEY = 'reports_filters_v1';

/** Shown only on Hourly Production report (table + export). */
const HOURLY_ONLY_FIELDS = ['total_input', 'input_percent'] as const;

const EXPORT_OMIT_BY_REPORT: Partial<Record<ReportType, readonly string[]>> = {
  'shift-summary': ['shift_idle_mins'],
};

const stripExportFields = (row: Record<string, unknown>, report: ReportType) => {
  const out = { ...row };
  if (report !== 'hourly-production') {
    for (const key of HOURLY_ONLY_FIELDS) delete out[key];
  }
  const omit = EXPORT_OMIT_BY_REPORT[report];
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
  const reportTableRef = React.useRef<HTMLDivElement>(null);
  const generatedFilterSnapshotRef = React.useRef<string | null>(null);
  const currentFilterSnapshot = React.useMemo(() => JSON.stringify({
    fromDate,
    toDate,
    reportType,
    selectedLine,
    selectedMachine,
    search: search.trim(),
    limit,
    datePreset,
  }), [fromDate, toDate, reportType, selectedLine, selectedMachine, search, limit, datePreset]);
  const hasUnsavedReportFilterChanges = React.useMemo(() => {
    if (!data || data.length === 0) return false;
    if (!generatedFilterSnapshotRef.current) return false;
    return generatedFilterSnapshotRef.current !== currentFilterSnapshot;
  }, [data, currentFilterSnapshot]);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlReportType = params.get('reportType') as ReportType | null;
      const urlFromDate = params.get('fromDate');
      const urlToDate = params.get('toDate');
      const urlSelectedLine = params.get('workCentreId');
      const urlSelectedMachine = params.get('machineId');
      const urlSearch = params.get('search');
      const urlLimit = params.get('limit');
      const urlPreset = params.get('datePreset') as DatePreset | null;

      if (urlReportType) setReportType(urlReportType);
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
      if (saved.reportType) setReportType(saved.reportType);
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
        selectedLine,
        selectedMachine,
        search,
        limit,
        datePreset,
      })
    );

    const params = new URLSearchParams();
    params.set('reportType', reportType);
    params.set('fromDate', fromDate);
    params.set('toDate', toDate);
    if (selectedLine) params.set('workCentreId', selectedLine);
    if (selectedMachine && reportType === 'hourly-production') params.set('machineId', selectedMachine);
    if (search.trim()) params.set('search', search.trim());
    params.set('limit', String(limit));
    params.set('datePreset', datePreset);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }, [fromDate, toDate, reportType, selectedLine, selectedMachine, search, limit, datePreset]);

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
      const response = await apiFetch(`${API_BASE}/api/reports/${reportType}?${params}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setData(normalizeReportRows(result.data, reportType));
      setLastReportGeneratedAt(new Date());
      generatedFilterSnapshotRef.current = JSON.stringify({
        fromDate,
        toDate,
        reportType,
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
    apiFetch(`${API_BASE}/api/reports/${reportType}?${params}`)
      .then(r => r.json())
      .then(result => {
        if (!result.success) throw new Error(result.error);
        setData(normalizeReportRows(result.data, reportType));
        setLastReportGeneratedAt(new Date());
        generatedFilterSnapshotRef.current = JSON.stringify({
          fromDate,
          toDate,
          reportType,
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
    const firstRes = await apiFetch(`${API_BASE}/api/reports/${reportType}?${firstParams}`);
    const first = await firstRes.json();
    if (!first.success) throw new Error(first.error || 'Failed to load report for export');
    let allRows = [...(first.data || [])];
    const totalPages = first.pagination?.totalPages || 1;
    for (let p = 2; p <= totalPages; p++) {
      const params = buildReportParams({ page: p, limit: exportLimit });
      const res = await apiFetch(`${API_BASE}/api/reports/${reportType}?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || `Failed on export page ${p}`);
      allRows = allRows.concat(json.data || []);
    }
    return {
      rows: normalizeReportRows(allRows, reportType),
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
      const headers = Object.keys(stripExportFields(rows[0], reportType));
    const csvRows = [
      headers.map(h => `"${HEADER_MAP[h] || h}"`).join(','),
      ...rows.map(row => {
        const filtered = stripExportFields(row, reportType);
        return headers.map(h => {
          const v = filtered[h] === null || filtered[h] === undefined ? '' : String(filtered[h]);
          return `"${v.replace(/"/g, '""')}"`;
        }).join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${reportType}_${fromDate}_${toDate}.csv`;
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
      const headers = Object.keys(stripExportFields(exportRows[0], reportType));
      const rows = exportRows.map((row) => {
      const filtered = stripExportFields(row, reportType);
      const mapped: Record<string, any> = {};
      headers.forEach((h) => {
        mapped[HEADER_MAP[h] || h] = filtered[h];
      });
      return mapped;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${reportType}_${fromDate}_${toDate}.xlsx`);
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
      const headers = Object.keys(stripExportFields(exportRows[0], reportType));
    const title = `${activeOption.label} (${fmtDate(fromDate)} - ${fmtDate(toDate)})`;
    const tableHead = headers.map(h => `<th style="border:1px solid #ddd;padding:6px;text-align:left;font-size:11px;">${HEADER_MAP[h] || h}</th>`).join('');
    const tableRows = exportRows.map((row) => {
      const filtered = stripExportFields(row, reportType);
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
      const messageText =
        `📊 *${activeOption.label} Report*\n` +
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

  const Th = ({ children }: { children: React.ReactNode }) => (
    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50 border-b border-gray-200">{children}</th>
  );
  const Td = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
    <td className={`px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap ${center ? 'text-center' : ''}`}>{children}</td>
  );

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
    const columnsByType: Partial<Record<ReportType, string[]>> = {
      'hourly-production': ['date', 'line', 'customer', 'total_planned_qty', 'total_input', 'input_percent', 'total_output', 'output_percent'],
      'line-efficiency': ['date', 'line', 'process', 'total_planned_qty', 'total_output', 'output_percent', 'efficiency_percent'],
      'attendance': ['date', 'line', 'emp_code', 'emp_name', 'status', 'target', 'output_percent'],
      'rework-rejection': ['date', 'line', 'machine', 'target', 'output', 'output_percent', 'rework_qty', 'rejection_qty'],
      'machine-output': ['date', 'line', 'machine_id', 'target', 'output', 'output_percent', 'efficiency_percent'],
      'employee-output': ['date', 'line', 'emp_code', 'target', 'total_output', 'output_percent'],
      'employee-performance': ['date', 'line', 'emp_code', 'target', 'output', 'output_percent', 'efficiency_percent'],
      bottleneck: ['date', 'line', 'machine_id', 'emp_id', 'status', 'duration_mins', 'm4_category', 'm4_reason'],
      breakdown: ['date', 'line', 'machine_id', 'emp_id', 'status', 'duration_mins', 'm4_category', 'm4_reason'],
    };
    const keys = columnsByType[reportType] || [];
    return (
      <div className="space-y-3 p-3">
        {data.map((row, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            {keys.map((key) => {
              let value: any = row[key];
              if (key === 'date') value = fmtDate(value);
              if (key === 'login_time') value = fmtTime(value);
              if (key === 'input_percent' || key === 'output_percent') value = `${r(value)}%`;
              if (value === null || value === undefined || value === '') value = '—';
              return (
                <div key={key} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-b-0">
                  <span className="text-xs font-semibold text-gray-500">{HEADER_MAP[key] || key}</span>
                  <span className="text-sm font-medium text-gray-800 text-right">{String(value)}</span>
                </div>
              );
            })}
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
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border-b">Date</th>
              <th className="text-left p-2 border-b">Line</th>
              <th className="text-left p-2 border-b">Machine</th>
              <th className="text-left p-2 border-b">Operator</th>
              <th className="text-left p-2 border-b">Start</th>
              <th className="text-left p-2 border-b">Finish</th>
              <th className="text-center p-2 border-b">Duration</th>
              <th className="text-left p-2 border-b">Status</th>
              <th className="text-left p-2 border-b">M4 Category</th>
              <th className="text-left p-2 border-b">Reason</th>
              <th className="text-left p-2 border-b">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, i: number) => (
              <tr key={row.id ?? i} className="border-b hover:bg-gray-50">
                <td className="p-2">{row.date ? fmtDate(row.date) : '—'}</td>
                <td className="p-2">{row.line || '—'}</td>
                <td className="p-2">
                  {row.machine_id}
                  {row.machine_name ? ` - ${row.machine_name}` : ''}
                </td>
                <td className="p-2">
                  {row.emp_id}
                  {row.emp_name ? ` - ${row.emp_name}` : ''}
                </td>
                <td className="p-2">{fmtTime(row.start_time || row.idle_start_time)}</td>
                <td className="p-2">
                  {row.status === 'In progress' ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass.active}`}>In progress</span>
                  ) : (
                    fmtTime(row.finish_time)
                  )}
                </td>
                <td className="p-2 text-center font-medium">{row.duration_mins != null ? `${row.duration_mins}m` : '—'}</td>
                <td className="p-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.status === 'In progress' ? statusClass.active : statusClass.resolved}`}>
                    {row.status}
                  </span>
                </td>
                <td className="p-2">
                  {row.m4_category ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${m4Class[row.m4_category] || 'bg-gray-100 text-gray-700'}`}>
                      {row.m4_category}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-2">{row.m4_reason || '—'}</td>
                <td className="p-2 text-gray-600">{row.m4_notes || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="p-2 border-t" colSpan={6}>
                Total: {rows.length} events
                {inProgress > 0 ? ` (${inProgress} in progress)` : ''}
              </td>
              <td className="p-2 border-t text-center">{totalMins}m</td>
              <td className="p-2 border-t" colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderDowntime = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50"><tr>
          <th className="text-left p-2 border-b">Date</th>
          <th className="text-left p-2 border-b">Machine</th>
          <th className="text-left p-2 border-b">Employee</th>
          <th className="text-left p-2 border-b">Line</th>
          <th className="text-center p-2 border-b">Target</th>
          <th className="text-center p-2 border-b">Output %</th>
          <th className="text-left p-2 border-b">Idle Start</th>
          <th className="text-left p-2 border-b">Idle End</th>
          <th className="text-left p-2 border-b">Duration</th>
          <th className="text-left p-2 border-b">Reason</th>
        </tr></thead>
        <tbody>
          {data!.map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-2">{row.date ? fmtDate(row.date) : '—'}</td>
              <td className="p-2">{row.machine_id}{row.machine_name ? ` - ${row.machine_name}` : ''}</td>
              <td className="p-2">{row.emp_id}{row.employee_name ? ` - ${row.employee_name}` : ''}</td>
              <td className="p-2">{row.work_centre_name}</td>
              <td className="p-2 text-center">{r(row.target)}</td>
              <td className="p-2 text-center">{effBadge(r(row.output_percent))}</td>
              <td className="p-2">{row.idle_start_time ? new Date(row.idle_start_time).toLocaleString('en-IN', {hour12:false,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</td>
              <td className="p-2">{row.idle_stop_time ? new Date(row.idle_stop_time).toLocaleString('en-IN', {hour12:false,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : <span className="text-orange-500 text-xs">Still idle</span>}</td>
              <td className="p-2 font-medium">{row.idle_mins != null ? `${row.idle_mins}m` : '-'}</td>
              <td className="p-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  row.reason === 'Machine Breakdown' ? 'bg-red-100 text-red-700' :
                  row.reason === 'Material Shortage' ? 'bg-yellow-100 text-yellow-700' :
                  row.reason === 'Power Cut' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{row.reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAttendanceProduction = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50"><tr>
          <th className="text-left p-2 border-b">Date</th>
          <th className="text-left p-2 border-b">Employee</th>
          <th className="text-left p-2 border-b">Line</th>
          <th className="text-center p-2 border-b">Target</th>
          <th className="text-center p-2 border-b">Output %</th>
          <th className="text-left p-2 border-b">Session Start</th>
          <th className="text-left p-2 border-b">Session End</th>
          <th className="text-left p-2 border-b">Session Mins</th>
          <th className="text-left p-2 border-b">Cycles</th>
          <th className="text-left p-2 border-b">Active Mins</th>
          <th className="text-left p-2 border-b">Output</th>
          <th className="text-left p-2 border-b">Status</th>
        </tr></thead>
        <tbody>
          {data!.map((row: any, i: number) => {
            const isZero = Number(row.total_output) === 0;
            return (
              <tr key={i} className={`border-b ${isZero ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                <td className="p-2">{row.date ? fmtDate(row.date) : '—'}</td>
                <td className="p-2">{row.emp_code}{row.employee_name ? ` - ${row.employee_name}` : ''}</td>
                <td className="p-2">{row.work_centre_name}</td>
                <td className="p-2 text-center">{r(row.target)}</td>
                <td className="p-2 text-center">{effBadge(r(row.output_percent))}</td>
                <td className="p-2">{row.session_start ? new Date(row.session_start).toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit'}) : '-'}</td>
                <td className="p-2">{row.session_end ? new Date(row.session_end).toLocaleTimeString('en-IN',{hour12:false,hour:'2-digit',minute:'2-digit'}) : <span className="text-green-600 text-xs">Active</span>}</td>
                <td className="p-2">{row.session_mins}m</td>
                <td className="p-2">{row.cycles_completed}</td>
                <td className="p-2">{row.active_mins}m</td>
                <td className="p-2 font-semibold">{row.total_output}</td>
                <td className="p-2">{isZero ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">⚠ Zero Output</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderShiftSummary = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50"><tr>
          <th className="text-left p-2 border-b">Date</th>
          <th className="text-left p-2 border-b">Machine</th>
          <th className="text-left p-2 border-b">Employee</th>
          <th className="text-left p-2 border-b">Line</th>
          <th className="text-center p-2 border-b">Shift target</th>
          <th className="text-left p-2 border-b">Cycles</th>
          <th className="text-center p-2 border-b">Box</th>
          <th className="text-left p-2 border-b">Output</th>
          <th className="text-left p-2 border-b">Active Mins</th>
          <th className="text-left p-2 border-b">Utilisation</th>
          <th className="text-left p-2 border-b">Shift Efficiency</th>
        </tr></thead>
        <tbody>
          {data!.map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-2">{row.date ? fmtDate(row.date) : '—'}</td>
              <td className="p-2">{row.machine_id}{row.machine_name ? ` - ${row.machine_name}` : ''}</td>
              <td className="p-2">{row.emp_id}{row.employee_name ? ` - ${row.employee_name}` : ''}</td>
              <td className="p-2">{row.work_centre_name}</td>
              <td className="p-2 text-center" title={row.routing_mins_per_box ? `Routing: ${row.routing_mins_per_box} min / 6 prs` : 'No routing for this machine'}>
                {row.shift_target_output != null && Number(row.shift_target_output) > 0
                  ? r(row.shift_target_output)
                  : '—'}
              </td>
              <td className="p-2">{row.cycles}</td>
              <td className="p-2 text-center font-semibold text-slate-800">
                {row.boxes != null ? row.boxes : (Number(row.total_output || 0) > 0 ? Math.round(Number(row.total_output) / 6) : 0)}
              </td>
              <td className="p-2 font-semibold">{row.total_output}</td>
              <td className="p-2">{row.shift_actual_mins}m</td>
              <td className="p-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  row.shift_utilisation_pct >= 70 ? 'bg-green-100 text-green-700' :
                  row.shift_utilisation_pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>{row.shift_utilisation_pct}%</span>
              </td>
              <td className="p-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                  row.shift_efficiency_pct >= 90 ? 'bg-green-100 text-green-700' :
                  row.shift_efficiency_pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>{row.shift_efficiency_pct}%</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td className="p-2 border-t" colSpan={5}>Total (Shift: 09:00–17:30, 480 mins excl. 30 min lunch)</td>
            <td className="p-2 border-t">{data!.reduce((s:number,r:any)=>s+Number(r.cycles||0),0)}</td>
            <td className="p-2 border-t text-center">
              {data!.reduce((s:number,r:any)=>s+Number(r.boxes ?? (Number(r.total_output||0)>0?Math.round(Number(r.total_output)/6):0)),0)}
            </td>
            <td className="p-2 border-t">{data!.reduce((s:number,r:any)=>s+Number(r.total_output||0),0)}</td>
            <td className="p-2 border-t">{data!.reduce((s:number,r:any)=>s+Number(r.shift_actual_mins||0),0)}m</td>
            <td className="p-2 border-t" colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const renderTable = () => {
    if (!data || data.length === 0) return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Search className="h-16 w-16 mb-4 text-gray-200" />
        <p className="text-lg font-medium text-gray-400">No data for selected filters</p>
        <p className="text-sm text-gray-300 mt-1">Try adjusting the date range or line filter</p>
      </div>
    );
    switch (reportType) {
      case 'hourly-production':    return renderHourly();
      case 'line-efficiency':      return renderLineEfficiency();
      case 'attendance':           return renderAttendance();
      case 'rework-rejection':     return renderRework();
      case 'machine-output':       return renderMachineOutput();
      case 'employee-output':      return renderEmployeeOutput();
      case 'employee-performance': return renderEmployeePerformance();
      case 'downtime':             return renderDowntime();
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
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Customer','Article No','Color','Leather','Group','Planned','Input','Input %','Output','Output %','WIP','Avg/Hr','9-10','10-11','11-12','12-1','2-3','3-4','4-5','5-6','6-7'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => {
              const wip = r(row.total_planned_qty) - r(row.total_output);
              return (
                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                  <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                  <Td><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{row.line}</span></Td>
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
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalPlanned - totalOutput}</td>
              <td colSpan={9}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderLineEfficiency = () => {
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Machine','Customer','Article No','Color','Leather','Group','Planned','Output','Output %','Std Mins','Actual Mins','Target@SMV','Efficiency %'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-green-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-semibold">{row.line}</span></Td>
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
      </div>
    );
  };

  const renderAttendance = () => {
    const present = data!.filter(row => row.status === 'Present').length;
    const absent = data!.filter(row => row.status === 'Absent').length;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Emp Code','Employee Name','Status','Target','Output %','Login Time'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className={`hover:bg-purple-50/30 transition-colors ${row.status === 'Absent' ? 'bg-red-50/20' : ''}`}>
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-semibold">{row.line}</span></Td>
                <Td><span className="font-mono text-gray-600">{row.emp_code}</span></Td>
                <Td><span className="font-medium">{row.emp_name}</span></Td>
                <Td center>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Present' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {row.status}
                  </span>
                </Td>
                <Td center>{r(row.target)}</Td>
                <Td center>{effBadge(r(row.output_percent))}</Td>
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
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderRework = () => {
    const totalRework = data!.reduce((s, row) => s + r(row.rework_qty), 0);
    const totalRejection = data!.reduce((s, row) => s + r(row.rejection_qty), 0);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Machine','Target','Output','Output %','Bins','Rework','Rejection','Rework %','Rejection %','Category','Reason'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-yellow-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs font-semibold">{row.line}</span></Td>
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
      </div>
    );
  };

  const renderMachineOutput = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.output), 0);
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Machine ID','Machine Name','Target','Output','Output %','Target Mins','Actual Mins','Idle Mins','Efficiency %'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">{row.line}</span></Td>
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
      </div>
    );
  };

  const renderEmployeeOutput = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.total_output), 0);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Emp Code','Employee Name','Machine ID','Machine Name','Target','Total Output','Output %'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-teal-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-semibold">{row.line}</span></Td>
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
      </div>
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
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Emp Code','Employee','Machine ID','Machine','Target','Output','Output %','Target Mins','Actual Mins','Idle Mins','Efficiency %','Grade'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-rose-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-xs font-semibold">{row.line}</span></Td>
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
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-full mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Generate and export production reports</p>
          </div>
          {data && data.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${activeColor.activeBg}`}></span>
              <span className="text-sm font-semibold text-gray-700">
                Showing {data.length} / {pagination.total || data.length} rows
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Daily Lost Minutes</p>
              <p className="text-xs text-gray-500">Operational drill-down is available in Missed Actions under Daily Inactive Report.</p>
            </div>
          </div>
          <a
            href="/missed_actions?tab=daily"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            Open Missed Actions Report
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Report Type Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {REPORT_OPTIONS.map(opt => {
            const c = COLOR_MAP[opt.color];
            const isActive = reportType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { setReportType(opt.value); setData(null); setError(null); setPage(1); setSearch(''); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                  isActive
                    ? `${c.activeBg} ${c.activeText} border-transparent shadow-md scale-[1.02]`
                    : `bg-white ${c.text} ${c.border} hover:${c.bg} hover:shadow-sm`
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : c.bg}`}>{opt.icon}</div>
                <span className="text-xs font-semibold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2 mb-3">
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

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Line</label>
              <select value={selectedLine} onChange={e => setSelectedLine(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From Date</label>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDatePreset('custom'); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To Date</label>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDatePreset('custom'); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search</label>
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
                  className="border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 w-48" />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); if (data !== null) fetchReport(1, ''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => { setPage(1); fetchReport(1); }} disabled={isLoading || !!dateError}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 ${activeColor.activeBg} hover:opacity-90 shadow-sm`}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Generate Report
            </button>
            <button
              type="button"
              onClick={shareViaWhatsApp}
              disabled={!data || data.length === 0 || isShareLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-40 transition-all shadow-sm"
            >
              {isShareLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              }
              WhatsApp
            </button>
            <button onClick={clearAllFilters}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all shadow-sm">
              <RotateCcw className="h-4 w-4" /> Clear All
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                  .then(() => toast.success('Report link copied'))
                  .catch(() => toast.error('Could not copy link'));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all shadow-sm"
            >
              <Copy className="h-4 w-4" /> Copy Link
            </button>
            <button onClick={exportCSV} disabled={!data || data.length === 0 || isExportLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-40 transition-all shadow-sm">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={exportExcel} disabled={!data || data.length === 0 || isExportLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-sm">
              <FileSpreadsheet className="h-4 w-4" /> Export Excel
            </button>
            <button onClick={exportPDF} disabled={!data || data.length === 0 || isExportLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 transition-all shadow-sm">
              <FileText className="h-4 w-4" /> Export PDF
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
            <span>Exports include all filtered rows (not just current page).</span>
            <div className="flex items-center gap-2">
              {hasUnsavedReportFilterChanges ? (
                <span className="text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded-md">
                  Filters changed. Regenerate report.
                </span>
              ) : null}
              <span>{lastReportGeneratedAt ? `Last generated: ${lastReportGeneratedAt.toLocaleTimeString()}` : 'Not generated yet'}</span>
            </div>
          </div>

          {dateError && (
            <p className="mt-3 text-sm text-red-600 font-medium">{dateError}</p>
          )}

          {activeFilterChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <span key={chip} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className={`h-10 w-10 animate-spin mx-auto mb-3 ${activeColor.text}`} />
              <p className="text-gray-500 font-medium">Generating report...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-red-700 mb-1">Failed to load report</h2>
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => fetchReport(page, search)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : data === null ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center py-20">
            <div className={`p-4 rounded-2xl ${activeColor.bg} mb-4`}>
              <div className={activeColor.text}>{activeOption.icon}</div>
            </div>
            <p className="text-gray-500 font-medium">Select filters and click Generate Report</p>
            <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
              {activeOption.label} <ChevronRight className="h-3 w-3" /> {fmtDate(fromDate)} to {fmtDate(toDate)}
            </p>
          </div>
        ) : (
          <div ref={reportTableRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Table header bar */}
            <div className={`px-4 py-3 flex justify-between items-center ${activeColor.bg} border-b ${activeColor.border}`}>
              <div className="flex items-center gap-2">
                <span className={activeColor.text}>{activeOption.icon}</span>
                <span className={`font-bold text-sm ${activeColor.text}`}>{activeOption.label}</span>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {fmtDate(fromDate)} — {fmtDate(toDate)}
                {selectedLine && workCentres.length > 0 && ` · ${workCentres.find(w => w.id == selectedLine)?.name}`}
                {reportType === 'hourly-production' && selectedMachine && ` · Machine ${selectedMachine}`}
              </span>
            </div>
            {isMobile && (
              <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                Mobile view enabled for readability. Switch to desktop for full table grid.
              </div>
            )}
            {isMobile ? renderMobileCards() : (
              <>
                <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                  Tip: scroll horizontally to view all columns.
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
