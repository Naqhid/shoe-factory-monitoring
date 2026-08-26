import React from 'react';
import { flushSync } from 'react-dom';
import { Loader2, AlertCircle, Download, Search, BarChart2, Clock, Users, AlertTriangle, UserCheck, TrendingUp, ChevronRight, FileSpreadsheet, FileText, RotateCcw, Copy, Wrench, Calendar, Filter, X, Sparkles, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';
import * as XLSX from 'xlsx';
import { minutesToDurationParts, formatDurationString } from '../utils/formatCycleDuration';
import {
  addDaysToDateKey,
  computeCompareDelta,
  type CompareDelta,
  type ReportCompareMode,
  hourlyCompareKey,
  indexCompareRows,
  lineEffCompareKey,
  comparePeriodLabel,
  comparePeriodHeaderLabel,
  numCompare,
} from '../utils/reportCompareUtils';
import { downloadReportPdf } from '../utils/reportPdfExport';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const stripWhatsAppMarkdown = (text: string) => text.replace(/\*/g, '');

const SHARE_CAPTURE_DESKTOP_WIDTH = 1280;
const SHARE_CAPTURE_MOBILE_WIDTH = 1080;

const getShareCaptureScale = (mobile: boolean) =>
  mobile
    ? Math.min(4, Math.max(3, Math.ceil(window.devicePixelRatio || 2)))
    : Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 2)));

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/** Stack summary text above the table capture so the PNG is self-contained. */
const buildReportShareCanvas = (
  tableCanvas: HTMLCanvasElement,
  messageText: string,
  captureScale = 1
): HTMLCanvasElement => {
  const lines = messageText.split('\n').map(stripWhatsAppMarkdown);
  const padding = 28 * captureScale;
  const titleSize = 26 * captureScale;
  const metaSize = 18 * captureScale;
  const titleLineHeight = 34 * captureScale;
  const metaLineHeight = 24 * captureScale;
  const headerHeight = padding + titleLineHeight + Math.max(0, lines.length - 1) * metaLineHeight + padding;
  const dividerGap = 12 * captureScale;

  const out = document.createElement('canvas');
  out.width = tableCanvas.width;
  out.height = headerHeight + dividerGap + tableCanvas.height;

  const ctx = out.getContext('2d');
  if (!ctx) return tableCanvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, out.width, headerHeight);

  lines.forEach((line, i) => {
    ctx.fillStyle = '#ffffff';
    ctx.font =
      i === 0
        ? `bold ${titleSize}px Arial, Helvetica, sans-serif`
        : `${metaSize}px Arial, Helvetica, sans-serif`;
    const y = padding + (i === 0 ? titleSize : titleLineHeight + metaSize + (i - 1) * metaLineHeight);
    ctx.fillText(line, padding, y);
  });

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2 * captureScale;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(out.width, headerHeight);
  ctx.stroke();

  ctx.drawImage(tableCanvas, 0, headerHeight + dividerGap);
  return out;
};

const SHARE_IMAGE_MAX_WIDTH = 1400;
const SHARE_JPEG_QUALITY = 0.88;
/** Mobile browsers need time to finish writing Downloads before WhatsApp can read the file. */
const SHARE_SAVE_MOBILE_DELAY_MS = 5000;

const sanitizeShareFilename = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

/** Downscale large captures so saved/shared files stay a reasonable size. */
const prepareShareCanvas = (canvas: HTMLCanvasElement, maxWidth = SHARE_IMAGE_MAX_WIDTH): HTMLCanvasElement => {
  if (canvas.width <= maxWidth) return canvas;
  const out = document.createElement('canvas');
  const scale = maxWidth / canvas.width;
  out.width = maxWidth;
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
};

const canvasToShareBlob = (
  canvas: HTMLCanvasElement,
  mime: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob | null> =>
  new Promise((resolve) => {
    const prepared = prepareShareCanvas(canvas);
    if (mime === 'image/jpeg') {
      prepared.toBlob(resolve, 'image/jpeg', SHARE_JPEG_QUALITY);
    } else {
      prepared.toBlob(resolve, 'image/png');
    }
  });

const createShareImageFile = async (
  canvas: HTMLCanvasElement,
  filename: string,
  mime: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<File | null> => {
  const blob = await canvasToShareBlob(canvas, mime);
  if (!blob || blob.size === 0) return null;
  const ext = mime === 'image/jpeg' ? '.jpg' : '.png';
  const base = sanitizeShareFilename(filename.replace(/\.(png|jpg|jpeg)$/i, ''));
  return new File([blob], `${base}${ext}`, { type: mime, lastModified: Date.now() });
};

/** System share sheet (WhatsApp icon in the list) — needs HTTPS on most phones. */
const canAttemptNativeShare = (): boolean =>
  typeof navigator !== 'undefined' &&
  'share' in navigator &&
  typeof navigator.share === 'function';

const downloadShareFile = (file: File, mobile: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.download = file.name;
      link.href = url;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      // Keep the blob URL alive until the OS has likely finished writing the file.
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, mobile ? SHARE_SAVE_MOBILE_DELAY_MS : 1000);
    } catch (error) {
      reject(error);
    }
  });

/** UI tabs (8). Legacy API slugs kept for fetch/export via resolveApiReportType. */
type ReportType =
  | 'hourly-production'
  | 'line-efficiency'
  | 'attendance'
  | 'rework-rejection'
  | 'employee'
  | 'idle-stoppages'
  | 'time-loss-details'
  | 'shift-summary';

type ApiReportType =
  | 'hourly-production'
  | 'line-efficiency'
  | 'attendance'
  | 'rework-rejection'
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
    { value: 'time-loss', label: 'Time loss' },
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
    'machine-output': { tab: 'line-efficiency', subView: '' },
  };
  if (legacy[raw]) {
    const migrated = legacy[raw];
    const tab = normalizeVisibleReportTab(migrated.tab);
    return {
      tab,
      subView: tab === migrated.tab ? migrated.subView : defaultSubViewFor(tab),
    };
  }
  const tab = normalizeVisibleReportTab(raw as ReportType);
  return { tab, subView: defaultSubViewFor(tab) };
};

const REPORT_OPTIONS: { value: ReportType; label: string; icon: React.ReactNode; color: string; keywords?: string }[] = [
  { value: 'hourly-production', label: 'Hourly Production', icon: <Clock className="h-5 w-5" />, color: 'blue' },
  { value: 'line-efficiency', label: 'Line & Process Efficiency', icon: <BarChart2 className="h-5 w-5" />, color: 'green' },
  { value: 'attendance', label: 'Attendance', icon: <Users className="h-5 w-5" />, color: 'purple', keywords: 'register vs output production' },
  { value: 'rework-rejection', label: 'Rework & Rejection', icon: <AlertTriangle className="h-5 w-5" />, color: 'yellow' },
  { value: 'employee', label: 'Employee Reports', icon: <UserCheck className="h-5 w-5" />, color: 'teal', keywords: 'output performance efficiency grade' },
  { value: 'idle-stoppages', label: 'Time Loss & Stoppages', icon: <Wrench className="h-5 w-5" />, color: 'orange', keywords: 'time loss cycle late start bottleneck breakdown M4 stoppage' },
  { value: 'time-loss-details', label: 'Time Loss Details', icon: <Clock className="h-5 w-5" />, color: 'indigo', keywords: 'time loss details daily inactive cycle machine gain insights' },
  { value: 'shift-summary', label: 'Shift Summary', icon: <BarChart2 className="h-5 w-5" />, color: 'slate' },
];

/** Temporarily hidden from the report picker — remove entries to re-enable. */
const HIDDEN_REPORT_TYPES: ReadonlySet<ReportType> = new Set(['attendance', 'employee']);
const SHOW_DAILY_INACTIVE_REPORT_CALLOUT = true;

const VISIBLE_REPORT_OPTIONS = REPORT_OPTIONS.filter((o) => !HIDDEN_REPORT_TYPES.has(o.value));
const DEFAULT_VISIBLE_REPORT_TYPE: ReportType = VISIBLE_REPORT_OPTIONS[0]?.value ?? 'hourly-production';

const normalizeVisibleReportTab = (tab: ReportType): ReportType =>
  HIDDEN_REPORT_TYPES.has(tab) || tab === 'time-loss-details' ? DEFAULT_VISIBLE_REPORT_TYPE : tab;

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
  const raw = String(d).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return raw;
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmtTime = (d: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
const r = (val: any) => Math.round(val ?? 0);

const effBadge = (val: number, large = false) => (
  <span
    className={`inline-flex items-center justify-center rounded font-bold leading-none ${
      large ? 'min-h-[2rem] min-w-[3.25rem] px-3 py-1.5 text-base' : 'px-2 py-0.5 text-xs'
    } ${val >= 90 ? 'bg-green-100 text-green-700' : val >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}
  >
    {val}%
  </span>
);

/** Period compare: this row first, comparison day second, then the gap. */
const CompareDeltaCell: React.FC<{
  current: unknown;
  previous: unknown;
  isPercent?: boolean;
  comparePeriod?: 'yesterday' | 'last_week';
}> = ({ current, previous, isPercent, comparePeriod = 'yesterday' }) => {
  const { delta, pct, hasPrevious } = computeCompareDelta(current, previous);
  if (!hasPrevious) return <span className="text-slate-400 text-xs">No prior day</span>;

  const cur = Math.round(numCompare(current));
  const prev = Math.round(numCompare(previous));
  const points = Math.abs(Math.round(delta));
  const improved = delta >= 0;
  const tone = improved ? 'text-emerald-700' : 'text-red-600';
  const unit = isPercent ? '%' : '';

  const tip = isPercent
    ? `This period: ${cur}%. Comparison day: ${prev}%. ${points} percentage point${points === 1 ? '' : 's'} ${improved ? 'higher' : 'lower'}.`
    : `This period: ${cur} pairs. Comparison day: ${prev} pairs. ${points} ${improved ? 'more' : 'fewer'}${pct !== null ? ` (${improved ? '+' : ''}${pct}% vs comparison day)` : ''}.`;

  return (
    <span className="inline-flex flex-col items-center gap-0.5 text-xs leading-snug max-w-[10rem]" title={tip}>
      <span className="text-slate-700 tabular-nums font-semibold whitespace-nowrap">
        {cur}
        {unit}
        <span className="text-slate-400 font-normal mx-0.5">vs</span>
        <span className="text-slate-500 font-medium">
          {prev}
          {unit}
        </span>
        <span className="text-[10px] text-slate-400 font-normal ml-0.5">
          {comparePeriodLabel(comparePeriod)}
        </span>
      </span>
      <span className={`font-semibold tabular-nums whitespace-nowrap ${tone}`}>
        {isPercent ? (
          <>
            {points} point{points === 1 ? '' : 's'} {improved ? 'up' : 'down'}
          </>
        ) : (
          <>
            {points} {improved ? 'more' : 'fewer'}
            {pct !== null && pct !== 0 && (
              <span className="text-slate-500 font-normal"> ({improved ? '+' : ''}{pct}%)</span>
            )}
          </>
        )}
      </span>
    </span>
  );
};

const formatNetBalanceLabel = (netMins: number) => {
  const parts = minutesToDurationParts(Math.abs(netMins));
  const status = Math.abs(netMins) * 60 < 1 ? 'neutral' : netMins > 0 ? 'gain' : 'loss';
  return { parts, status, text: `${formatDurationString(netMins)} ${status}` };
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
  pace_in_progress_actual: 'Speed actual',
  pace_in_progress_expected: 'Speed target so far',
  pace_daily_target: 'Speed daily target',
  emp_id: 'Emp ID', emp_name: 'Employee Name', emp_code: 'Emp Code', status: 'Status', login_time: 'Login Time',
  machine: 'Machine', output: 'Output', bins_completed: 'Bins', rework_qty: 'Rework',
  rejection_qty: 'Rejection', rework_percent: 'Rework %', rejection_percent: 'Rejection %',
  reason_category: 'Category', reason: 'Reason',
  machine_id: 'Machine ID', machine_name: 'Machine Name', target_mins: 'Target Mins',
  actual_mins: 'Actual Mins', idle_mins: 'Idle Mins', total_output_pairs: 'Output Pairs',
  target: 'EOD target',
  line_plan_target: 'Line plan target',
  line_plan_planned_qty: 'Line plan target',
  wip: 'Day WIP',
  performance_grade: 'Grade', boxes: 'Box', cycles: 'Cycles',
  routing_mins_per_box: 'Routing Mins/6 prs', shift_target_output: 'Shift Target (pairs)', shift_efficiency_pct: 'Shift Efficiency %',
  line_output_percent: 'Line Output %',
  start_time: 'Start', finish_time: 'Finish', duration_mins: 'Duration (mins)',
  m4_category: 'M4 Category', m4_reason: 'Reason', m4_notes: 'Notes', detail: 'Detail',
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

const HOURLY_HOUR_KEYS = ['9_10', '10_11', '11_12', '12_1', '2_3', '3_4', '4_5', '5_6', '6_7'] as const;
const HOURLY_HOUR_LABELS: Record<(typeof HOURLY_HOUR_KEYS)[number], string> = {
  '9_10': '9-10',
  '10_11': '10-11',
  '11_12': '11-12',
  '12_1': '12-1',
  '2_3': '2-3',
  '3_4': '3-4',
  '4_5': '4-5',
  '5_6': '5-6',
  '6_7': '6-7',
};
const HOURLY_PRODUCT_HEADERS = ['Customer', 'Article No', 'Color', 'Leather', 'Group'] as const;
const PRODUCT_FIELD_KEYS = ['customer', 'article_no', 'color', 'leather', 'group'] as const;
const supportsProductColumnToggle = (tab: ReportType) =>
  tab === 'hourly-production' || tab === 'line-efficiency';

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

/** Shift summary rows repeat line_eol_output on every machine — count each line+date once. */
const sumShiftSummaryEolOutput = (rows: any[]) => {
  const seen = new Set<string>();
  return rows.reduce((sum, row) => {
    const dateKey =
      row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date || '').slice(0, 10);
    const lineKey = row.work_centre_id ?? row.work_centre_name ?? '';
    const key = `${dateKey}|${lineKey}`;
    if (seen.has(key)) return sum;
    seen.add(key);
    return sum + (Number(row.line_eol_output) || 0);
  }, 0);
};

const computeReportSummaryStats = (rows: any[], apiReport: ApiReportType) => {
  if (!rows.length) return [];
  const sum = (key: string) => rows.reduce((s, row) => s + (Number(row[key]) || 0), 0);
  const avg = (key: string) => Math.round(rows.reduce((s, row) => s + (parseFloat(row[key]) || 0), 0) / rows.length);
  switch (apiReport) {
    case 'hourly-production':
      return [
        { label: 'Total output', value: sum('total_output') },
        { label: 'Total planned', value: sum('total_planned_qty') },
      ];
    case 'line-efficiency':
      return [
        { label: 'Rows', value: rows.length },
        { label: 'Avg efficiency', value: `${avg('efficiency_percent')}%` },
        { label: 'Total output', value: sum('total_output') },
      ];
    case 'attendance': {
      const present = rows.filter((r) => r.status === 'Present').length;
      return [
        { label: 'Present', value: present },
        { label: 'Absent', value: rows.length - present },
        { label: 'Attendance rate', value: `${Math.round((present / rows.length) * 100)}%` },
      ];
    }
    case 'rework-rejection':
      return [
        { label: 'Rework qty', value: sum('rework_qty') },
        { label: 'Rejection qty', value: sum('rejection_qty') },
        { label: 'Output', value: sum('output') },
      ];
    case 'employee-output':
      return [{ label: 'Total output', value: sum('total_output') }, { label: 'Employees', value: rows.length }];
    case 'employee-performance':
      return [
        { label: 'Total output', value: sum('output') },
        { label: 'Avg efficiency', value: `${avg('efficiency_percent')}%` },
        { label: 'Records', value: rows.length },
      ];
    case 'attendance-production':
      return [
        { label: 'Sessions', value: rows.length },
        { label: 'Zero output', value: rows.filter((row) => Number(row.total_output) === 0).length },
        { label: 'Total output', value: sum('total_output') },
      ];
    case 'time-loss': {
      const netTotal = Math.round(rows.reduce((s, row) => s + Number(row.net_mins || 0), 0) * 100) / 100;
      const lossRows = rows.filter((row) => row.net_status === 'loss').length;
      return [
        { label: 'Machines', value: rows.length },
        { label: 'With time loss', value: lossRows },
        { label: 'Net balance', value: `${netTotal}m` },
      ];
    }
    case 'shift-summary':
      return [
        { label: 'Total output (EOL)', value: sumShiftSummaryEolOutput(rows) },
        { label: 'Cycles', value: sum('cycles') },
        { label: 'Avg shift eff.', value: `${avg('shift_efficiency_pct')}%` },
      ];
    case 'bottleneck':
    case 'breakdown':
      return [
        { label: 'Events', value: rows.length },
        { label: 'Total duration', value: `${sum('duration_mins')}m` },
        { label: 'In progress', value: rows.filter((r) => r.status === 'In progress').length },
      ];
    default:
      return [{ label: 'Rows', value: rows.length }];
  }
};

const formatExportCellValue = (key: string, value: unknown, fmtDateFn: (d: string) => string): string => {
  if (value == null || value === '') return '—';
  if (key === 'date' || key.endsWith('_date')) return fmtDateFn(String(value));
  return String(value);
};

export const Reports: React.FC = () => {
  // Restore report tab from URL params or sessionStorage on mount to survive page refresh
  const initialState = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlReportType = params.get('reportType');
      const urlSubView = params.get('subView');
      const urlFromDate = params.get('fromDate');
      const urlToDate = params.get('toDate');
      const urlPreset = params.get('datePreset') as DatePreset | null;
      const urlLine = params.get('workCentreId');
      const urlMachine = params.get('machineId');
      const urlSearch = params.get('search');
      const urlLimit = params.get('limit');

      if (urlReportType) {
        const migrated = migrateReportTab(urlReportType);
        const subViews = REPORT_SUB_VIEWS[migrated.tab];
        const validSub = urlSubView && subViews?.some((s) => s.value === urlSubView) ? urlSubView : migrated.subView;
        const range = urlFromDate && urlToDate ? { from: urlFromDate, to: urlToDate } : getPresetRange(urlPreset || 'today');
        return {
          reportType: migrated.tab,
          reportSubView: validSub,
          fromDate: range.from,
          toDate: range.to,
          datePreset: urlPreset || 'today' as DatePreset,
          selectedLine: urlLine || '',
          selectedMachine: urlMachine || '',
          search: urlSearch || '',
          limit: urlLimit && !Number.isNaN(Number(urlLimit)) ? Number(urlLimit) : 10,
        };
      }

      // Fallback to sessionStorage
      const session = sessionStorage.getItem('reports_active_tab');
      if (session) {
        const saved = JSON.parse(session);
        const migrated = migrateReportTab(saved.reportType || '');
        const subViews = REPORT_SUB_VIEWS[migrated.tab];
        const validSub = saved.reportSubView && subViews?.some((s: any) => s.value === saved.reportSubView) ? saved.reportSubView : migrated.subView;
        return {
          reportType: migrated.tab,
          reportSubView: validSub,
          fromDate: saved.fromDate || getPresetRange('today').from,
          toDate: saved.toDate || getPresetRange('today').to,
          datePreset: saved.datePreset || 'today' as DatePreset,
          selectedLine: saved.selectedLine || '',
          selectedMachine: saved.selectedMachine || '',
          search: saved.search || '',
          limit: saved.limit || 10,
        };
      }
    } catch { /* ignore */ }
    const range = getPresetRange('today');
    return {
      reportType: DEFAULT_VISIBLE_REPORT_TYPE,
      reportSubView: defaultSubViewFor(DEFAULT_VISIBLE_REPORT_TYPE),
      fromDate: range.from,
      toDate: range.to,
      datePreset: 'today' as DatePreset,
      selectedLine: '',
      selectedMachine: '',
      search: '',
      limit: 10,
    };
  }, []);

  const [fromDate, setFromDate] = React.useState(initialState.fromDate);
  const [toDate, setToDate] = React.useState(initialState.toDate);
  const [datePreset, setDatePreset] = React.useState<DatePreset>(initialState.datePreset);
  const [reportType, setReportType] = React.useState<ReportType>(initialState.reportType);
  const [reportSubView, setReportSubView] = React.useState<ReportSubView>(initialState.reportSubView);
  const apiReportType = React.useMemo(
    () => resolveApiReportType(reportType, reportSubView),
    [reportType, reportSubView]
  );
  const [workCentres, setWorkCentres] = React.useState<any[]>([]);
  const [machines, setMachines] = React.useState<any[]>([]);
  const [selectedLine, setSelectedLine] = React.useState(initialState.selectedLine);
  const [selectedMachine, setSelectedMachine] = React.useState(initialState.selectedMachine);
  const [search, setSearch] = React.useState(initialState.search);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(initialState.limit);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [data, setData] = React.useState<any[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExportLoading, setIsExportLoading] = React.useState(false);
  const [exportFormatLoading, setExportFormatLoading] = React.useState<'csv' | 'excel' | 'pdf' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [lastReportGeneratedAt, setLastReportGeneratedAt] = React.useState<Date | null>(null);
  const [isShareLoading, setIsShareLoading] = React.useState(false);
  const [isSavingShare, setIsSavingShare] = React.useState(false);
  const [forceShareCapture, setForceShareCapture] = React.useState(false);
  const [preparedShare, setPreparedShare] = React.useState<{
    previewUrl: string;
    file: File;
    caption: string;
    canvas: HTMLCanvasElement;
    filename: string;
  } | null>(null);
  const preparedShareRef = React.useRef<typeof preparedShare>(null);
  const [reportTypeQuery, setReportTypeQuery] = React.useState('');
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  /** Hourly report: hide Customer/Article/etc. by default to reduce horizontal scroll. */
  const [showProductDetails, setShowProductDetails] = React.useState(false);
  const [compareMode, setCompareMode] = React.useState<ReportCompareMode>('none');
  const [compareMaps, setCompareMaps] = React.useState<{
    yesterday?: Map<string, any>;
    lastWeek?: Map<string, any>;
  } | null>(null);
  const [compareLoading, setCompareLoading] = React.useState(false);
  const reportTableRef = React.useRef<HTMLDivElement>(null);

  const closePreparedShare = React.useCallback(() => {
    const current = preparedShareRef.current;
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    preparedShareRef.current = null;
    setPreparedShare(null);
  }, []);

  React.useEffect(() => () => closePreparedShare(), [closePreparedShare]);

  React.useEffect(() => {
    if (!showExportMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExportMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showExportMenu]);

  const saveShareImageOnly = React.useCallback(
    async (share: NonNullable<typeof preparedShare>) => {
      setIsSavingShare(true);
      try {
        toast.loading('Saving image…', { id: 'share-save' });
        await downloadShareFile(share.file, isMobile);
        toast.success(
          `Saved ${share.file.name}. Open WhatsApp → attach from Downloads → Send.`,
          { id: 'share-save', duration: 14000 }
        );
        closePreparedShare();
      } catch {
        toast.error('Could not save image', { id: 'share-save' });
      } finally {
        setIsSavingShare(false);
      }
    },
    [closePreparedShare, isMobile]
  );

  /**
   * Opens the phone's share sheet (WhatsApp icon in the list) — same as sharing a photo.
   * Must run directly from this button tap.
   */
  const sharePreparedReport = () => {
    const share = preparedShareRef.current;
    if (!share) return;

    if (!canAttemptNativeShare()) {
      void saveShareImageOnly(share);
      return;
    }

    navigator
      .share({ files: [share.file] })
      .then(() => {
        closePreparedShare();
        toast.success('Pick WhatsApp from the list, then send the photo.', { duration: 8000 });
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        toast.error(
          window.isSecureContext
            ? 'Share failed — saving to Downloads instead'
            : 'Share needs HTTPS — saving to Downloads instead',
          { id: 'share-save' }
        );
        void saveShareImageOnly(share);
      });
  };
  const supportsPeriodCompare =
    reportType === 'hourly-production' || reportType === 'line-efficiency';
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
    // Restore compareMode from localStorage (other state is handled by initialState)
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.compareMode) setCompareMode(saved.compareMode);
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
        compareMode,
      })
    );

    // Save to sessionStorage so refresh always restores the active tab
    sessionStorage.setItem('reports_active_tab', JSON.stringify({
      reportType,
      reportSubView,
      fromDate,
      toDate,
      datePreset,
      selectedLine,
      selectedMachine,
      search,
      limit,
    }));

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

  const buildReportParams = React.useCallback((opts?: {
    page?: number;
    limit?: number;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const params = new URLSearchParams({
      fromDate: opts?.fromDate ?? fromDate,
      toDate: opts?.toDate ?? toDate,
      page: String(opts?.page ?? page),
      limit: String(opts?.limit ?? limit),
    });
    if (selectedLine) params.set('workCentreId', selectedLine);
    if (reportType === 'hourly-production' && selectedMachine) params.set('machineId', selectedMachine);
    const s = opts?.search !== undefined ? opts.search : search;
    if (s.trim()) params.set('search', s.trim());
    return params;
  }, [fromDate, toDate, page, limit, selectedLine, reportType, selectedMachine, search]);

  const fetchAllRowsForDateRange = React.useCallback(
    async (rangeFrom: string, rangeTo: string, searchVal: string) => {
      const exportLimit = 500;
      const firstParams = buildReportParams({
        page: 1,
        limit: exportLimit,
        search: searchVal,
        fromDate: rangeFrom,
        toDate: rangeTo,
      });
      const firstRes = await apiFetch(`${API_BASE}/api/reports/${apiReportType}?${firstParams}`);
      const first = await firstRes.json();
      if (!first.success) throw new Error(first.error || 'Failed to load compare period');
      let allRows = [...(first.data || [])];
      const totalPages = first.pagination?.totalPages || 1;
      for (let p = 2; p <= totalPages; p++) {
        const params = buildReportParams({
          page: p,
          limit: exportLimit,
          search: searchVal,
          fromDate: rangeFrom,
          toDate: rangeTo,
        });
        const res = await apiFetch(`${API_BASE}/api/reports/${apiReportType}?${params}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || `Failed on compare page ${p}`);
        allRows = allRows.concat(json.data || []);
      }
      return normalizeReportRows(allRows, apiReportType);
    },
    [apiReportType, buildReportParams]
  );

  const loadCompareMaps = React.useCallback(
    async (mode: ReportCompareMode, searchVal: string) => {
      if (mode === 'none' || !supportsPeriodCompare) {
        setCompareMaps(null);
        return;
      }
      setCompareLoading(true);
      try {
        const keyFn =
          apiReportType === 'hourly-production' ? hourlyCompareKey : lineEffCompareKey;
        const maps: { yesterday?: Map<string, any>; lastWeek?: Map<string, any> } = {};
        if (mode === 'yesterday' || mode === 'both') {
          const rows = await fetchAllRowsForDateRange(
            addDaysToDateKey(fromDate, -1),
            addDaysToDateKey(toDate, -1),
            searchVal
          );
          maps.yesterday = indexCompareRows(rows, keyFn, 1);
        }
        if (mode === 'last_week' || mode === 'both') {
          const rows = await fetchAllRowsForDateRange(
            addDaysToDateKey(fromDate, -7),
            addDaysToDateKey(toDate, -7),
            searchVal
          );
          maps.lastWeek = indexCompareRows(rows, keyFn, 7);
        }
        setCompareMaps(maps);
      } catch (e: any) {
        setCompareMaps(null);
        toast.error(e?.message || 'Could not load comparison period');
      } finally {
        setCompareLoading(false);
      }
    },
    [supportsPeriodCompare, apiReportType, fetchAllRowsForDateRange, fromDate, toDate]
  );

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
      if (compareMode !== 'none' && supportsPeriodCompare) {
        void loadCompareMaps(compareMode, currentSearch.trim());
      } else {
        setCompareMaps(null);
      }
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
        if (compareMode !== 'none' && supportsPeriodCompare) {
          void loadCompareMaps(compareMode, search.trim());
        } else {
          setCompareMaps(null);
        }
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setIsLoading(false));
  };

  React.useEffect(() => {
    if (compareMode === 'none' || !data?.length || !supportsPeriodCompare) {
      if (compareMode === 'none') setCompareMaps(null);
      return;
    }
    void loadCompareMaps(compareMode, search.trim());
  }, [compareMode, data?.length, supportsPeriodCompare, loadCompareMaps, search]);

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
    setExportFormatLoading('csv');
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
      setExportFormatLoading(null);
      setIsExportLoading(false);
    }
  };

  const exportExcel = async () => {
    setIsExportLoading(true);
    setExportFormatLoading('excel');
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
      setExportFormatLoading(null);
      setIsExportLoading(false);
    }
  };

  const exportPDF = async () => {
    setIsExportLoading(true);
    setExportFormatLoading('pdf');
    try {
      toast.loading('Building PDF…', { id: 'export-pdf' });
      const { rows: exportRows } = await fetchAllRowsForExport();
      if (!exportRows || exportRows.length === 0) {
        toast.error('No data to export', { id: 'export-pdf' });
        return;
      }
      const headers = Object.keys(stripExportFields(exportRows[0], apiReportType));
      const headerLabels = headers.map((h) => reportColumnLabel(h, apiReportType));
      const tableRows = exportRows.map((row) => {
        const filtered = stripExportFields(row, apiReportType);
        return headers.map((h) => formatExportCellValue(h, filtered[h], fmtDate));
      });
      const subLabel = REPORT_SUB_VIEWS[reportType]?.find((s) => s.value === reportSubView)?.label;
      const dateRange =
        fromDate === toDate ? fmtDate(fromDate) : `${fmtDate(fromDate)} — ${fmtDate(toDate)}`;
      const filterLines: string[] = [];
      if (selectedLine) {
        filterLines.push(
          `Line: ${workCentres.find((w) => String(w.id) === String(selectedLine))?.name || selectedLine}`
        );
      }
      if (reportType === 'hourly-production') {
        filterLines.push(selectedMachine ? `Machine: ${selectedMachine}` : 'Machine: End-of-line (07)');
      }
      if (search.trim()) filterLines.push(`Search: ${search.trim()}`);

      downloadReportPdf({
        meta: {
          title: activeOption.label,
          subtitle: subLabel,
          dateRange,
          filters: filterLines,
          rowCount: exportRows.length,
          generatedAt: new Date().toLocaleString('en-GB'),
          themeColor: activeOption.color,
          summaryStats: computeReportSummaryStats(exportRows, apiReportType),
        },
        headerLabels,
        rows: tableRows,
        filename: `${apiReportType}_${fromDate}_${toDate}.pdf`,
      });
      toast.success('PDF downloaded', { id: 'export-pdf' });
    } catch (e: any) {
      toast.error(e.message || 'PDF export failed', { id: 'export-pdf' });
    } finally {
      setExportFormatLoading(null);
      setIsExportLoading(false);
    }
  };

  const shareViaWhatsApp = async () => {
    if (!reportTableRef.current) return;
    setIsShareLoading(true);
    try {
      flushSync(() => setForceShareCapture(true));
      await waitForPaint();

      const captureScale = getShareCaptureScale(isMobile);
      const captureWidth = isMobile ? SHARE_CAPTURE_MOBILE_WIDTH : SHARE_CAPTURE_DESKTOP_WIDTH;
      const tableCanvas = await html2canvas(reportTableRef.current, {
        scale: captureScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: captureWidth,
        windowWidth: captureWidth,
        scrollX: 0,
        scrollY: 0,
        onclone: (_doc, clonedEl) => {
          const node = clonedEl as HTMLElement;
          node.style.position = 'static';
          node.style.left = '0';
          node.style.top = '0';
          node.style.opacity = '1';
          node.style.visibility = 'visible';
          node.style.zIndex = 'auto';
          node.style.width = `${captureWidth}px`;
          node.style.maxWidth = `${captureWidth}px`;
        },
      });
      const dateLabel = fromDate === toDate ? fmtDate(fromDate) : `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;
      const lineName =
        selectedLine && workCentres.length > 0
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

      const shareCanvas = buildReportShareCanvas(tableCanvas, messageText, captureScale);

      const filename = `${activeOption.label.replace(/\s+/g, '_')}_${fromDate}.png`;
      const file = await createShareImageFile(shareCanvas, filename, 'image/png');
      if (!file) {
        toast.error('Failed to create report image');
        return;
      }

      // Capture is slow — always show a second tap (share sheet or save). Never auto-open WhatsApp with text.
      closePreparedShare();
      const previewUrl = URL.createObjectURL(file);
      const next = { previewUrl, file, caption: messageText, canvas: shareCanvas, filename: file.name };
      preparedShareRef.current = next;
      setPreparedShare(next);
    } catch {
      toast.error('Failed to capture screenshot');
    } finally {
      setForceShareCapture(false);
      setIsShareLoading(false);
    }
  };

  const activeOption = VISIBLE_REPORT_OPTIONS.find((o) => o.value === reportType) ?? VISIBLE_REPORT_OPTIONS[0];
  const activeColor = COLOR_MAP[activeOption?.color ?? 'blue'];
  const lineBadgeClass = LINE_BADGE[activeOption?.color ?? 'blue'] || LINE_BADGE.slate;

  const activeSubViewLabel = REPORT_SUB_VIEWS[reportType]?.find((s) => s.value === reportSubView)?.label;

  const filterLabelClass =
    'mb-1 block text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500';
  const filterInputClass =
    'w-full rounded-lg sm:rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 py-2 sm:py-2.5 text-sm shadow-sm transition-shadow focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25';
  const presetBtnClass = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
      active
        ? `${activeColor.activeBg} ${activeColor.activeText} border-transparent shadow-sm`
        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 shadow-sm'
    }`;
  const actionBtnBase =
    'inline-flex items-center justify-center gap-2 rounded-xl min-h-[2.5rem] px-4 py-2 text-sm font-semibold shadow-sm transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryBtnClass = `${actionBtnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
  const exportBtnClass = `${actionBtnBase} border border-slate-700 bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-300`;

  const selectReportTab = (tab: ReportType) => {
    if (tab === 'time-loss-details') {
      window.location.href = '/missed_actions?tab=daily';
      return;
    }
    setReportType(tab);
    setReportSubView(defaultSubViewFor(tab));
    setData(null);
    setError(null);
    setPage(1);
    setSearch('');
    if (tab !== 'hourly-production' && tab !== 'line-efficiency') {
      setCompareMode('none');
      setCompareMaps(null);
    }
  };

  const comparePeriods = React.useMemo((): ('yesterday' | 'last_week')[] => {
    if (compareMode === 'both') return ['yesterday', 'last_week'];
    if (compareMode === 'yesterday') return ['yesterday'];
    if (compareMode === 'last_week') return ['last_week'];
    return [];
  }, [compareMode]);

  const showPeriodCompare = compareMode !== 'none' && comparePeriods.length > 0;

  const rowCompareKey = React.useCallback(
    (row: any) => (apiReportType === 'hourly-production' ? hourlyCompareKey(row) : lineEffCompareKey(row)),
    [apiReportType]
  );

  const selectReportSubView = (sub: ReportSubView) => {
    setReportSubView(sub);
    setData(null);
    setError(null);
    setPage(1);
  };

  const filteredReportOptions = React.useMemo(() => {
    const q = reportTypeQuery.trim().toLowerCase();
    const base = VISIBLE_REPORT_OPTIONS;
    if (!q) return base;
    return base.filter((o) => {
      const hay = `${o.label} ${o.keywords || ''}`.toLowerCase();
      if (hay.includes(q)) return true;
      const subs = REPORT_SUB_VIEWS[o.value];
      return subs?.some((s) => s.label.toLowerCase().includes(q)) ?? false;
    });
  }, [reportTypeQuery]);

  const reportSummaryStats = React.useMemo(() => {
    if (!data?.length) return [];
    const stats = computeReportSummaryStats(data, apiReportType);
    if (stats.length === 1 && stats[0].label === 'Rows') {
      return [{ label: 'Rows on page', value: data.length }];
    }
    return stats;
  }, [data, apiReportType]);

  const LineBadge = ({ name }: { name: string }) => (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset ${lineBadgeClass}`}>{name}</span>
  );

  const Th = ({
    children,
    center,
    stickyLeft,
    stickyZ = 20,
  }: {
    children: React.ReactNode;
    center?: boolean;
    stickyLeft?: number;
    stickyZ?: number;
  }) => (
    <th
      style={stickyLeft != null ? { left: stickyLeft } : undefined}
      className={`px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap bg-slate-50/95 border-b border-slate-200 sticky top-0 backdrop-blur-sm ${
        center ? 'text-center' : 'text-left'
      } ${stickyLeft != null ? `${stickyZ >= 30 ? 'z-30' : 'z-20'} border-r border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]` : 'z-10'}`}
    >
      {children}
    </th>
  );
  const Td = ({
    children,
    center,
    muted,
    title,
    stickyLeft,
    stickyZ = 10,
    rowShade,
  }: {
    children: React.ReactNode;
    center?: boolean;
    muted?: boolean;
    title?: string;
    stickyLeft?: number;
    stickyZ?: number;
    rowShade?: boolean;
  }) => (
    <td
      title={title}
      style={stickyLeft != null ? { left: stickyLeft } : undefined}
      className={`px-3 py-2.5 text-sm whitespace-nowrap ${center ? 'text-center' : ''} ${muted ? 'text-slate-400' : 'text-slate-700'} ${
        stickyLeft != null
          ? `sticky ${stickyZ >= 20 ? 'z-20' : 'z-10'} border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${rowShade ? 'bg-slate-50/90' : 'bg-white'}`
          : ''
      }`}
    >
      {children}
    </td>
  );

  const TableWrap = ({ children }: { children: React.ReactNode }) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [scrollHint, setScrollHint] = React.useState({ canScroll: false, atStart: true, atEnd: true });

    const updateScrollHint = React.useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      const canScroll = el.scrollWidth > el.clientWidth + 2;
      setScrollHint({
        canScroll,
        atStart: el.scrollLeft <= 2,
        atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
    }, []);

    React.useEffect(() => {
      updateScrollHint();
      const el = scrollRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => updateScrollHint());
      ro.observe(el);
      return () => ro.disconnect();
    }, [data, updateScrollHint, showProductDetails]);

    return (
      <div className="relative">
        {scrollHint.canScroll && !scrollHint.atStart && (
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 z-[25] w-10 bg-gradient-to-r from-white via-white/80 to-transparent"
            aria-hidden
          />
        )}
        {scrollHint.canScroll && !scrollHint.atEnd && (
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 z-[25] w-10 bg-gradient-to-l from-white via-white/80 to-transparent"
            aria-hidden
          />
        )}
        <div
          ref={scrollRef}
          onScroll={updateScrollHint}
          className="overflow-x-auto scroll-smooth [scrollbar-width:thin]"
        >
          {children}
        </div>
      </div>
    );
  };

  const renderReportKpis = () => {
    if (!reportSummaryStats.length) return null;
    const shareKpi = forceShareCapture && isMobile;
    return (
      <div
        className={`grid gap-1.5 sm:gap-2 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 ${
          shareKpi
            ? 'grid-cols-2 gap-3 py-4'
            : 'grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3'
        }`}
      >
        {reportSummaryStats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-lg sm:rounded-xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-inset ring-white ${activeColor.border} ${
              shareKpi ? 'px-4 py-3' : 'px-2 sm:px-3 py-2 sm:py-2.5'
            }`}
            style={{ borderLeftWidth: 3 }}
          >
            <p
              className={`font-bold uppercase tracking-[0.14em] text-slate-500 ${
                shareKpi ? 'text-xs' : 'text-[9px] sm:text-[10px]'
              }`}
            >
              {stat.label}
            </p>
            <p
              className={`mt-0.5 font-black tabular-nums leading-none ${activeColor.text} ${
                shareKpi ? 'text-3xl' : 'text-lg sm:text-2xl'
              }`}
            >
              {stat.value}
            </p>
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
    if (supportsPeriodCompare && compareMode !== 'none') {
      const labels: Record<ReportCompareMode, string> = {
        none: '',
        yesterday: 'vs Yesterday',
        last_week: 'vs Same day last week',
        both: 'vs Yesterday & last week',
      };
      chips.push(`Compare: ${labels[compareMode]}`);
    }
    return chips;
  }, [selectedLine, selectedMachine, search, reportType, workCentres, supportsPeriodCompare, compareMode]);

  const renderMobileCards = () => {
    if (!data || data.length === 0) return null;
    const columnsByType: Partial<Record<ApiReportType, string[]>> = {
      'hourly-production': [
        'date',
        'line',
        ...(showProductDetails ? PRODUCT_FIELD_KEYS : []),
        'total_planned_qty',
        'total_input',
        'input_percent',
        'total_output',
        'output_percent',
        ...HOURLY_HOUR_KEYS,
      ],
      'line-efficiency': [
        'date',
        'line',
        'process',
        ...(showProductDetails ? PRODUCT_FIELD_KEYS : []),
        'total_planned_qty',
        'total_output',
        'output_percent',
        'efficiency_percent',
      ],
      'attendance': ['date', 'line', 'emp_code', 'emp_name', 'status', 'login_time'],
      'rework-rejection': ['date', 'line', 'machine', 'target', 'output', 'output_percent', 'rework_qty', 'rejection_qty'],
      'employee-output': ['date', 'line', 'emp_code', 'target', 'total_output', 'output_percent'],
      'employee-performance': ['date', 'line', 'emp_code', 'target', 'output', 'output_percent', 'efficiency_percent'],
      bottleneck: ['date', 'line', 'machine_id', 'emp_id', 'status', 'duration_mins', 'm4_category', 'm4_reason'],
      breakdown: ['date', 'line', 'machine_id', 'emp_id', 'status', 'duration_mins', 'm4_category', 'm4_reason'],
      'time-loss': ['date', 'line', 'machine_id', 'machine_name', 'net_mins', 'net_status', 'time_loss_reason'],
      'attendance-production': ['date', 'emp_code', 'work_centre_name', 'target', 'output_percent', 'total_output', 'status'],
      'shift-summary': ['date', 'machine_id', 'shift_target_output', 'total_output', 'shift_efficiency_pct'],
    };
    const baseKeys = columnsByType[apiReportType] || Object.keys(data[0] || {}).slice(0, 8);
    const keys: string[] = [];
    baseKeys.forEach((k) => {
      keys.push(k);
      if (!showPeriodCompare) return;
      if (k === 'total_output') {
        comparePeriods.forEach((p) => keys.push(`__cmp_out_${p}`));
      }
      if (k === 'output_percent') {
        comparePeriods.forEach((p) => keys.push(`__cmp_outpct_${p}`));
      }
      if (k === 'efficiency_percent') {
        comparePeriods.forEach((p) => keys.push(`__cmp_eff_${p}`));
      }
    });
    const shareCard = forceShareCapture && isMobile;
    return (
      <div className={shareCard ? 'space-y-4 bg-slate-50/80 p-4' : 'space-y-3 p-3'}>
        {data.map((row, i) => (
          <div
            key={i}
            className={`overflow-hidden rounded-xl border bg-white shadow-sm border-l-4 ${activeColor.border} ${
              shareCard ? 'shadow-md' : 'hover:shadow-md transition-shadow'
            }`}
          >
            <div
              className={`${activeColor.activeBg} ${
                shareCard
                  ? 'flex flex-col items-stretch gap-1.5 px-4 py-3'
                  : 'flex items-center justify-between gap-2 px-3 py-2.5'
              }`}
            >
              <span className={`font-bold text-white ${shareCard ? 'text-base' : 'text-xs'}`}>
                {fmtDate(row.date) || '—'}
              </span>
              {(row.line || row.work_centre_name) && (
                <span
                  className={
                    shareCard
                      ? 'text-base font-semibold leading-snug text-white/90 break-words'
                      : 'max-w-[60%] truncate text-xs font-semibold text-white/90'
                  }
                >
                  {shareCard ? `Line: ${row.line || row.work_centre_name}` : row.line || row.work_centre_name}
                </span>
              )}
            </div>
            <div className={shareCard ? 'space-y-0 p-4' : 'space-y-0 p-3'}>
              {keys.filter((k) => k !== 'date' && k !== 'line' && k !== 'work_centre_name').map((key, ki) => {
                if (key.startsWith('__cmp_')) {
                  const [, metric, period] = key.match(/^__cmp_(out|outpct|eff)_(yesterday|last_week)$/) || [];
                  const metricKey =
                    metric === 'out' ? 'total_output' : metric === 'outpct' ? 'output_percent' : 'efficiency_percent';
                  const map =
                    period === 'yesterday' ? compareMaps?.yesterday : compareMaps?.lastWeek;
                  const prev = map?.get(rowCompareKey(row))?.[metricKey];
                  return (
                    <div key={key} className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0 bg-violet-50/50 -mx-1 px-1 rounded">
                      <span className="text-xs font-semibold text-violet-600">
                        {metricKey === 'total_output' ? 'Output' : metricKey === 'output_percent' ? 'Out %' : 'Eff %'} vs{' '}
                        {comparePeriodHeaderLabel(period as 'yesterday' | 'last_week')}
                      </span>
                      <CompareDeltaCell
                        current={row[metricKey]}
                        previous={prev}
                        isPercent={metricKey !== 'total_output'}
                        comparePeriod={period as 'yesterday' | 'last_week'}
                      />
                    </div>
                  );
                }
                let value: any = row[key];
                if (key === 'login_time') value = fmtTime(value);
                if (HOURLY_HOUR_KEYS.includes(key as (typeof HOURLY_HOUR_KEYS)[number])) {
                  value = r(value) || '0';
                }
                if (key === 'input_percent' || key === 'output_percent' || key === 'shift_efficiency_pct') {
                  value =
                    key === 'shift_efficiency_pct'
                      ? effBadge(r(value), shareCard)
                      : shareCard
                        ? effBadge(r(value), true)
                        : `${r(value)}%`;
                }
                if (key === 'efficiency_percent') value = effBadge(r(value), shareCard);
              if (key === 'net_mins') value = netBalanceBadge(Number(value));
              if (key === 'net_status') value = String(value);
                if (key === 'status' && value === 'Present') value = <span className="text-green-700 font-semibold">Present</span>;
                if (key === 'status' && value === 'Absent') value = <span className="text-red-600 font-semibold">Absent</span>;
                if (value === null || value === undefined || value === '') value = '—';
                return (
                  <div
                    key={key}
                    className={`flex justify-between border-b border-slate-100 last:border-b-0 ${
                      ki % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                    } ${
                      shareCard ? 'items-center gap-4 py-3 px-1' : 'items-start gap-3 py-2 px-1 rounded'
                    }`}
                  >
                    <span
                      className={`shrink-0 font-semibold text-indigo-600 ${
                        shareCard ? 'text-sm leading-snug' : 'text-xs'
                      }`}
                    >
                      {HOURLY_HOUR_KEYS.includes(key as (typeof HOURLY_HOUR_KEYS)[number])
                        ? HOURLY_HOUR_LABELS[key as (typeof HOURLY_HOUR_KEYS)[number]]
                        : reportColumnLabel(key, apiReportType)}
                    </span>
                    <span
                      className={`shrink-0 text-right ${
                        typeof value === 'object'
                          ? shareCard
                            ? 'flex items-center justify-end'
                            : ''
                          : shareCard
                            ? 'text-base font-bold text-slate-900'
                            : 'text-sm font-semibold text-slate-900'
                      }`}
                    >
                      {typeof value === 'object' ? value : String(value)}
                    </span>
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
                  <Td>{row.time_loss_reason?.trim() ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-200/80">
                      {row.time_loss_reason}
                    </span>
                  ) : '—'}</Td>
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

  const renderShiftSummary = () => {
    const eolOutputTotal = sumShiftSummaryEolOutput(data!);
    // Use pairs_per_tray from plan (returned by backend) for box calculation; fallback to 6 if not available
    const defaultPairsPerTray = data!.length > 0 ? (Number(data![0].pairs_per_tray) || 6) : 6;
    const eolBoxesTotal = eolOutputTotal > 0 ? Math.round(eolOutputTotal / defaultPairsPerTray) : 0;
    return (
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
              <Td center title={row.routing_mins_per_box ? `Routing: ${row.routing_mins_per_box} min / ${row.pairs_per_tray || 6} prs` : 'No routing'}>
                {row.shift_target_output != null && Number(row.shift_target_output) > 0 ? r(row.shift_target_output) : '—'}
              </Td>
              <Td center>{row.cycles ?? '—'}</Td>
              <Td center>
                <span className="font-semibold">
                  {row.boxes != null ? row.boxes : (Number(row.total_output || 0) > 0 ? Math.round(Number(row.total_output) / (Number(row.pairs_per_tray) || 6)) : 0)}
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
            <td className="px-3 py-2.5 text-sm font-bold text-center">{eolBoxesTotal}</td>
            <td className="px-3 py-2.5 text-sm font-bold">{eolOutputTotal}</td>
            <td className="px-3 py-2.5 text-sm font-bold">{data!.reduce((s: number, r: any) => s + Number(r.shift_actual_mins || 0), 0)}m</td>
            <td colSpan={2} className="px-3 py-2.5" />
          </tr>
        </tfoot>
      </table>
    </TableWrap>
    );
  };

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
      case 'employee-output':      return renderEmployeeOutput();
      case 'employee-performance': return renderEmployeePerformance();
      case 'time-loss':            return renderTimeLoss();
      case 'attendance-production':return renderAttendanceProduction();
      case 'shift-summary':        return renderShiftSummary();
      case 'bottleneck':           return renderStoppageReport('red');
      case 'breakdown':            return renderStoppageReport('amber');
    }
  };

  const renderCompareMetricCells = (
    row: any,
    metric: 'total_output' | 'output_percent' | 'efficiency_percent',
    shaded: boolean
  ) =>
    comparePeriods.map((period) => {
      const map = period === 'yesterday' ? compareMaps?.yesterday : compareMaps?.lastWeek;
      const prev = map?.get(rowCompareKey(row))?.[metric];
      return (
        <Td key={`${period}-${metric}`} center rowShade={shaded}>
          <CompareDeltaCell
            current={row[metric]}
            previous={prev}
            isPercent={metric !== 'total_output'}
            comparePeriod={period}
          />
        </Td>
      );
    });

  const renderHourly = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.total_output), 0);
    const totalPlanned = data!.reduce((s, row) => s + r(row.total_planned_qty), 0);
    const totalInput = data!.reduce((s, row) => s + r(row.total_input), 0);
    const metricHeaders: string[] = ['Planned', 'Input', 'Input %', 'Output'];
    if (showPeriodCompare) {
      comparePeriods.forEach((p) => metricHeaders.push(`Output vs ${comparePeriodHeaderLabel(p)}`));
    }
    metricHeaders.push('Output %');
    if (showPeriodCompare) {
      comparePeriods.forEach((p) => metricHeaders.push(`Out % vs ${comparePeriodHeaderLabel(p)}`));
    }
    metricHeaders.push('Day WIP', 'Avg/Hr');
    const hourHeaders = HOURLY_HOUR_KEYS.map((k) => HOURLY_HOUR_LABELS[k]);
    const productHeaders = showProductDetails ? [...HOURLY_PRODUCT_HEADERS] : [];
    const allHeaders = ['Date', 'Line', ...productHeaders, ...metricHeaders, ...hourHeaders];
    const leftAlign = new Set(['Date', 'Line', ...HOURLY_PRODUCT_HEADERS]);
    const labelColSpan = 2 + productHeaders.length;
    const stickyLineLeft = 96;

    return (
      <TableWrap>
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {allHeaders.map((h) => (
                <Th
                  key={h}
                  center={!leftAlign.has(h)}
                  stickyLeft={h === 'Date' ? 0 : h === 'Line' ? stickyLineLeft : undefined}
                  stickyZ={h === 'Date' || h === 'Line' ? 30 : 10}
                >
                  {h}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => {
              const wip = r(row.wip);
              const shaded = i % 2 === 1;
              return (
                <tr key={i} className="hover:bg-blue-50/30 even:bg-slate-50/30 transition-colors">
                  <Td stickyLeft={0} rowShade={shaded}>
                    <span className="font-medium text-slate-600">{fmtDate(row.date)}</span>
                  </Td>
                  <Td stickyLeft={stickyLineLeft} rowShade={shaded}>
                    <LineBadge name={row.line} />
                  </Td>
                  {showProductDetails && (
                    <>
                      <Td>{row.customer}</Td>
                      <Td>{row.article_no}</Td>
                      <Td>{row.color}</Td>
                      <Td>{row.leather}</Td>
                      <Td>{row.group}</Td>
                    </>
                  )}
                  <Td center>
                    <span className="font-semibold text-gray-700">{r(row.total_planned_qty)}</span>
                  </Td>
                  <Td center>
                    <span className="font-semibold text-blue-700">{r(row.total_input)}</span>
                  </Td>
                  <Td center>{effBadge(r(row.input_percent))}</Td>
                  <Td center>
                    <span className="font-bold text-green-600">{r(row.total_output)}</span>
                  </Td>
                  {showPeriodCompare && renderCompareMetricCells(row, 'total_output', shaded)}
                  <Td center>{effBadge(r(row.output_percent))}</Td>
                  {showPeriodCompare && renderCompareMetricCells(row, 'output_percent', shaded)}
                  <Td center>
                    <span className={`font-semibold ${wip > 0 ? 'text-red-500' : 'text-gray-400'}`}>{wip}</span>
                  </Td>
                  <Td center>{r(row.avg_hourly_output)}</Td>
                  {HOURLY_HOUR_KEYS.map((k) => (
                    <Td key={k} center>
                      <span className="text-gray-700">{r(row[k]) || '0'}</span>
                    </Td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-blue-600 text-white">
              <td colSpan={labelColSpan} className="sticky left-0 z-20 px-3 py-2.5 text-sm font-bold bg-blue-600 border-r border-blue-500">
                TOTAL — {data!.length} rows
              </td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalPlanned}</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalInput}</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">
                {totalPlanned > 0 ? effBadge(Math.round((totalInput / totalPlanned) * 100)) : '—'}
              </td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput}</td>
              {showPeriodCompare && comparePeriods.map((p) => (
                <td key={p} className="px-3 py-2.5 text-sm text-center text-blue-100/80">—</td>
              ))}
              <td className="px-3 py-2.5 text-sm font-bold text-center">
                {totalPlanned > 0 ? effBadge(Math.round((totalOutput / totalPlanned) * 100)) : '—'}
              </td>
              {showPeriodCompare && comparePeriods.map((p) => (
                <td key={`pct-${p}`} className="px-3 py-2.5 text-sm text-center text-blue-100/80">—</td>
              ))}
              <td className="px-3 py-2.5 text-sm text-center text-blue-100/80">—</td>
              <td colSpan={HOURLY_HOUR_KEYS.length + 1} />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
    );
  };

  const renderLineEfficiency = () => {
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    const productHeaders = showProductDetails ? [...HOURLY_PRODUCT_HEADERS] : [];
    const baseHeaders = ['Date', 'Line', 'Machine', ...productHeaders, 'EOD target', 'Output'];
    const lineHeaders: string[] = [...baseHeaders];
    if (showPeriodCompare) {
      comparePeriods.forEach((p) => lineHeaders.push(`Output vs ${comparePeriodHeaderLabel(p)}`));
    }
    lineHeaders.push('Output %');
    if (showPeriodCompare) {
      comparePeriods.forEach((p) => lineHeaders.push(`Out % vs ${comparePeriodHeaderLabel(p)}`));
    }
    lineHeaders.push('Std Mins', 'Actual Mins', 'Target@SMV', 'Efficiency % (in progress)');
    if (showPeriodCompare) {
      comparePeriods.forEach((p) => lineHeaders.push(`Eff % vs ${comparePeriodHeaderLabel(p)}`));
    }
    const leftCols = new Set(['Date', 'Line', 'Machine', ...HOURLY_PRODUCT_HEADERS]);
    const trailingCompareCols = showPeriodCompare ? comparePeriods.length : 0;
    return (
      <TableWrap>
        <table className="min-w-full">
          <thead><tr>
            {lineHeaders.map((h) => <Th key={h} center={!leftCols.has(h)}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data!.map((row, i) => {
              const rowShade = i % 2 === 1;
              return (
              <tr key={i} className="hover:bg-green-50/30 even:bg-slate-50/30 transition-colors">
                <Td><span className="font-medium text-slate-600">{fmtDate(row.date)}</span></Td>
                <Td><LineBadge name={row.line} /></Td>
                <Td><span className="font-medium">{row.process}</span></Td>
                {showProductDetails && (
                  <>
                    <Td>{row.customer}</Td>
                    <Td>{row.article_no}</Td>
                    <Td>{row.color}</Td>
                    <Td>{row.leather}</Td>
                    <Td>{row.group}</Td>
                  </>
                )}
                <Td center>{r(row.total_planned_qty)}</Td>
                <Td center><span className="font-bold text-green-600">{r(row.total_output)}</span></Td>
                {showPeriodCompare && renderCompareMetricCells(row, 'total_output', rowShade)}
                <Td center>{effBadge(r(row.output_percent))}</Td>
                {showPeriodCompare && renderCompareMetricCells(row, 'output_percent', rowShade)}
                <Td center>{r(row.total_standard_mins_value)}</Td>
                <Td center>{r(row.total_produced_mins_value)}</Td>
                <Td center>{r(row.targeted_output_smv)}</Td>
                <Td center>{effBadge(r(row.efficiency_percent))}</Td>
                {showPeriodCompare && renderCompareMetricCells(row, 'efficiency_percent', rowShade)}
              </tr>
            );})}
          </tbody>
          <tfoot>
            <tr className="bg-green-600 text-white">
              <td colSpan={lineHeaders.length - 1 - trailingCompareCols} className="px-3 py-2.5 text-sm font-bold">AVG EFFICIENCY — {data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{avgEff}%</td>
              {showPeriodCompare && comparePeriods.map((p) => (
                <td key={p} className="px-3 py-2.5 text-sm text-center text-green-100/80">—</td>
              ))}
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
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-200/40 via-slate-50 to-slate-100 p-2 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-3 sm:space-y-5">

        {/* Hero */}
        <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl">
          <div className={`h-1 ${activeColor.activeBg}`} />
          <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 sm:gap-4">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="rounded-xl sm:rounded-2xl bg-white/10 p-2 sm:p-3 ring-1 ring-white/15">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight sm:text-2xl">Reports</h1>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-300 hidden sm:block">Production analytics · export · share</p>
                <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold ring-1 ring-white/20 ${activeColor.activeBg} text-white`}>
                    <span className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center [&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-3.5 sm:[&>svg]:w-3.5">
                      {activeOption.icon}
                    </span>
                    {activeOption.label}
                    {activeSubViewLabel ? ` · ${activeSubViewLabel}` : ''}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-slate-200 ring-1 ring-white/10">
                    {fmtDate(fromDate)} — {fmtDate(toDate)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data && data.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg sm:rounded-xl bg-white/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm ring-1 ring-white/15">
                  <span className={`h-2 w-2 rounded-full ${activeColor.activeBg}`} />
                  <span className="font-semibold tabular-nums">
                    {data.length} / {pagination.total || data.length} rows
                  </span>
                </div>
              )}
              {lastReportGeneratedAt && (
                <span className="hidden text-xs text-slate-400 sm:inline">
                  Last run {lastReportGeneratedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* {SHOW_DAILY_INACTIVE_REPORT_CALLOUT && (
        <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Time Loss Details Report</p>
              <p className="text-xs text-slate-500">Detailed cycle-level time loss breakdown with insights, machine grouping, and PDF export.</p>
            </div>
          </div>
          <a
            href="/missed_actions?tab=daily"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            Open Time Loss Report
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
        )} */}

        {/* Report type picker */}
        <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Report type</p>
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={reportTypeQuery}
                  onChange={(e) => setReportTypeQuery(e.target.value)}
                  placeholder="Filter reports…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
                {reportTypeQuery && (
                  <button
                    type="button"
                    onClick={() => setReportTypeQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <span className="text-xs font-medium tabular-nums text-slate-400">
                {filteredReportOptions.length} / {VISIBLE_REPORT_OPTIONS.length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 overflow-hidden sm:flex sm:flex-wrap sm:gap-2.5 sm:overflow-x-auto sm:snap-x sm:snap-mandatory sm:[scrollbar-width:thin] sm:p-4">
            {filteredReportOptions.map((opt) => {
              const c = COLOR_MAP[opt.color];
              const hoverBg = HOVER_BG_MAP[opt.color] || 'hover:bg-slate-50';
              const isActive = reportType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectReportTab(opt.value)}
                  className={`min-w-0 flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition-all sm:snap-start sm:min-w-[118px] sm:max-w-[128px] sm:shrink-0 sm:gap-2 sm:rounded-2xl sm:p-3.5 ${
                    isActive
                      ? `${c.activeBg} ${c.activeText} border-transparent shadow-lg ring-2 ring-offset-1 ring-slate-200 sm:ring-offset-2`
                      : `border-slate-200/80 bg-white ${c.text} ${hoverBg} hover:border-slate-300 hover:shadow-md`
                  }`}
                >
                  <div className={`rounded-lg p-1.5 sm:rounded-xl sm:p-2 ${isActive ? 'bg-white/20 ring-1 ring-white/25' : c.bg}`}>
                    <span className="[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">{opt.icon}</span>
                  </div>
                  <span className="line-clamp-2 text-[9px] font-bold leading-tight tracking-tight sm:text-[11px]">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {filteredReportOptions.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">No reports match your search.</p>
          )}
        </div>

        {/* Filters */}
        <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className={`border-b border-slate-100 px-4 py-3 ${activeColor.bg}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className={`h-4 w-4 ${activeColor.text}`} />
              {reportType !== 'rework-rejection' && reportType !== 'idle-stoppages' && (
                <span className={`text-sm font-bold ${activeColor.text}`}>
                  {activeOption.label}{activeSubViewLabel ? ` · ${activeSubViewLabel}` : ''}
                </span>
              )}
              <span className={`text-xs font-medium ${(reportType === 'rework-rejection' || reportType === 'idle-stoppages') ? `text-sm font-bold ${activeColor.text}` : 'text-slate-500'}`}>Filters & actions</span>
            </div>
          </div>
          <div className="p-3 sm:p-5">
          {REPORT_SUB_VIEWS[reportType] && (
            <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
              <span className="w-full self-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:mr-1 sm:w-auto">
                View
              </span>
              {REPORT_SUB_VIEWS[reportType]!.map((sub) => (
                <button
                  key={sub.value}
                  type="button"
                  onClick={() => selectReportSubView(sub.value)}
                  className={presetBtnClass(reportSubView === sub.value)}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
          <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
            {([
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'last7', label: 'Last 7 days' },
              { key: 'thisMonth', label: 'This month' },
              { key: 'custom', label: 'Custom' },
            ] as { key: DatePreset; label: string }[]).map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyDatePreset(preset.key)}
                className={presetBtnClass(datePreset === preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 items-end gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div>
              <label className={filterLabelClass}>Line</label>
              <select value={selectedLine} onChange={(e) => setSelectedLine(e.target.value)} className={filterInputClass}>
                <option value="">All lines</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.name}
                  </option>
                ))}
              </select>
            </div>
            {reportType === 'hourly-production' && (
              <div>
                <label className={filterLabelClass}>Machine</label>
                <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} className={filterInputClass}>
                  <option value="">End-of-line (default)</option>
                  {filteredMachines.map((machine: any) => (
                    <option key={machine.id || machine.machine_id} value={machine.machine_id}>
                      {machine.machine_id}{' '}
                      {machine.machine_name || machine.name ? `- ${machine.machine_name || machine.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={`${filterLabelClass} flex items-center gap-1`}>
                <Calendar className="h-3 w-3" /> From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('custom');
                }}
                className={filterInputClass}
              />
            </div>
            <div>
              <label className={`${filterLabelClass} flex items-center gap-1`}>
                <Calendar className="h-3 w-3" /> To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('custom');
                }}
                className={filterInputClass}
              />
            </div>
            {supportsPeriodCompare && (
              <div>
                <label className={`${filterLabelClass} flex items-center gap-1`}>
                  <TrendingUp className="h-3 w-3" /> Compare
                </label>
                <select
                  value={compareMode}
                  onChange={(e) => setCompareMode(e.target.value as ReportCompareMode)}
                  className={filterInputClass}
                >
                  <option value="none">None</option>
                  <option value="yesterday">vs Yesterday</option>
                  <option value="last_week">vs Same day last week</option>
                  <option value="both">vs Both</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={filterLabelClass}>Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearch(val);
                    if (data !== null) {
                      if (searchTimeout.current) clearTimeout(searchTimeout.current);
                      searchTimeout.current = setTimeout(() => {
                        setPage(1);
                        fetchReport(1, val);
                      }, 500);
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && fetchReport(1, search)}
                  placeholder="Name, line, machine…"
                  className={`${filterInputClass} pl-9 pr-9`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      if (data !== null) fetchReport(1, '');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  fetchReport(1);
                }}
                disabled={isLoading || !!dateError}
                className={`inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 ${activeColor.activeBg} hover:opacity-90`}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
                Generate report
              </button>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
                <button
                  type="button"
                  onClick={shareViaWhatsApp}
                  disabled={!data || data.length === 0 || isShareLoading}
                  className={`${actionBtnBase} border border-[#1da851] bg-[#25D366] text-white hover:bg-[#20BD5A]`}
                >
                  {isShareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-4 w-4 shrink-0" />}
                  WhatsApp
                </button>
                <button type="button" onClick={clearAllFilters} className={`${actionBtnBase} border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100`}>
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(window.location.href)
                      .then(() => toast.success('Report link copied'))
                      .catch(() => toast.error('Could not copy link'));
                  }}
                  className={`${actionBtnBase} border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100`}
                >
                  <Copy className="h-4 w-4" /> Copy link
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(true)}
                  disabled={!data || data.length === 0 || isExportLoading}
                  className={exportBtnClass}
                >
                  {isExportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Exports include all filtered rows (not just this page).</span>
              <div className="flex flex-wrap items-center gap-2">
                {hasUnsavedReportFilterChanges && (
                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
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
            <div className="mt-4 flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <span
                  key={chip}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${lineBadgeClass}`}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 shadow-sm">
            <div className="text-center">
              <Loader2 className={`mx-auto mb-4 h-11 w-11 animate-spin ${activeColor.text}`} />
              <p className="font-bold text-slate-700">Generating {activeOption.label}…</p>
              <p className="mt-1 text-sm text-slate-400">
                {fmtDate(fromDate)} — {fmtDate(toDate)}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-4 h-14 w-14 text-red-400" />
            <h2 className="mb-1 text-lg font-bold text-red-800">Could not load report</h2>
            <p className="mx-auto max-w-md text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => fetchReport(page, search)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : data === null ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-24 text-center shadow-sm">
            <div className={`mb-4 rounded-2xl p-5 ring-4 ring-white shadow-inner ${activeColor.bg}`}>
              <div className={`scale-125 ${activeColor.text}`}>{activeOption.icon}</div>
            </div>
            <p className="text-lg font-bold text-slate-800">Ready to generate</p>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Set your filters above, then click <strong className="text-slate-700">Generate report</strong> for{' '}
              {activeOption.label}.
            </p>
            <p className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
              {fmtDate(fromDate)} <ChevronRight className="h-3 w-3" /> {fmtDate(toDate)}
            </p>
          </div>
        ) : (
          <div
            ref={reportTableRef}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md"
            style={
              forceShareCapture
                ? {
                    position: 'fixed',
                    left: '-12000px',
                    top: 0,
                    width: isMobile ? SHARE_CAPTURE_MOBILE_WIDTH : SHARE_CAPTURE_DESKTOP_WIDTH,
                    maxWidth: isMobile ? SHARE_CAPTURE_MOBILE_WIDTH : SHARE_CAPTURE_DESKTOP_WIDTH,
                    zIndex: -1,
                    pointerEvents: 'none',
                  }
                : undefined
            }
          >
            {!forceShareCapture && !(isMobile && (reportType === 'rework-rejection' || reportType === 'idle-stoppages')) && (
              <div className={`border-b px-4 py-3 ${activeColor.bg} ${activeColor.border}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`rounded-xl bg-white/70 p-2 shadow-sm ${activeColor.text}`}>{activeOption.icon}</span>
                    <div>
                      <span className={`block text-sm font-bold ${activeColor.text}`}>
                        {activeOption.label}{activeSubViewLabel ? ` · ${activeSubViewLabel}` : ''}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600">
                        {pagination.total ? `${pagination.total} total ${pagination.total === 1 ? 'record' : 'records'}` : `${data.length} ${data.length === 1 ? 'row' : 'rows'}`}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-600">
                    {fmtDate(fromDate)} — {fmtDate(toDate)}
                    {selectedLine && workCentres.length > 0 && ` · ${workCentres.find((w) => w.id == selectedLine)?.name}`}
                    {reportType === 'hourly-production' && selectedMachine && ` · M${selectedMachine}`}
                  </span>
                </div>
              </div>
            )}
            {renderReportKpis()}
            {showPeriodCompare && !forceShareCapture && (compareLoading || compareMaps) && (
              <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-950">
                {compareLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    Loading comparison periods…
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    Compare vs{' '}
                    {compareMode === 'both' ? 'yesterday and last week' : compareMode === 'yesterday' ? 'yesterday' : 'same day last week'}
                    : top line is <strong>today vs comparison day</strong>; bottom line is the gap. On % columns,{' '}
                    <strong>points</strong> = simple % difference.
                  </>
                )}
              </div>
            )}
            {isMobile ? (
              <>
                {!forceShareCapture && (
                  <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs text-slate-500">
                         </div>
                )}
                {renderMobileCards()}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <ChevronRight className="h-3 w-3 shrink-0 rotate-90" />
                    {reportType === 'hourly-production'
                      ? 'Scroll for hourly output columns (9 AM – 7 PM) · Date & line stay fixed on the left'
                      : reportType === 'line-efficiency'
                        ? 'Scroll for all columns · Date, line & machine on the left'
                        : 'Scroll horizontally for all columns'}
                  </p>
                  {supportsProductColumnToggle(reportType) && (
                    <label className="inline-flex cursor-pointer select-none items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showProductDetails}
                        onChange={(e) => setShowProductDetails(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[11px] font-semibold text-slate-600">Show product columns</span>
                    </label>
                  )}
                </div>
                {renderTable()}
              </>
            )}
          </div>
        )}
        {data && data.length > 0 && pagination.total > 10 && (
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

      {showExportMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => !isExportLoading && setShowExportMenu(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-report-title"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`h-1 ${activeColor.activeBg}`} />
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 id="export-report-title" className="text-lg font-bold text-slate-900">
                  Export report
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {activeOption.label}
                  {activeSubViewLabel ? ` · ${activeSubViewLabel}` : ''} · {fmtDate(fromDate)}
                  {fromDate !== toDate ? ` — ${fmtDate(toDate)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExportMenu(false)}
                disabled={isExportLoading}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <button
                type="button"
                onClick={() => void exportPDF().finally(() => setShowExportMenu(false))}
                disabled={isExportLoading}
                className={`group relative w-full overflow-hidden rounded-2xl border-2 text-left transition-all ${activeColor.border} hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className={`absolute inset-0 opacity-[0.08] ${activeColor.bg}`} />
                <div className="relative flex items-start gap-4 p-4">
                  <div className={`rounded-xl p-3 shadow-sm ring-1 ring-inset ring-white/60 ${activeColor.bg} ${activeColor.text}`}>
                    {exportFormatLoading === 'pdf' ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <FileText className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-slate-900">PDF report</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${activeColor.activeBg} text-white`}
                      >
                        Recommended
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-slate-500">
                      Branded document with KPI summary, active filters, and all{' '}
                      {pagination.total || data?.length || 0} filtered rows.
                    </p>
                  </div>
                  <FileDown className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
                </div>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void exportExcel().finally(() => setShowExportMenu(false))}
                  disabled={isExportLoading}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                      {exportFormatLoading === 'excel' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-5 w-5" />
                      )}
                    </div>
                    <Download className="h-4 w-4 text-slate-300" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Excel</p>
                    <p className="mt-0.5 text-xs text-slate-500">Spreadsheet (.xlsx)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void exportCSV().finally(() => setShowExportMenu(false))}
                  disabled={isExportLoading}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                      {exportFormatLoading === 'csv' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Download className="h-5 w-5" />
                      )}
                    </div>
                    <Download className="h-4 w-4 text-slate-300" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">CSV</p>
                    <p className="mt-0.5 text-xs text-slate-500">Plain data (.csv)</p>
                  </div>
                </button>
              </div>
            </div>

            <p className="border-t border-slate-100 px-5 py-3 text-center text-xs text-slate-400">
              Exports include all filtered rows, not just the current page.
            </p>
          </div>
        </div>
      )}

      {preparedShare && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal
          aria-labelledby="share-report-title"
        >
          <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-4">
              <div className="min-w-0 pr-2">
                <h3 id="share-report-title" className="text-base font-bold text-slate-900">
                  Share report
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {canAttemptNativeShare()
                    ? 'Tap Share below — pick WhatsApp from your phone’s app list.'
                    : 'Tap Save image — then attach the file in WhatsApp from Downloads.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreparedShare}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <img
                src={preparedShare.previewUrl}
                alt="Report preview"
                className="mx-auto max-h-36 w-full rounded-xl border border-slate-200 object-contain bg-slate-50 sm:max-h-44"
              />
              <p className="mt-2 text-center text-[11px] text-slate-400">Preview — summary is included on the image</p>
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={sharePreparedReport}
                disabled={isSavingShare}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#1da851] bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#20BD5A] active:scale-[0.98] disabled:opacity-60"
              >
                {isSavingShare ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WhatsAppIcon className="h-4 w-4 shrink-0" />
                )}
                {isSavingShare ? 'Saving…' : canAttemptNativeShare() ? 'Share' : 'Save image'}
              </button>
              {canAttemptNativeShare() && (
                <button
                  type="button"
                  onClick={() => void saveShareImageOnly(preparedShare)}
                  disabled={isSavingShare}
                  className="mt-2 w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  Save to Downloads instead
                </button>
              )}
              {typeof window !== 'undefined' && !window.isSecureContext && (
                <p className="mt-2 text-center text-xs text-amber-700">
                  Use HTTPS to see WhatsApp in the share menu.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
