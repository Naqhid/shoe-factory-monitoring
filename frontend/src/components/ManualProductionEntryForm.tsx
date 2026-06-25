import React from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Cpu,
  Edit,
  FileText,
  Filter,
  History,
  Loader2,
  Package,
  RefreshCw,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { canMutateManualProduction } from '../utils/roleConfig';
import { SearchableSelect } from './SearchableSelect';
import { WipDailyStateTab } from './WipDailyStateTab';
import { ProductionDayLockPanel } from './ProductionDayLockPanel';
import {
  buildManualEntryNeededHints,
  MANUAL_ENTRY_HINT_GRACE_MINS,
  type ManualEntryNeededHint,
} from '../utils/manualEntryNeededHints';
import {
  buildMissingSlotHints,
  FACTORY_HOURLY_SLOTS,
  getMesOutputForHourlySlot,
  getNextFactoryHourlySlot,
  isManualProductionRow,
  type MissingSlotHint,
} from '../utils/manualEntrySlotUtils';
import {
  buildEndOfShiftChecklist,
  buildLineReconciliation,
  buildSlotCoverageHeatmap,
  computeExpectedSlotOutput,
  countOverlapSlots,
  detectSlotOverlapConflict,
  type SlotHeatmapRow,
} from '../utils/manualEntryCoverageUtils';
import {
  ManualEntryReconciliationStrip,
  ManualEntryShiftChecklist,
  ManualEntrySlotHeatmap,
} from './ManualEntryInsights';
import {
  analyzeProdCycle,
  buildProdCycleContextMap,
  calcProdEfficiency,
  formatFirstCycleShiftNote,
  formatLossBreakdown,
  getAnomalyLabel,
  matchesProdQuickFilter,
  PROD_QUICK_FILTERS,
  type ProdCycleMetrics,
  type ProdQuickFilter,
} from '../utils/prodRecordInsights';

interface WorkCentre {
  id: number;
  name: string;
}

interface MachineCentre {
  machine_id: string;
  machine_name?: string;
  name?: string;
  work_centre_id?: number;
}

interface Employee {
  code: string;
  name: string;
  work_centre_id?: number;
}

interface ActiveSession {
  machine_id: string;
  emp_code: string;
  activated_at: string;
}

interface ManualEntryRow {
  id: number;
  prod_date: string;
  work_centre_id: number;
  work_centre_name?: string;
  machine_id: string;
  machine_name?: string;
  emp_id: string;
  employee_name?: string;
  target_mins: number;
  output_pairs: number;
  start_time: string;
  finish_time: string;
  stoppage_reason?: string;
}

interface ManualEntryAuditRow {
  id: number;
  entry_id: number | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  actor_user_id?: number | null;
  actor_username?: string | null;
  actor_role?: string | null;
  reason?: string | null;
  before_data?: string | null;
  after_data?: string | null;
  created_at: string;
}

interface AuditChangeRow {
  key: string;
  label: string;
  beforeValue: string;
  afterValue: string;
}

const MANUAL_ENTRY_FIELD_CLS =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400';

const MANUAL_REASON_CHIPS = [
  'Mobile app down / no capture',
  'Operator forgot to submit',
  'Mobile output incorrect',
  'Late correction for missed slot',
];

const getNowLocalDateTime = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const getTodayLocalDate = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Calendar date from API — use local date when a timestamp is present (avoids UTC day shift). */
const parseProdDateKey = (value?: string | null): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatProdDateKey = (dateKey: string): string => {
  const key = parseProdDateKey(dateKey);
  if (!key) return '-';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
};

const SLOT_TYPES = [
  { value: 'hourly', label: 'Hourly', minutes: 60 },
  { value: 'half_hourly', label: 'Half-hourly', minutes: 30 },
  { value: 'quarterly', label: 'Quarterly', minutes: 15 },
  { value: 'manual', label: 'Manual', minutes: 0 },
] as const;

type SlotType = typeof SLOT_TYPES[number]['value'];

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatTimeFromMinutes = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
};

const buildSlotOptions = (slotMinutes: number) => {
  const options: Array<{ value: string; label: string; startMinutes: number; endMinutes: number }> = [];
  // Only show slots from 9 AM (540 minutes) to 7 PM (1140 minutes)
  for (let start = 540; start + slotMinutes <= 1140; start += slotMinutes) {
    const end = start + slotMinutes;
    options.push({
      value: formatTimeFromMinutes(start),
      label: `${formatTimeFromMinutes(start)}-${formatTimeFromMinutes(end)}`,
      startMinutes: start,
      endMinutes: end,
    });
  }
  return options;
};

export const ManualProductionEntryForm: React.FC = () => {
  const navigate = useNavigate();

  // Role guard — read once on mount
  const currentUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user_info') || 'null'); } catch { return null; }
  }, []);
  const canEdit = canMutateManualProduction(currentUser?.role);
  const [productionDayLocked, setProductionDayLocked] = React.useState(false);
  const canMutate = canEdit && !productionDayLocked;
  // All authenticated users with menu access can VIEW — Admin and Project Monitor can add/edit/delete.
  const isAuthenticated = !!currentUser;

  const [workCentres, setWorkCentres] = React.useState<WorkCentre[]>([]);
  const [machines, setMachines] = React.useState<MachineCentre[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [activeSessions, setActiveSessions] = React.useState<ActiveSession[]>([]);
  const [entryNeededHints, setEntryNeededHints] = React.useState<ManualEntryNeededHint[]>([]);
  const [entryHintsLoading, setEntryHintsLoading] = React.useState(false);
  const [allMissingSlotHints, setAllMissingSlotHints] = React.useState<MissingSlotHint[]>([]);
  const [showAllMissingSlots, setShowAllMissingSlots] = React.useState(false);
  const [todayCoverageManual, setTodayCoverageManual] = React.useState<ManualEntryRow[]>([]);
  const [todayCoverageCycles, setTodayCoverageCycles] = React.useState<any[]>([]);
  const [mesSlotOutput, setMesSlotOutput] = React.useState<number | null>(null);
  const [continueNextHour, setContinueNextHour] = React.useState(true);
  const [coveragePlanTargets, setCoveragePlanTargets] = React.useState<Record<number, number>>({});
  const heatmapRef = React.useRef<HTMLDivElement>(null);
  const entriesTableRef = React.useRef<HTMLDivElement>(null);
  const [mesCompare, setMesCompare] = React.useState<{
    mesOutput: number;
    enteredOutput: number;
    payload: Record<string, unknown>;
    slotLabel: string;
    hourlySlot: string;
    entryDate: string;
  } | null>(null);
  const [manualEntries, setManualEntries] = React.useState<ManualEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingEntries, setLoadingEntries] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [tableDateFilter, setTableDateFilter] = React.useState(getNowLocalDateTime().split('T')[0]);
  const [tableToDateFilter, setTableToDateFilter] = React.useState(getNowLocalDateTime().split('T')[0]);
  const [tableWorkCentreFilter, setTableWorkCentreFilter] = React.useState('');
  const [tableSearchInput, setTableSearchInput] = React.useState('');
  const [tableSearch, setTableSearch] = React.useState('');
  const [tablePage, setTablePage] = React.useState(1);
  const [tableLimit, setTableLimit] = React.useState<string>('10');
  const [tableSortBy, setTableSortBy] = React.useState<string>('created_at');
  const [tableSortOrder, setTableSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [tableTotal, setTableTotal] = React.useState(0);
  const [tableTotalPages, setTableTotalPages] = React.useState(1);
  const [tableFilteredOutputTotal, setTableFilteredOutputTotal] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'entries' | 'coverage' | 'audit' | 'production' | 'summary' | 'wip'>('entries');
  const [auditLogs, setAuditLogs] = React.useState<ManualEntryAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditEntryId, setAuditEntryId] = React.useState<number | null>(null);
  const [auditSearchInput, setAuditSearchInput] = React.useState('');
  const [auditSearch, setAuditSearch] = React.useState('');
  const [auditPage, setAuditPage] = React.useState(1);
  const [auditLimit, setAuditLimit] = React.useState<string>('20');
  const [auditTotal, setAuditTotal] = React.useState(0);
  const [auditTotalPages, setAuditTotalPages] = React.useState(1);
  const [auditPageInput, setAuditPageInput] = React.useState('1');
  const [showRawAuditJson, setShowRawAuditJson] = React.useState(false);
  const [restoreCandidate, setRestoreCandidate] = React.useState<ManualEntryAuditRow | null>(null);
  const [deleteCandidate, setDeleteCandidate] = React.useState<ManualEntryRow | null>(null);
  const [pageInput, setPageInput] = React.useState('1');
  const [prodRecords, setProdRecords] = React.useState<any[]>([]);
  const [prodLoading, setProdLoading] = React.useState(false);
  const [prodDateFilter, setProdDateFilter] = React.useState(getTodayLocalDate());
  const [prodMachineFilter, setProdMachineFilter] = React.useState('');
  const [prodLineFilter, setProdLineFilter] = React.useState('');
  const [prodSearch, setProdSearch] = React.useState('');
  const [prodIncludeInProgress, setProdIncludeInProgress] = React.useState(true);
  const [prodFinishedView, setProdFinishedView] = React.useState<'all' | 'recent_finished' | 'last_finished'>('all');
  const [prodToDateFilter, setProdToDateFilter] = React.useState(getTodayLocalDate());
  const [prodPage, setProdPage] = React.useState(0);
  const [prodPageSize, setProdPageSize] = React.useState(20);
  /** Which machine accordions are expanded (persisted across refresh after edit/save) */
  const [prodMachineAccordionOpen, setProdMachineAccordionOpen] = React.useState<Record<string, boolean>>({});
  const [editingProdId, setEditingProdId] = React.useState<number | null>(null);
  const [prodStartTime, setProdStartTime] = React.useState('');
  const [prodFinishTime, setProdFinishTime] = React.useState('');
  const [prodOutputPairs, setProdOutputPairs] = React.useState('0');
  const [prodTargetMins, setProdTargetMins] = React.useState('0');
  const [showProdEditForm, setShowProdEditForm] = React.useState(false);
  const [prodDeleteCandidate, setProdDeleteCandidate] = React.useState<any | null>(null);
  const [prodLastRefreshedAt, setProdLastRefreshedAt] = React.useState<Date | null>(null);
  const [prodLiveNow, setProdLiveNow] = React.useState(() => new Date());
  const [prodAutoRefresh, setProdAutoRefresh] = React.useState(true);
  const [prodLiveTick, setProdLiveTick] = React.useState(0);
  const [prodQuickFilter, setProdQuickFilter] = React.useState<ProdQuickFilter>('all');
  const [prodNewCycleIds, setProdNewCycleIds] = React.useState<Set<number>>(() => new Set());
  const prodKnownIdsRef = React.useRef<Set<number>>(new Set());
  const [coverageLastRefreshedAt, setCoverageLastRefreshedAt] = React.useState<Date | null>(null);
  const [coverageAutoRefresh, setCoverageAutoRefresh] = React.useState(true);
  const [coverageLiveTick, setCoverageLiveTick] = React.useState(0);
  const [summaryDate, setSummaryDate] = React.useState(getTodayLocalDate());
  const [summaryData, setSummaryData] = React.useState<any[]>([]);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [conflictIds, setConflictIds] = React.useState<Set<number>>(new Set());
  // Mandatory reasons for sensitive changes
  const [editReason, setEditReason] = React.useState('');
  const [deleteReason, setDeleteReason] = React.useState('');
  // Bulk delete
  const [selectedEntryIds, setSelectedEntryIds] = React.useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = React.useState(false);
  // Duplicate slot warning
  const [slotConflictWarning, setSlotConflictWarning] = React.useState('');
  // Manipulation alert threshold
  const MANUAL_PCT_ALERT = 30;
  const FILTER_PRESET_KEY = 'manual_entry_filters_v1';

  const handleUnauthorized = React.useCallback((message?: string) => {
    toast.error(message || 'Session expired. Please login again.');
    localStorage.removeItem('app_authenticated');
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    navigate('/', { replace: true });
  }, [navigate]);

  const [workCentreId, setWorkCentreId] = React.useState('');
  const [machineId, setMachineId] = React.useState('');
  const [empId, setEmpId] = React.useState('');
  const [entryDate, setEntryDate] = React.useState(getTodayLocalDate());
  const [hourlySlot, setHourlySlot] = React.useState('');
  const [slotType, setSlotType] = React.useState<SlotType>('hourly');
  const [manualStartTime, setManualStartTime] = React.useState('');
  const [manualFinishTime, setManualFinishTime] = React.useState('');
  const [targetMins, setTargetMins] = React.useState('0');
  const [outputPairs, setOutputPairs] = React.useState('0');
  const [stoppageReason, setStoppageReason] = React.useState('');
  const [loadingTargetMins, setLoadingTargetMins] = React.useState(false);
  const isManualFormDirty = React.useMemo(() => {
    if (!showForm) return false;
    return Boolean(
      workCentreId ||
      machineId ||
      empId ||
      hourlySlot ||
      manualStartTime ||
      manualFinishTime ||
      Number(outputPairs || 0) > 0 ||
      (stoppageReason || '').trim() ||
      (editReason || '').trim()
    );
  }, [showForm, workCentreId, machineId, empId, hourlySlot, manualStartTime, manualFinishTime, outputPairs, stoppageReason, editReason]);

  React.useEffect(() => {
    const loadMasters = async () => {
      try {
        const [wcRes, machineRes, empRes] = await Promise.all([
          apiFetch(`${API_BASE_URL}/api/masters/work_centres?limit=500`).then(r => r.json()),
          apiFetch(`${API_BASE_URL}/api/masters/machine_centres?limit=500`).then(r => r.json()),
          apiFetch(`${API_BASE_URL}/api/masters/employees?limit=1000`).then(r => r.json()),
        ]);

        if (wcRes.success) setWorkCentres(wcRes.data || []);
        if (machineRes.success) setMachines(machineRes.data || []);
        if (empRes.success) setEmployees(empRes.data || []);

        const activeRes = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/active-snapshot`);
        const activeJson = await activeRes.json();
        if (activeRes.status === 401) {
          handleUnauthorized(activeJson.message);
          return;
        }
        if (activeJson.success) {
          setActiveSessions(activeJson.data || []);
        } else {
          console.warn('Failed to load active session snapshot:', activeJson.message);
        }
      } catch (error) {
        console.error('Failed to load masters for manual entry:', error);
        toast.error('Failed to load master data');
      }
    };
    loadMasters();
  }, [handleUnauthorized]);

  const filteredMachines = React.useMemo(() => {
    if (!workCentreId) return machines;
    return machines.filter((m) => String(m.work_centre_id) === String(workCentreId));
  }, [machines, workCentreId]);

  const filteredEmployees = React.useMemo(() => {
    const byLine = !workCentreId
      ? employees
      : employees.filter((e) => String(e.work_centre_id) === String(workCentreId));

    if (!activeSessions.length) return byLine;
    const blockedEmpCodes = new Set(
      activeSessions
        .filter((s) => s.emp_code && machineId && String(s.machine_id) !== String(machineId))
        .map((s) => String(s.emp_code))
    );

    return byLine.filter((e) => !blockedEmpCodes.has(String(e.code)));
  }, [employees, workCentreId, activeSessions, machineId]);

  const employeeSelectOptions = React.useMemo(
    () =>
      filteredEmployees.map((emp) => ({
        value: emp.code,
        label: `${emp.code} - ${emp.name}`,
      })),
    [filteredEmployees]
  );

  const loadEmployeeOptions = React.useCallback(async (search: string) => {
    const params = new URLSearchParams({ page: '1', limit: '10' });
    if (search.trim()) params.set('search', search.trim());
    const res = await apiFetch(`${API_BASE_URL}/api/masters/employees?${params.toString()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to load employees');
    return (json.data || []).map((emp: any) => ({
      value: String(emp.code),
      label: `${emp.code} - ${emp.name}`,
    }));
  }, []);

  const hasSlotSelection =
    slotType === 'manual' ? !!manualStartTime && !!manualFinishTime : !!hourlySlot;
  const canSubmit =
    !!workCentreId &&
    !!machineId &&
    !!empId &&
    hasSlotSelection &&
    !!stoppageReason.trim() &&
    !loading &&
    !slotConflictWarning;

  const selectedSlotMinutes = React.useMemo(() => {
    const match = SLOT_TYPES.find((slot) => slot.value === slotType);
    return match?.minutes || 60;
  }, [slotType]);

  const slotOptions = React.useMemo(
    () => buildSlotOptions(selectedSlotMinutes),
    [selectedSlotMinutes]
  );

  const totalManualOutput = React.useMemo(
    () => manualEntries.reduce((sum, row) => sum + Number(row.output_pairs || 0), 0),
    [manualEntries]
  );

  const parseAuditJson = (value?: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const formatDisplayDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDisplayDate = (value?: string | null) => formatProdDateKey(parseProdDateKey(value));

  const formatShortTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const appendReasonChip = (chip: string) => {
    setStoppageReason((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) return prev;
      return `${trimmed}${trimmed.endsWith('.') ? ' ' : '. '}${chip}`;
    });
  };

  const getAuditActionBadgeClass = (action: string) => {
    if (action === 'CREATE') return 'bg-green-100 text-green-700';
    if (action === 'UPDATE') return 'bg-blue-100 text-blue-700';
    if (action === 'DELETE') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast.error('Copy failed');
    }
  };

  const formatMachineDisplay = (value: any): string => {
    const machineIdValue = String(value || '').trim();
    if (!machineIdValue) return '-';
    const matched = machines.find((m) => {
      const id = String(m.machine_id || '').trim();
      const code = String((m as any).code || '').trim();
      return machineIdValue === id || (code && machineIdValue === code);
    });
    const machineName = matched?.machine_name || matched?.name || '';
    return machineName ? `${machineIdValue} - ${machineName}` : machineIdValue;
  };

  const prettyAuditValue = (value: any, key: string): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (key === 'machine_id') {
      return formatMachineDisplay(value);
    }
    if (key.includes('time') || key.includes('date')) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return formatDisplayDateTime(parsed.toISOString());
      }
    }
    return String(value);
  };

  const toAuditChanges = (log: ManualEntryAuditRow): AuditChangeRow[] => {
    const beforeObj = parseAuditJson(log.before_data);
    const afterObj = parseAuditJson(log.after_data);
    const before = beforeObj && typeof beforeObj === 'object' ? beforeObj : {};
    const after = afterObj && typeof afterObj === 'object' ? afterObj : {};

    const labelMap: Record<string, string> = {
      prod_date: 'Production Date',
      work_centre_id: 'Line',
      machine_id: 'Machine',
      emp_id: 'Employee',
      start_time: 'Start Time',
      finish_time: 'End Time',
      target_mins: 'Target Time',
      output_pairs: 'Output Pairs',
      stoppage_reason: 'Reason',
    };

    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    const rows: AuditChangeRow[] = [];
    keys.forEach((key) => {
      const beforeVal = before[key];
      const afterVal = after[key];
      if (log.action === 'UPDATE' && JSON.stringify(beforeVal) === JSON.stringify(afterVal)) return;
      rows.push({
        key,
        label: labelMap[key] || key,
        beforeValue: prettyAuditValue(beforeVal, key),
        afterValue: prettyAuditValue(afterVal, key),
      });
    });
    return rows;
  };

  const clearForm = () => {
    setMachineId('');
    setEmpId('');
    setHourlySlot('');
    setManualStartTime('');
    setManualFinishTime('');
    setTargetMins('0');
    setOutputPairs('0');
    setStoppageReason('');
    setEditReason('');
    setEditingId(null);
    setShowForm(false);
    setSlotConflictWarning('');
    setEntryDate(getTodayLocalDate());
  };

  const requestDiscardManualFormChanges = React.useCallback(() => {
    if (!isManualFormDirty || loading) return true;
    return window.confirm('You have unsaved manual entry changes. Discard them and continue?');
  }, [isManualFormDirty, loading]);
  const withDiscardCheck = React.useCallback((callback: () => void) => {
    if (!requestDiscardManualFormChanges()) return;
    callback();
  }, [requestDiscardManualFormChanges]);

  React.useEffect(() => {
    if (!isManualFormDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isManualFormDirty]);

  const loadManualEntries = React.useCallback(async () => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams();
      if (tableDateFilter && tableToDateFilter && tableDateFilter === tableToDateFilter) {
        params.set('date', tableDateFilter);
      } else {
        if (tableDateFilter) params.set('from_date', tableDateFilter);
        if (tableToDateFilter) params.set('to_date', tableToDateFilter);
      }
      if (tableWorkCentreFilter) params.set('work_centre_id', tableWorkCentreFilter);
      if (tableSearch.trim()) params.set('search', tableSearch.trim());
      params.set('page', String(tablePage));
      params.set('limit', tableLimit);
      params.set('sort_by', tableSortBy);
      params.set('sort_order', tableSortOrder);
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry?${params.toString()}`);
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized(json.message);
        return;
      }
      if (json.success) {
        const rows = Array.isArray(json.data) ? json.data : [];
        const hasMeta = json.meta && typeof json.meta.total !== 'undefined';

        if (hasMeta) {
          setManualEntries(rows);
          setTableTotal(Number(json.meta?.total || 0));
          setTableTotalPages(Number(json.meta?.total_pages || 1));
          setTableFilteredOutputTotal(Number(json.meta?.total_output_pairs || 0));
        } else {
          // Backward-compatible fallback when backend is not yet restarted with pagination changes.
          const query = tableSearch.trim().toLowerCase();
          const filteredRows = query
            ? rows.filter((row: ManualEntryRow) => {
                const machine = `${row.machine_id || ''} ${row.machine_name || ''}`.toLowerCase();
                const employee = `${row.emp_id || ''} ${row.employee_name || ''}`.toLowerCase();
                const line = `${row.work_centre_name || row.work_centre_id || ''}`.toString().toLowerCase();
                return machine.includes(query) || employee.includes(query) || line.includes(query);
              })
            : rows;
          const fallbackLimit = tableLimit === 'all' ? filteredRows.length || 1 : Math.max(1, parseInt(tableLimit, 10) || 10);
          const start = tableLimit === 'all' ? 0 : (tablePage - 1) * fallbackLimit;
          const pageRows = tableLimit === 'all' ? filteredRows : filteredRows.slice(start, start + fallbackLimit);
          setManualEntries(pageRows);
          setTableTotal(filteredRows.length);
          setTableTotalPages(tableLimit === 'all' ? 1 : Math.max(1, Math.ceil(filteredRows.length / fallbackLimit)));
          setTableFilteredOutputTotal(filteredRows.reduce((sum: number, row: ManualEntryRow) => sum + Number(row.output_pairs || 0), 0));
        }
      } else {
        setManualEntries([]);
        setTableTotal(0);
        setTableTotalPages(1);
        setTableFilteredOutputTotal(0);
        toast.error(json.message || 'Failed to load manual entries');
      }
    } catch (error) {
      console.error('Failed to load manual entries:', error);
      toast.error('Failed to load manual entries');
    } finally {
      setLoadingEntries(false);
    }
  }, [tableDateFilter, tableToDateFilter, tableWorkCentreFilter, tableSearch, tablePage, tableLimit, tableSortBy, tableSortOrder, handleUnauthorized]);

  const isSingleDayEntriesView = React.useMemo(
    () => tableDateFilter === tableToDateFilter,
    [tableDateFilter, tableToDateFilter]
  );

  const isTodayEntriesView = React.useMemo(
    () => isSingleDayEntriesView && tableDateFilter === getTodayLocalDate(),
    [isSingleDayEntriesView, tableDateFilter]
  );

  const loadTodayCoverage = React.useCallback(async () => {
    if (!isSingleDayEntriesView) {
      setEntryNeededHints([]);
      setAllMissingSlotHints([]);
      setTodayCoverageManual([]);
      setTodayCoverageCycles([]);
      setCoveragePlanTargets({});
      return;
    }
    setEntryHintsLoading(true);
    try {
      const coverageDate = tableDateFilter;
      const [manualRes, prodRes, activeRes] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry?date=${coverageDate}&limit=all`),
        apiFetch(`${API_BASE_URL}/api/mobile-production`),
        apiFetch(`${API_BASE_URL}/api/mobile-sessions/active-snapshot`),
      ]);
      const manualJson = await manualRes.json();
      const prodJson = await prodRes.json();
      const activeJson = await activeRes.json();

      if (activeRes.status === 401) {
        handleUnauthorized(activeJson.message);
        return;
      }

      const sessions = activeJson.success ? activeJson.data || [] : [];
      if (activeJson.success) setActiveSessions(sessions);

      const manualRows = manualJson.success && Array.isArray(manualJson.data) ? manualJson.data : [];
      const cyclesToday = (prodJson.success && Array.isArray(prodJson.data) ? prodJson.data : []).filter(
        (r: { start_time?: string }) => parseProdDateKey(r.start_time) === coverageDate
      );

      setTodayCoverageManual(manualRows);
      setTodayCoverageCycles(cyclesToday);

      const wcsToFetch = tableWorkCentreFilter
        ? workCentres.filter((wc) => String(wc.id) === String(tableWorkCentreFilter))
        : workCentres;
      const planTargets: Record<number, number> = {};
      await Promise.all(
        wcsToFetch.map(async (wc) => {
          try {
            const dashRes = await apiFetch(
              `${API_BASE_URL}/api/tv-dashboard/dashboard/${wc.id}?date=${coverageDate}`
            );
            const dashJson = await dashRes.json();
            if (dashJson.success) {
              planTargets[wc.id] = Number(dashJson.data?.middleSection?.target || 0);
            }
          } catch {
            planTargets[wc.id] = 0;
          }
        })
      );
      setCoveragePlanTargets(planTargets);

      setEntryNeededHints(
        isTodayEntriesView
          ? buildManualEntryNeededHints({
              todayKey: coverageDate,
              sessions,
              machines,
              employees,
              workCentres,
              manualEntriesToday: manualRows,
              productionCyclesToday: cyclesToday,
              lineFilter: tableWorkCentreFilter || undefined,
            })
          : []
      );

      setAllMissingSlotHints(
        buildMissingSlotHints({
          dateKey: coverageDate,
          machines,
          workCentres,
          manualEntries: manualRows,
          cycles: cyclesToday,
          activeSessions: sessions,
          employees,
          lineFilter: tableWorkCentreFilter || undefined,
          limit: 500,
        })
      );
    } catch (error) {
      console.warn('Failed to load today coverage:', error);
      setEntryNeededHints([]);
      setAllMissingSlotHints([]);
      setCoveragePlanTargets({});
    } finally {
      setEntryHintsLoading(false);
      setCoverageLastRefreshedAt(new Date());
    }
  }, [
    isSingleDayEntriesView,
    isTodayEntriesView,
    tableDateFilter,
    machines,
    employees,
    workCentres,
    tableWorkCentreFilter,
    handleUnauthorized,
  ]);

  const visibleMissingSlotHints = React.useMemo(
    () => (showAllMissingSlots ? allMissingSlotHints : allMissingSlotHints.slice(0, 24)),
    [allMissingSlotHints, showAllMissingSlots]
  );

  React.useEffect(() => {
    const onCoverageTab = activeTab === 'entries' || activeTab === 'coverage';
    if (!onCoverageTab || !isSingleDayEntriesView) {
      if (!onCoverageTab) {
        setEntryNeededHints([]);
        setAllMissingSlotHints([]);
        setCoveragePlanTargets({});
      }
      return;
    }
    void loadTodayCoverage();
  }, [activeTab, isSingleDayEntriesView, tableDateFilter, tableWorkCentreFilter, loadTodayCoverage]);

  React.useEffect(() => {
    if (activeTab !== 'coverage' || !coverageAutoRefresh || !isSingleDayEntriesView) return undefined;
    const timer = window.setInterval(() => void loadTodayCoverage(), 30_000);
    return () => window.clearInterval(timer);
  }, [activeTab, coverageAutoRefresh, isSingleDayEntriesView, loadTodayCoverage]);

  React.useEffect(() => {
    if (activeTab !== 'coverage') return undefined;
    const timer = window.setInterval(() => setCoverageLiveTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  const coverageInProgressCount = React.useMemo(() => {
    let cycles = todayCoverageCycles.filter((r) => !isManualProductionRow(r));
    if (tableWorkCentreFilter) {
      cycles = cycles.filter((r) => String(r.work_centre_id) === tableWorkCentreFilter);
    }
    return cycles.filter((r) => {
      const status = Number(r.button_status);
      return status === 0 || status === 1;
    }).length;
  }, [todayCoverageCycles, tableWorkCentreFilter]);

  const coverageSecondsSinceRefresh = React.useMemo(() => {
    if (!coverageLastRefreshedAt) return null;
    void coverageLiveTick;
    return Math.max(0, Math.floor((Date.now() - coverageLastRefreshedAt.getTime()) / 1000));
  }, [coverageLastRefreshedAt, coverageLiveTick]);

  const slotHeatmapRows = React.useMemo(
    () =>
      isSingleDayEntriesView
        ? buildSlotCoverageHeatmap({
            dateKey: tableDateFilter,
            machines,
            workCentres,
            manualEntries: todayCoverageManual,
            cycles: todayCoverageCycles,
            activeSessions,
            lineFilter: tableWorkCentreFilter || undefined,
          })
        : [],
    [
      isSingleDayEntriesView,
      tableDateFilter,
      machines,
      workCentres,
      todayCoverageManual,
      todayCoverageCycles,
      activeSessions,
      tableWorkCentreFilter,
    ]
  );

  const reconciliationRows = React.useMemo(
    () =>
      isSingleDayEntriesView
        ? buildLineReconciliation({
            dateKey: tableDateFilter,
            workCentres,
            machines,
            manualEntries: todayCoverageManual,
            cycles: todayCoverageCycles,
            planTargets: coveragePlanTargets,
            lineFilter: tableWorkCentreFilter || undefined,
          })
        : [],
    [
      isSingleDayEntriesView,
      tableDateFilter,
      workCentres,
      machines,
      todayCoverageManual,
      todayCoverageCycles,
      coveragePlanTargets,
      tableWorkCentreFilter,
    ]
  );

  const shiftChecklistItems = React.useMemo(
    () =>
      buildEndOfShiftChecklist({
        missingSlots: allMissingSlotHints,
        entryNeeded: entryNeededHints,
        reconciliations: reconciliationRows,
        overlapSlotCount: countOverlapSlots(slotHeatmapRows),
        conflictEntryCount: conflictIds.size,
      }),
    [
      allMissingSlotHints,
      entryNeededHints,
      reconciliationRows,
      slotHeatmapRows,
      conflictIds,
    ]
  );

  const expectedSlotOutput = React.useMemo(() => {
    if (slotType !== 'hourly' || !hourlySlot) return null;
    return computeExpectedSlotOutput(Number(targetMins || 0), selectedSlotMinutes);
  }, [targetMins, slotType, hourlySlot, selectedSlotMinutes]);

  const openQuickEntryForm = (opts: {
    work_centre_id: number | string;
    machine_id: string;
    emp_id?: string;
    slot_value?: string;
    copy_from_row?: ManualEntryRow | null;
  }) => {
    setShowForm(true);
    setEditingId(null);
    setEntryDate(getTodayLocalDate());
    setWorkCentreId(String(opts.work_centre_id));
    setMachineId(opts.machine_id);
    setEmpId(opts.emp_id || '');
    setSlotType('hourly');
    setStoppageReason('');
    setEditReason('');
    setSlotConflictWarning('');
    setHourlySlot(opts.slot_value || '');
    setManualStartTime('');
    setManualFinishTime('');
    if (opts.copy_from_row) {
      const row = opts.copy_from_row;
      const start = new Date(row.start_time);
      if (!Number.isNaN(start.getTime())) {
        setHourlySlot(`${pad2(start.getHours())}:${pad2(start.getMinutes())}`);
      }
      setOutputPairs(String(Number(row.output_pairs || 0)));
      setTargetMins(String(Number(row.target_mins || 0)));
    } else {
      setOutputPairs('0');
    }
  };

  const startEntryFromHint = (hint: ManualEntryNeededHint) => {
    withDiscardCheck(() => {
      openQuickEntryForm({
        work_centre_id: hint.work_centre_id,
        machine_id: hint.machine_id,
        emp_id: hint.emp_code,
      });
    });
  };

  const startEntryFromMissingSlot = (hint: MissingSlotHint) => {
    withDiscardCheck(() => {
      openQuickEntryForm({
        work_centre_id: hint.work_centre_id,
        machine_id: hint.machine_id,
        emp_id: hint.emp_code,
        slot_value: hint.slot_value,
      });
    });
  };

  const startEntryFromHeatmap = (row: SlotHeatmapRow, slotValue: string) => {
    const session = activeSessions.find((s) => String(s.machine_id) === String(row.machine_id));
    withDiscardCheck(() => {
      openQuickEntryForm({
        work_centre_id: row.work_centre_id,
        machine_id: row.machine_id,
        emp_id: session?.emp_code,
        slot_value: slotValue,
      });
    });
  };

  const handleChecklistAction = (item: { id: string }) => {
    if (item.id === 'missing-slots' || item.id === 'overlap-slots' || item.id === 'plan-gap') {
      setActiveTab('coverage');
      window.requestAnimationFrame(() => {
        heatmapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    if (item.id === 'entry-needed' && entryNeededHints[0]) {
      startEntryFromHint(entryNeededHints[0]);
      return;
    }
    if (item.id === 'table-conflicts') {
      setActiveTab('entries');
      window.requestAnimationFrame(() => {
        entriesTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const copyLastEntryOnMachine = () => {
    if (!machineId || !entryDate) {
      toast.error('Select a machine first');
      return;
    }
    const rows = todayCoverageManual.filter(
      (r) => String(r.machine_id) === String(machineId) && parseProdDateKey(r.prod_date) === entryDate
    );
    if (!rows.length) {
      toast.error('No earlier manual entry for this machine today');
      return;
    }
    const last = [...rows].sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    )[0];
    const start = new Date(last.start_time);
    if (!Number.isNaN(start.getTime())) {
      setHourlySlot(`${pad2(start.getHours())}:${pad2(start.getMinutes())}`);
    }
    setOutputPairs(String(Number(last.output_pairs || 0)));
    setEmpId(last.emp_id || empId);
    toast.success('Copied last entry on this machine — pick the next hour slot if needed');
  };

  React.useEffect(() => {
    if (!machineId || slotType !== 'hourly' || !hourlySlot || !entryDate) {
      setMesSlotOutput(null);
      return;
    }
    setMesSlotOutput(getMesOutputForHourlySlot(todayCoverageCycles, machineId, entryDate, hourlySlot));
  }, [machineId, slotType, hourlySlot, entryDate, todayCoverageCycles]);

  React.useEffect(() => {
    if (!showForm || slotType === 'manual' || !hourlySlot || !machineId || !entryDate) {
      setSlotConflictWarning('');
      return;
    }
    const slot = FACTORY_HOURLY_SLOTS.find((s) => s.value === hourlySlot);
    if (!slot) {
      setSlotConflictWarning('');
      return;
    }
    const manualRows =
      entryDate === tableDateFilter && todayCoverageManual.length > 0
        ? todayCoverageManual
        : manualEntries;
    const cycles =
      entryDate === tableDateFilter && todayCoverageCycles.length > 0
        ? todayCoverageCycles
        : [];
    const conflict = detectSlotOverlapConflict({
      machineId,
      dateKey: entryDate,
      slotStartMinutes: slot.startMinutes,
      slotEndMinutes: slot.endMinutes,
      manualEntries: manualRows,
      cycles,
      editingId,
    });
    setSlotConflictWarning(conflict.blocked && !editingId ? conflict.message : '');
  }, [
    showForm,
    slotType,
    hourlySlot,
    machineId,
    entryDate,
    editingId,
    tableDateFilter,
    todayCoverageManual,
    todayCoverageCycles,
    manualEntries,
  ]);

  React.useEffect(() => {
    if (showForm && isSingleDayEntriesView && todayCoverageCycles.length === 0 && !entryHintsLoading) {
      void loadTodayCoverage();
    }
  }, [showForm, isSingleDayEntriesView, todayCoverageCycles.length, entryHintsLoading, loadTodayCoverage]);

  React.useEffect(() => {
    const loadTargetMins = async () => {
      if (!machineId || !empId) {
        setTargetMins('0.0');
        return;
      }
      setLoadingTargetMins(true);
      try {
        const res = await apiFetch(
          `${API_BASE_URL}/api/mobile-production/init/${encodeURIComponent(machineId)}/${encodeURIComponent(empId)}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          const nextTargetMins = Number(json.data.targetMins || 0);
          const rounded = Number.isFinite(nextTargetMins)
            ? (Math.round(nextTargetMins * 10) / 10).toFixed(1)
            : '0.0';
          setTargetMins(rounded);
        }
      } catch (error) {
        console.warn('Failed to auto-load target minutes for manual entry:', error);
      } finally {
        setLoadingTargetMins(false);
      }
    };
    loadTargetMins();
  }, [machineId, empId]);

  React.useEffect(() => {
    loadManualEntries();
  }, [loadManualEntries]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setTableSearch(tableSearchInput.trim());
      setTablePage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tableSearchInput]);

  React.useEffect(() => {
    setPageInput(String(tablePage));
  }, [tablePage]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESET_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // Always default date filters to today on fresh open.
      // Do not restore older saved dates to avoid confusing stale ranges.
      const today = getNowLocalDateTime().split('T')[0];
      setTableDateFilter(today);
      setTableToDateFilter(today);
      if (typeof saved.tableWorkCentreFilter === 'string') setTableWorkCentreFilter(saved.tableWorkCentreFilter);
      if (typeof saved.tableSearchInput === 'string') setTableSearchInput(saved.tableSearchInput);
      if (saved.tableLimit) setTableLimit(saved.tableLimit);
      if (saved.tableSortBy) setTableSortBy(saved.tableSortBy);
      if (saved.tableSortOrder === 'asc' || saved.tableSortOrder === 'desc') setTableSortOrder(saved.tableSortOrder);
    } catch (error) {
      console.warn('Failed to load manual entry filter preset:', error);
    }
  }, []);

  const getProdMachineName = React.useCallback((machineId: string) => {
    const m = machines.find(x => x.machine_id === machineId);
    return m?.machine_name || m?.name || '';
  }, [machines]);

  const calcDuration = (start: string, finish: string) => {
    if (!start || !finish) return null;
    const minsRaw = (new Date(finish).getTime() - new Date(start).getTime()) / 60000;
    const mins = Math.round(minsRaw * 10) / 10;
    return Number.isFinite(mins) && mins >= 0 ? mins : null;
  };

  const isProdCycleActive = (status: number) => status === 0 || status === 1;

  const calcLiveDuration = (start: string, finish: string, status: number, now = prodLiveNow) => {
    if (!start) return null;
    const startMs = new Date(start).getTime();
    if (Number.isNaN(startMs)) return null;
    const endMs = isProdCycleActive(status)
      ? now.getTime()
      : finish
        ? new Date(finish).getTime()
        : NaN;
    if (Number.isNaN(endMs)) return null;
    const mins = Math.round(((endMs - startMs) / 60000) * 10) / 10;
    return Number.isFinite(mins) && mins >= 0 ? mins : null;
  };

  const calcEfficiency = (targetMins: number, start: string, finish: string, status = 2) =>
    calcProdEfficiency(targetMins, start, finish, status, prodLiveNow);

  const effBadge = (pct: number | null) => {
    if (pct === null) return <span className="text-gray-400 text-xs">-</span>;
    const cls =
      pct > 150
        ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-200'
        : pct >= 90
          ? 'bg-green-100 text-green-700'
          : pct >= 70
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-red-100 text-red-700';
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{pct}%</span>;
  };

  const prodStatusBadge = (status: number) => {
    const pulse = isProdCycleActive(status) ? (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
    ) : null;
    if (status === 2) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Finished</span>;
    if (status === 1) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-200">
          {pulse}
          In progress
        </span>
      );
    }
    if (status === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 ring-1 ring-orange-200">
          {pulse}
          Started
        </span>
      );
    }
    if (status === 3) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Idle</span>;
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Status {status}</span>;
  };

  const loadProdRecords = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setProdLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production`);
      const json = await res.json();
      if (!json.success) return;

      let rows = (json.data || []).filter((r: any) => {
        const isManual = r.stoppage_reason && String(r.stoppage_reason).startsWith('MANUAL:');
        if (isManual) return false;
        const status = Number(r.button_status);
        if (prodIncludeInProgress) return status !== 3;
        return status === 2;
      });
      if (prodDateFilter) rows = rows.filter((r: any) => {
        const startDate = r.start_time ? new Date(r.start_time).toLocaleDateString('en-CA') : '';
        return startDate >= prodDateFilter && startDate <= (prodToDateFilter || prodDateFilter);
      });
      if (prodLineFilter) rows = rows.filter((r: any) => String(r.work_centre_id) === prodLineFilter);
      if (prodMachineFilter) rows = rows.filter((r: any) => String(r.machine_id) === prodMachineFilter);
      if (prodFinishedView !== 'all') {
        const getFinishMs = (r: any) => {
          const raw = r.finish_time || r.updated_at || r.start_time;
          const ts = raw ? new Date(raw).getTime() : 0;
          return Number.isNaN(ts) ? 0 : ts;
        };
        rows = rows
          .filter((r: any) => Number(r.button_status) === 2)
          .sort((a: any, b: any) => getFinishMs(b) - getFinishMs(a));

        if (prodFinishedView === 'recent_finished') {
          rows = rows.slice(0, 50);
        } else if (prodFinishedView === 'last_finished') {
          const lastByMachine = new Map<string, any>();
          rows.forEach((row: any) => {
            const key = String(row.machine_id);
            if (!lastByMachine.has(key)) {
              lastByMachine.set(key, row);
            }
          });
          rows = Array.from(lastByMachine.values());
        }
      }
      const prevIds = prodKnownIdsRef.current;
      const incomingIds = new Set<number>(rows.map((r: any) => Number(r.id)));
      if (prevIds.size > 0) {
        const fresh = new Set<number>();
        rows.forEach((r: any) => {
          const id = Number(r.id);
          if (!prevIds.has(id)) fresh.add(id);
        });
        if (fresh.size > 0) {
          setProdNewCycleIds((prev) => new Set([...prev, ...fresh]));
        }
      }
      prodKnownIdsRef.current = incomingIds;
      setProdRecords(rows);
      if (!opts?.silent) setProdPage(0);
      setProdLastRefreshedAt(new Date());
    } catch { toast.error('Failed to load production records'); }
    finally { setProdLoading(false); }
  }, [prodDateFilter, prodToDateFilter, prodLineFilter, prodMachineFilter, prodIncludeInProgress, prodFinishedView]);

  const prodInProgressCount = React.useMemo(
    () => prodRecords.filter((r) => {
      const status = Number(r.button_status);
      return status === 0 || status === 1;
    }).length,
    [prodRecords]
  );

  const prodFlaggedCount = React.useMemo(() => {
    const ctxMap = buildProdCycleContextMap(prodRecords);
    return prodRecords.filter((r) => {
      const ctx = ctxMap.get(Number(r.id)) ?? { prevFinishTime: null, cycleNumber: 1, operatorChanged: false };
      return analyzeProdCycle(r, ctx, prodLiveNow).isSuspicious;
    }).length;
  }, [prodRecords, prodLiveNow]);

  React.useEffect(() => {
    if (activeTab !== 'production') return undefined;
    const timer = window.setInterval(() => {
      if (prodInProgressCount > 0) setProdLiveNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTab, prodInProgressCount]);

  React.useEffect(() => {
    prodKnownIdsRef.current = new Set();
    setProdNewCycleIds(new Set());
  }, [prodDateFilter, prodToDateFilter, prodLineFilter, prodMachineFilter, prodFinishedView]);

  React.useEffect(() => {
    if (activeTab !== 'production') return;
    void loadProdRecords({ silent: true });
  }, [prodDateFilter, prodToDateFilter, prodLineFilter, prodMachineFilter, prodIncludeInProgress, prodFinishedView]);

  React.useEffect(() => {
    if (activeTab !== 'production' || !prodAutoRefresh) return undefined;
    const timer = window.setInterval(() => void loadProdRecords({ silent: true }), 30_000);
    return () => window.clearInterval(timer);
  }, [activeTab, prodAutoRefresh, loadProdRecords]);

  React.useEffect(() => {
    if (activeTab !== 'production') return undefined;
    const timer = window.setInterval(() => setProdLiveTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  React.useEffect(() => {
    if (prodNewCycleIds.size === 0) return undefined;
    const timer = window.setTimeout(() => setProdNewCycleIds(new Set()), 45_000);
    return () => window.clearTimeout(timer);
  }, [prodNewCycleIds]);

  const prodSecondsSinceRefresh = React.useMemo(() => {
    if (!prodLastRefreshedAt) return null;
    void prodLiveTick;
    return Math.max(0, Math.floor((Date.now() - prodLastRefreshedAt.getTime()) / 1000));
  }, [prodLastRefreshedAt, prodLiveTick]);

  // Detect conflicts: manual entries that overlap real cycles
  const detectConflicts = React.useCallback(async () => {
    if (!manualEntries.length) { setConflictIds(new Set()); return; }
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production`);
      const json = await res.json();
      if (!json.success) return;
      const realCycles = (json.data || []).filter((r: any) =>
        Number(r.button_status) === 2 &&
        (!r.stoppage_reason || !String(r.stoppage_reason).startsWith('MANUAL:'))
      );
      const conflicts = new Set<number>();
      manualEntries.forEach((m) => {
        const mStart = new Date(m.start_time).getTime();
        const mEnd = new Date(m.finish_time).getTime();
        const hasOverlap = realCycles.some((r: any) =>
          r.machine_id === m.machine_id && r.emp_id === m.emp_id &&
          new Date(r.start_time).getTime() < mEnd &&
          new Date(r.finish_time).getTime() > mStart
        );
        if (hasOverlap) conflicts.add(m.id);
      });
      setConflictIds(conflicts);
    } catch { /* silent */ }
  }, [manualEntries]);

  React.useEffect(() => { detectConflicts(); }, [detectConflicts]);

  const loadSummary = React.useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production`);
      const json = await res.json();
      if (!json.success) return;
      const allRows = (json.data || []).filter((r: any) => {
        const d = r.start_time ? new Date(r.start_time).toLocaleDateString('en-CA') : '';
        return Number(r.button_status) === 2 && d === summaryDate;
      });
      // Group by machine_id
      const map = new Map<string, any>();
      allRows.forEach((r: any) => {
        const key = r.machine_id;
        if (!map.has(key)) {
          const mName = machines.find(x => x.machine_id === key);
          map.set(key, {
            machine_id: key,
            machine_name: mName?.machine_name || mName?.name || '',
            work_centre_name: r.work_centre_name || r.work_centre_id,
            real_cycles: 0, manual_cycles: 0,
            real_output: 0, manual_output: 0,
            eff_values: [] as number[],
          });
        }
        const g = map.get(key);
        const isManual = r.stoppage_reason && String(r.stoppage_reason).startsWith('MANUAL:');
        const dur = r.start_time && r.finish_time
          ? Math.round((new Date(r.finish_time).getTime() - new Date(r.start_time).getTime()) / 60000) : 0;
        if (isManual) { g.manual_cycles++; g.manual_output += Number(r.output_pairs || 0); }
        else { g.real_cycles++; g.real_output += Number(r.output_pairs || 0); }
        if (dur > 0 && Number(r.target_mins || 0) > 0)
          g.eff_values.push(Math.round((Number(r.target_mins) / dur) * 100));
      });
      const result = Array.from(map.values()).map(g => ({
        ...g,
        total_cycles: g.real_cycles + g.manual_cycles,
        total_output: g.real_output + g.manual_output,
        avg_eff: g.eff_values.length ? Math.round(g.eff_values.reduce((a: number, b: number) => a + b, 0) / g.eff_values.length) : null,
      })).sort((a, b) => b.total_output - a.total_output);
      setSummaryData(result);
    } catch { toast.error('Failed to load summary'); }
    finally { setSummaryLoading(false); }
  }, [summaryDate, machines]);

  React.useEffect(() => {
    if (activeTab === 'summary') loadSummary();
  }, [activeTab, loadSummary]);

  const handleProdEdit = (row: any) => {
    setEditingProdId(row.id);
    const fmt = (v: string) => {
      if (!v) return '';
      const d = new Date(v);
      const pad = (n: number) => String(n).padStart(2, '0');
      if (Number.isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    setProdStartTime(fmt(row.start_time));
    setProdFinishTime(fmt(row.finish_time));
    setProdOutputPairs(String(Number(row.output_pairs || 0)));
    setProdTargetMins(String(Number(row.target_mins || 0)));
    setShowProdEditForm(true);
  };

  const handleProdSave = async () => {
    if (!editingProdId) return;
    setLoading(true);
    try {
      const row = prodRecords.find(r => r.id === editingProdId);
      if (!row) return;
      const machineKeyToReopen = String(row.machine_id);
      const toLocal = (v: string) => {
        if (!v) return null;
        // datetime-local may be yyyy-mm-ddThh:mm or yyyy-mm-ddThh:mm:ss
        const normalized = v.length === 16 ? `${v}:00` : v;
        return normalized.replace('T', ' ');
      };
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/${editingProdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prod_date: parseProdDateKey(row.prod_date),
          work_centre_id: row.work_centre_id,
          machine_id: row.machine_id,
          emp_id: row.emp_id,
          output_pairs: Number(prodOutputPairs),
          target_mins: Number(prodTargetMins),
          start_time: toLocal(prodStartTime),
          finish_time: toLocal(prodFinishTime),
        }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message || 'Failed to update'); return; }
      toast.success('Record updated');
      setShowProdEditForm(false);
      setEditingProdId(null);
      await loadProdRecords();
      // Only keep the edited machine expanded (avoids fighting other open keys after refresh)
      setProdMachineAccordionOpen({ [machineKeyToReopen]: true });
    } catch { toast.error('Failed to update record'); }
    finally { setLoading(false); }
  };

  const handleProdDelete = async (row: any) => {
    if (!row?.id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/${row.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'Failed to delete production record');
        return;
      }
      toast.success('Production record deleted');
      if (editingProdId === row.id) {
        setShowProdEditForm(false);
        setEditingProdId(null);
      }
      setProdDeleteCandidate(null);
      await loadProdRecords();
    } catch {
      toast.error('Failed to delete production record');
    } finally {
      setLoading(false);
    }
  };

  const performSave = async (
    payload: Record<string, unknown>,
    opts: { slotLabel: string; hourlySlotValue: string; isNewEntry: boolean }
  ) => {
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API_BASE_URL}/api/mobile-production/manual-entry/${editingId}`
        : `${API_BASE_URL}/api/mobile-production/manual-entry`;
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.status === 401) {
        handleUnauthorized(result.message);
        return;
      }
      if (!result.success) {
        toast.error(result.message || 'Failed to save manual entry');
        return;
      }

      await loadManualEntries();
      void loadTodayCoverage();

      const nextSlot =
        opts.isNewEntry && continueNextHour && slotType === 'hourly' && opts.hourlySlotValue
          ? getNextFactoryHourlySlot(opts.hourlySlotValue, entryDate, new Date())
          : null;

      if (nextSlot) {
        const nextLabel = FACTORY_HOURLY_SLOTS.find((s) => s.value === nextSlot)?.label || nextSlot;
        toast.success(`Saved ${opts.slotLabel}. Next: ${nextLabel}`);
        setEditingId(null);
        setHourlySlot(nextSlot);
        setStoppageReason('');
        setEditReason('');
        setSlotConflictWarning('');
        setShowForm(true);
        return;
      }

      toast.success(
        editingId
          ? `Updated. Total output today: ${result.data?.total_output_pairs ?? '-'}`
          : `Saved. Total output today: ${result.data?.total_output_pairs ?? '-'}`
      );
      clearForm();
    } catch (error) {
      console.error('Manual entry save failed:', error);
      toast.error('Failed to save manual entry');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usingManualSlot = slotType === 'manual';
    if (!workCentreId || !machineId || !empId || (!usingManualSlot && !hourlySlot) || (usingManualSlot && (!manualStartTime || !manualFinishTime))) {
      toast.error('Please fill required fields');
      return;
    }
    let slotHour = 0;
    let slotMinute = 0;
    let slotStartMinutes = 0;
    let slotEndMinutes = 0;
    if (usingManualSlot) {
      const startMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(manualStartTime);
      const finishMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(manualFinishTime);
      if (!startMatch || !finishMatch) {
        toast.error('Please choose valid manual start and finish times');
        return;
      }
      slotHour = Number(startMatch[1]);
      slotMinute = Number(startMatch[2]);
      const finishHourInput = Number(finishMatch[1]);
      const finishMinuteInput = Number(finishMatch[2]);
      slotStartMinutes = slotHour * 60 + slotMinute;
      slotEndMinutes = finishHourInput * 60 + finishMinuteInput;
      if (slotStartMinutes < 540 || slotEndMinutes > 1140) {
        toast.error('Time must be between 9:00 AM and 7:00 PM');
        return;
      }
      if (slotEndMinutes <= slotStartMinutes) {
        toast.error('Manual finish time must be later than start time');
        return;
      }
    } else {
      const slotMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hourlySlot);
      if (!slotMatch) {
        toast.error('Please choose a valid time slot');
        return;
      }
      slotHour = Number(slotMatch[1]);
      slotMinute = Number(slotMatch[2]);
      slotStartMinutes = slotHour * 60 + slotMinute;
      slotEndMinutes = slotStartMinutes + selectedSlotMinutes;
      if (slotEndMinutes > 24 * 60) {
        toast.error('Selected slot crosses to next day. Please choose a valid slot.');
        return;
      }
    }
    const slotStartLabel = formatTimeFromMinutes(slotStartMinutes);
    const slotEndLabel = formatTimeFromMinutes(slotEndMinutes);
    // Block future slots
    const now = new Date();
    const slotStart = new Date(`${entryDate}T${pad2(slotHour)}:${pad2(slotMinute)}:00`);
    if (slotStart > now) {
      toast.error(`Cannot add manual entry for a future time slot (${slotStartLabel}-${slotEndLabel}).`);
      return;
    }
    // Reason required
    if (!stoppageReason.trim()) {
      toast.error('Reason is required for manual entries.');
      return;
    }
    const entriesForDupCheck =
      entryDate === tableDateFilter && todayCoverageManual.length > 0
        ? todayCoverageManual
        : manualEntries;
    const cyclesForDupCheck =
      entryDate === tableDateFilter && todayCoverageCycles.length > 0
        ? todayCoverageCycles
        : [];
    const overlapConflict = detectSlotOverlapConflict({
      machineId,
      dateKey: entryDate,
      slotStartMinutes,
      slotEndMinutes,
      manualEntries: entriesForDupCheck,
      cycles: cyclesForDupCheck,
      editingId,
    });
    if (!editingId && overlapConflict.blocked) {
      setSlotConflictWarning(overlapConflict.message);
      toast.error(overlapConflict.message);
      return;
    }
    if (editingId && !editReason.trim()) {
      toast.error('Please provide an edit reason.');
      return;
    }
    const outputValue = Math.round(Number(outputPairs || 0));
    if (Number.isNaN(outputValue) || outputValue < 0) {
      toast.error('Output pairs must be 0 or greater');
      return;
    }
    const finishHour = Math.floor(slotEndMinutes / 60);
    const finishMinute = slotEndMinutes % 60;
    const startTime = `${entryDate}T${pad2(slotHour)}:${pad2(slotMinute)}:00`;
    const finishTime = `${entryDate}T${pad2(finishHour)}:${pad2(finishMinute)}:00`;

    const payload = {
      prod_date: entryDate,
      work_centre_id: Number(workCentreId),
      machine_id: machineId,
      emp_id: empId,
      start_time: startTime,
      finish_time: finishTime,
      target_mins: Number(targetMins || 0),
      output_pairs: outputValue,
      stoppage_reason: stoppageReason.trim() || null,
      approved_by: currentUser?.username || currentUser?.name || currentUser?.email || currentUser?.id || null,
      entry_type: 'production',
      audit_reason: editingId ? editReason.trim() : undefined,
    };

    const hourlySlotValue = usingManualSlot ? '' : hourlySlot;
    const mesOutput =
      !usingManualSlot && hourlySlotValue
        ? getMesOutputForHourlySlot(todayCoverageCycles, machineId, entryDate, hourlySlotValue)
        : 0;

    if (!editingId && mesOutput > 0) {
      if (mesOutput === outputValue) {
        toast.error('Mobile already recorded this slot with the same output. No duplicate manual entry needed.');
        return;
      }
      setMesCompare({
        mesOutput,
        enteredOutput: outputValue,
        payload,
        slotLabel: `${slotStartLabel}-${slotEndLabel}`,
        hourlySlot: hourlySlotValue,
        entryDate,
      });
      return;
    }

    await performSave(payload, {
      slotLabel: `${slotStartLabel}-${slotEndLabel}`,
      hourlySlotValue,
      isNewEntry: !editingId,
    });
  };

  const resolveMesCompare = async (action: 'use_mes' | 'keep_mine' | 'cancel') => {
    if (!mesCompare) return;
    if (action === 'cancel') {
      setMesCompare(null);
      return;
    }
    const payload = { ...mesCompare.payload };
    if (action === 'use_mes') {
      payload.output_pairs = mesCompare.mesOutput;
    } else {
      const note = `(Manual override: mobile showed ${mesCompare.mesOutput}, entered ${mesCompare.enteredOutput})`;
      const reason = String(payload.stoppage_reason || '').trim();
      payload.stoppage_reason = reason.includes('Manual override:') ? reason : `${reason} ${note}`.trim();
    }
    setMesCompare(null);
    await performSave(payload, {
      slotLabel: mesCompare.slotLabel,
      hourlySlotValue: mesCompare.hourlySlot,
      isNewEntry: true,
    });
  };

  const handleEdit = (row: ManualEntryRow) => {
    const start = new Date(row.start_time);
    const derivedHour = Number.isNaN(start.getTime()) ? 0 : start.getHours();
    const derivedMinute = Number.isNaN(start.getTime()) ? 0 : start.getMinutes();
    setShowForm(true);
    setEditingId(row.id);
    setEntryDate(parseProdDateKey(row.prod_date) || getTodayLocalDate());
    setWorkCentreId(String(row.work_centre_id));
    setMachineId(row.machine_id);
    setEmpId(row.emp_id);
    setHourlySlot(`${pad2(Math.max(0, Math.min(23, derivedHour)))}:${pad2(derivedMinute)}`);
    setTargetMins(String(Number(row.target_mins || 0)));
    setOutputPairs(String(Number(row.output_pairs || 0)));
    setStoppageReason(
      (row.stoppage_reason || '')
        .replace(/^MANUAL:/, '')
        .replace(/\s*\[Approved By:[^\]]+\]\s*$/i, '')
        .trim()
    );
    setEditReason('');
  };

  const handleDelete = async (row: ManualEntryRow, reason: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        prod_date: parseProdDateKey(row.prod_date),
        work_centre_id: String(row.work_centre_id),
      });
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/${row.id}?${params.toString()}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_reason: reason }),
      });
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized(json.message);
        return;
      }
      if (!json.success) {
        toast.error(json.message || 'Failed to delete manual entry');
        return;
      }
      toast.success('Manual entry deleted');
      await loadManualEntries();
      void loadTodayCoverage();
      if (editingId === row.id) clearForm();
      setDeleteCandidate(null);
      setDeleteReason('');
    } catch (error) {
      console.error('Failed to delete manual entry:', error);
      toast.error('Failed to delete manual entry');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = React.useCallback(async (entryId?: number) => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (entryId) params.set('entry_id', String(entryId));
      if (auditSearch.trim()) params.set('search', auditSearch.trim());
      params.set('page', String(auditPage));
      params.set('limit', auditLimit);
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized(json.message);
        return;
      }
      if (!json.success) {
        toast.error(json.message || 'Failed to load audit logs');
        setAuditLogs([]);
        setAuditTotal(0);
        setAuditTotalPages(1);
        return;
      }
      setAuditLogs(json.data || []);
      setAuditTotal(Number(json.meta?.total || 0));
      setAuditTotalPages(Number(json.meta?.total_pages || 1));
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Failed to load audit logs');
      setAuditLogs([]);
      setAuditTotal(0);
      setAuditTotalPages(1);
    } finally {
      setAuditLoading(false);
    }
  }, [auditSearch, auditPage, auditLimit, handleUnauthorized]);

  const handleOpenAudit = async (entryId?: number) => {
    if (!requestDiscardManualFormChanges()) return;
    setActiveTab('audit');
    setAuditEntryId(entryId || null);
    setAuditPage(1);
    setAuditPageInput('1');
    await loadAuditLogs(entryId);
  };

  const handleRestoreFromAudit = async (log: ManualEntryAuditRow) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/audit-logs/${log.id}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized(json.message);
        return;
      }
      if (!json.success) {
        toast.error(json.message || 'Failed to restore entry');
        return;
      }
      toast.success('Manual entry restored');
      await Promise.all([loadManualEntries(), handleOpenAudit(auditEntryId || undefined)]);
      void loadTodayCoverage();
      setRestoreCandidate(null);
      setActiveTab('entries');
    } catch (error) {
      console.error('Failed to restore manual entry:', error);
      toast.error('Failed to restore entry');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const run = async () => {
      try {
        const params = new URLSearchParams();
        if (tableDateFilter && tableToDateFilter && tableDateFilter === tableToDateFilter) {
          params.set('date', tableDateFilter);
        } else {
          if (tableDateFilter) params.set('from_date', tableDateFilter);
          if (tableToDateFilter) params.set('to_date', tableToDateFilter);
        }
        if (tableWorkCentreFilter) params.set('work_centre_id', tableWorkCentreFilter);
        if (tableSearch.trim()) params.set('search', tableSearch.trim());
        params.set('page', '1');
        params.set('limit', 'all');
        params.set('sort_by', tableSortBy);
        params.set('sort_order', tableSortOrder);
        const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry?${params.toString()}`);
        const json = await res.json();
        if (res.status === 401) {
          handleUnauthorized(json.message);
          return;
        }
        if (!json.success) {
          toast.error(json.message || 'Failed to export manual entries');
          return;
        }

        const allRows: ManualEntryRow[] = Array.isArray(json.data) ? json.data : [];
        const rows = allRows.map((row) => ({
          Date: formatDisplayDate(row.prod_date),
          Line: row.work_centre_name || row.work_centre_id,
          Machine: `${row.machine_id}${row.machine_name ? ` - ${row.machine_name}` : ''}`,
          Employee: `${row.emp_id}${row.employee_name ? ` - ${row.employee_name}` : ''}`,
          Start: formatDisplayDateTime(row.start_time),
          End: formatDisplayDateTime(row.finish_time),
          Target: Number(row.target_mins || 0).toFixed(1),
          Output: Number(row.output_pairs || 0),
        }));
        const headers = ['Date', 'Line', 'Machine', 'Employee', 'Start', 'End', 'Target', 'Output'];
        const csvBody = [
          headers.join(','),
          ...rows.map((r) =>
            headers
              .map((h) => {
                const value = String((r as any)[h] ?? '');
                return `"${value.replace(/"/g, '""')}"`;
              })
              .join(',')
          ),
          `,,,,,,Filtered Total,${Number(json.meta?.total_output_pairs || 0)}`,
        ].join('\n');
        const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manual_entries_${tableDateFilter || 'all'}_to_${tableToDateFilter || tableDateFilter || 'all'}_filtered.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to export manual entries:', error);
        toast.error('Failed to export manual entries');
      }
    };
    run();
  };

  const handleExportAuditCsv = () => {
    const headers = ['Action', 'Entry ID', 'User', 'Role', 'Reason', 'Time', 'Before JSON', 'After JSON'];
    const csvBody = [
      headers.join(','),
      ...auditLogs.map((log) => {
        const row = [
          log.action,
          log.entry_id ?? '',
          log.actor_username || '',
          log.actor_role || '',
          log.reason || '',
          formatDisplayDateTime(log.created_at),
          JSON.stringify(parseAuditJson(log.before_data)),
          JSON.stringify(parseAuditJson(log.after_data)),
        ];
        return row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = auditEntryId ? `manual_entry_audit_${auditEntryId}.csv` : 'manual_entry_audit_logs.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSort = (field: string) => {
    if (tableSortBy === field) {
      setTableSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortBy(field);
      setTableSortOrder('desc');
    }
    setTablePage(1);
  };

  const sortLabel = (field: string, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-blue-700 transition-colors"
      title={`Sort by ${label}`}
    >
      {label}
      {tableSortBy === field ? (
        <span className="text-blue-600">{tableSortOrder === 'asc' ? '▲' : '▼'}</span>
      ) : null}
    </button>
  );

  return (
    <div className="w-full px-2 sm:px-3 md:px-4">
      {!isAuthenticated && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 text-lg font-bold mb-1">Access Restricted</div>
          <p className="text-red-500 text-sm">Please log in to access this page.</p>
        </div>
      )}
      {isAuthenticated && (
      <>
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-entry-modal-title"
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden ring-1 ring-blue-200/60 flex flex-col max-h-[96dvh] sm:max-h-[92vh]">
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-4 py-4 sm:px-6 text-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <ClipboardList className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 id="manual-entry-modal-title" className="text-base sm:text-xl font-bold leading-snug break-words">
                      {editingId ? 'Edit Manual Entry' : 'New Manual Production Entry'}
                    </h2>
                    <p className="text-xs sm:text-sm text-white/90 mt-1 leading-relaxed">
                      {editingId
                        ? 'Update saved cycle — production date stays as recorded'
                        : 'Supervisor entry for a completed cycle not captured on mobile'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearForm}
                  className="shrink-0 rounded-full p-1.5 text-white/90 hover:bg-white/20 transition-colors -mr-1"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-white/20 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <label
                  htmlFor="manual-entry-prod-date"
                  className="text-[10px] sm:text-xs uppercase tracking-wider text-white/80 font-semibold"
                >
                  Production date
                </label>
                <input
                  id="manual-entry-prod-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full sm:w-auto sm:min-w-[10.5rem] border border-white/40 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm shadow-sm disabled:opacity-60"
                  disabled={loading}
                />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5">
              {editingId && parseProdDateKey(entryDate) !== getTodayLocalDate() && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This entry is for <span className="font-semibold">{formatProdDateKey(entryDate)}</span>. Use Add New Entry for today.
                </p>
              )}

              <section className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 sm:p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Line &amp; team</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Building2 className="h-4 w-4 text-gray-400" aria-hidden />
                      Line <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={workCentreId}
                      onChange={(e) => setWorkCentreId(e.target.value)}
                      className={MANUAL_ENTRY_FIELD_CLS}
                      required
                      disabled={loading}
                    >
                      <option value="">Select line</option>
                      {workCentres.map((wc) => (
                        <option key={wc.id} value={wc.id}>{wc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Cpu className="h-4 w-4 text-gray-400" aria-hidden />
                      Machine <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={machineId}
                      onChange={(e) => setMachineId(e.target.value)}
                      className={MANUAL_ENTRY_FIELD_CLS}
                      required
                      disabled={loading || !workCentreId}
                    >
                      <option value="">Select machine</option>
                      {filteredMachines.map((m) => (
                        <option key={m.machine_id} value={m.machine_id}>
                          {m.machine_id} - {m.machine_name || m.name || 'Machine'}
                        </option>
                      ))}
                    </select>
                    {!editingId && canMutate && machineId ? (
                      <button
                        type="button"
                        onClick={copyLastEntryOnMachine}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        Copy last entry on this machine
                      </button>
                    ) : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5" htmlFor="manual-entry-employee">
                      <User className="h-4 w-4 text-gray-400" aria-hidden />
                      Employee <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      id="manual-entry-employee"
                      value={empId}
                      onChange={setEmpId}
                      options={employeeSelectOptions}
                      loadOptions={loadEmployeeOptions}
                      placeholder="Select employee"
                      searchPlaceholder="Search by code or name..."
                      required
                      disabled={loading || !workCentreId}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-3 sm:p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Slot &amp; output</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                      <Clock className="h-4 w-4 text-gray-400" aria-hidden />
                      Slot type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SLOT_TYPES.map((slot) => (
                        <button
                          key={slot.value}
                          type="button"
                          onClick={() => {
                            setSlotType(slot.value as SlotType);
                            setHourlySlot('');
                            setManualStartTime('');
                            setManualFinishTime('');
                          }}
                          disabled={loading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 ${
                            slotType === slot.value
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {slotType === 'manual' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Start <span className="text-red-500">*</span></label>
                        <input
                          type="time"
                          min="09:00"
                          max="19:00"
                          value={manualStartTime}
                          onChange={(e) => setManualStartTime(e.target.value)}
                          className={MANUAL_ENTRY_FIELD_CLS}
                          required
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Finish <span className="text-red-500">*</span></label>
                        <input
                          type="time"
                          min="09:00"
                          max="19:00"
                          value={manualFinishTime}
                          onChange={(e) => setManualFinishTime(e.target.value)}
                          className={MANUAL_ENTRY_FIELD_CLS}
                          required
                          disabled={loading}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Time slot <span className="text-red-500">*</span></label>
                      <select
                        value={hourlySlot}
                        onChange={(e) => setHourlySlot(e.target.value)}
                        className={MANUAL_ENTRY_FIELD_CLS}
                        required
                        disabled={loading}
                      >
                        <option value="">Select time slot</option>
                        {slotOptions.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Package className="h-4 w-4 text-gray-400" aria-hidden />
                      Output pairs <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={outputPairs}
                      onChange={(e) => setOutputPairs(e.target.value)}
                      className={MANUAL_ENTRY_FIELD_CLS}
                      required
                      disabled={loading}
                    />
                    {expectedSlotOutput !== null && slotType === 'hourly' && (
                      <p className="text-xs text-blue-800 mt-1.5 bg-blue-50 border border-blue-100 rounded-md px-2 py-1">
                        Expected (routing pace): <span className="font-bold">{expectedSlotOutput}</span> pairs
                        {Number(outputPairs || 0) > 0 && expectedSlotOutput > 0 && (
                          <span
                            className={`ml-1 font-semibold ${
                              Number(outputPairs) >= expectedSlotOutput ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            ({Number(outputPairs) >= expectedSlotOutput ? 'on pace' : `${expectedSlotOutput - Number(outputPairs)} below`})
                          </span>
                        )}
                      </p>
                    )}
                    {mesSlotOutput !== null && mesSlotOutput > 0 && slotType === 'hourly' && (
                      <p className="text-xs text-indigo-700 mt-1.5 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1">
                        Mobile recorded <span className="font-bold">{mesSlotOutput}</span> pairs for this hour.
                      </p>
                    )}
                    {slotConflictWarning && (
                      <p className="text-xs text-red-800 mt-1.5 bg-red-50 border border-red-200 rounded-md px-2 py-1 font-medium">
                        {slotConflictWarning}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Target time (mins)
                      {loadingTargetMins ? <Loader2 className="inline h-3.5 w-3.5 animate-spin text-blue-500 ml-1" /> : null}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={(() => {
                        const base = Number(targetMins || 0);
                        const pairs = Math.max(1, Number(outputPairs || 12));
                        return (Math.round((base * (pairs / 6)) * 10) / 10).toFixed(1);
                      })()}
                      readOnly
                      className={`${MANUAL_ENTRY_FIELD_CLS} bg-gray-50 text-gray-600`}
                    />
                    <p className="text-xs text-gray-500 mt-1">Scaled to output pairs</p>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 sm:p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Reason &amp; approval</h3>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <FileText className="h-4 w-4 text-gray-400" aria-hidden />
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {MANUAL_REASON_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => appendReasonChip(chip)}
                          disabled={loading}
                          className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors disabled:opacity-50"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={stoppageReason}
                      onChange={(e) => setStoppageReason(e.target.value)}
                      className={`${MANUAL_ENTRY_FIELD_CLS} min-h-[88px] resize-y ${!stoppageReason.trim() ? 'border-red-300 bg-red-50' : ''}`}
                      placeholder="Required: explain why this cycle was entered manually"
                      disabled={loading}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Approved by</label>
                      <input
                        type="text"
                        value={String(currentUser?.username || currentUser?.name || currentUser?.email || currentUser?.id || 'Current user')}
                        className={`${MANUAL_ENTRY_FIELD_CLS} bg-gray-50 text-gray-600`}
                        disabled
                        readOnly
                      />
                    </div>
                    {editingId ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Edit reason <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className={`${MANUAL_ENTRY_FIELD_CLS} ${!editReason.trim() ? 'border-red-300 bg-red-50' : ''}`}
                          placeholder="Why are you changing this entry?"
                          disabled={loading}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-3 pt-2 sm:pt-1 border-t border-gray-100 pb-[env(safe-area-inset-bottom,0px)]">
                {!editingId && slotType === 'hourly' ? (
                  <label className="inline-flex items-start sm:items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={continueNextHour}
                      onChange={(e) => setContinueNextHour(e.target.checked)}
                      className="h-4 w-4 mt-0.5 sm:mt-0 shrink-0 rounded border-gray-300 text-blue-600"
                    />
                    After save, open next hour slot
                  </label>
                ) : null}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!requestDiscardManualFormChanges()) return;
                      clearForm();
                    }}
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Saving…
                      </span>
                    ) : editingId ? (
                      'Update entry'
                    ) : (
                      'Save entry'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {mesCompare && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-indigo-200/60"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 text-white">
              <h2 className="text-lg font-bold">Mobile vs manual output</h2>
              <p className="text-sm text-white/90 mt-1">Choose which value to save for this slot.</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">
                Slot <span className="font-semibold text-gray-900">{mesCompare.slotLabel}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-center">
                  <p className="text-xs uppercase tracking-wider text-indigo-600 font-semibold">Mobile</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">{mesCompare.mesOutput}</p>
                  <p className="text-xs text-gray-500">pairs</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                  <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Your entry</p>
                  <p className="text-2xl font-bold text-amber-800 mt-1">{mesCompare.enteredOutput}</p>
                  <p className="text-xs text-gray-500">pairs</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => resolveMesCompare('cancel')}
                  disabled={loading}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => resolveMesCompare('keep_mine')}
                  disabled={loading}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                  Keep {mesCompare.enteredOutput}
                </button>
                <button
                  type="button"
                  onClick={() => resolveMesCompare('use_mes')}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                  Use mobile ({mesCompare.mesOutput})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {restoreCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="restore-manual-entry-title" className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 id="restore-manual-entry-title" className="text-lg font-bold text-gray-900">Restore Manual Entry</h2>
            <p className="text-sm text-gray-600 mt-2">
              Restore deleted entry from audit log{' '}
              <span className="font-semibold">#{restoreCandidate.id}</span>?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This will recreate the deleted production row and recalculate summary totals.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreCandidate(null)}
                disabled={loading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRestoreFromAudit(restoreCandidate)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                {loading ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-delete-manual-entry-title" className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 id="bulk-delete-manual-entry-title" className="text-lg font-bold text-gray-900">Bulk Delete Manual Entries</h2>
            <p className="text-sm text-gray-600 mt-2">Delete <span className="font-semibold">{selectedEntryIds.size}</span> selected manual entries? This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkDeleteConfirm(false)} disabled={loading} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-60">Cancel</button>
              <button type="button" disabled={loading} onClick={async () => {
                setLoading(true);
                let failed = 0;
                for (const id of Array.from(selectedEntryIds)) {
                  const row = manualEntries.find(r => r.id === id);
                  if (!row) continue;
                  try {
                    const p = new URLSearchParams({ prod_date: parseProdDateKey(row.prod_date), work_centre_id: String(row.work_centre_id) });
                    const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/${id}?${p.toString()}`, { method: 'DELETE' });
                    const j = await res.json();
                    if (!j.success) failed++;
                  } catch { failed++; }
                }
                setLoading(false);
                setBulkDeleteConfirm(false);
                setSelectedEntryIds(new Set());
                toast[failed ? 'error' : 'success'](failed ? `${failed} deletions failed` : `${selectedEntryIds.size} entries deleted`);
                await loadManualEntries();
                void loadTodayCoverage();
              }} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60">{loading ? 'Deleting...' : 'Delete All'}</button>
            </div>
          </div>
        </div>
      )}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-manual-entry-title" className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 id="delete-manual-entry-title" className="text-lg font-bold text-gray-900">Delete Manual Entry</h2>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure you want to delete manual entry for{' '}
              <span className="font-semibold">
                {deleteCandidate.machine_id}
                {deleteCandidate.machine_name ? ` - ${deleteCandidate.machine_name}` : ''}
              </span>{' '}
              /{' '}
              <span className="font-semibold">
                {deleteCandidate.emp_id}
                {deleteCandidate.employee_name ? ` - ${deleteCandidate.employee_name}` : ''}
              </span>
              ?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This action updates summary totals and cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteCandidate(null);
                  setDeleteReason('');
                }}
                disabled={loading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deleteReason.trim()) {
                    toast.error('Delete reason is required.');
                    return;
                  }
                  handleDelete(deleteCandidate, deleteReason.trim());
                }}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delete Reason <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className={`w-full border rounded-lg p-2.5 ${!deleteReason.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                placeholder="Required: why are you deleting this entry?"
                disabled={loading}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-3 sm:p-4 md:p-6 mt-4">
        {isSingleDayEntriesView && tableWorkCentreFilter ? (
          <div className="mb-4">
            <ProductionDayLockPanel
              date={tableDateFilter}
              workCentreId={tableWorkCentreFilter}
              workCentreName={workCentres.find((wc) => String(wc.id) === String(tableWorkCentreFilter))?.name}
              onLockChange={setProductionDayLocked}
            />
          </div>
        ) : null}
        <div className="mb-4">
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-max items-center gap-2 whitespace-nowrap mb-3">
              <button
                type="button"
                onClick={() => withDiscardCheck(() => setActiveTab('entries'))}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'entries' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Manual Entries
              </button>
              <button
                type="button"
                onClick={() => withDiscardCheck(() => { setActiveTab('coverage'); void loadTodayCoverage(); })}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 ${activeTab === 'coverage' ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-800 hover:bg-teal-100'}`}
              >
                Coverage &amp; insights
                {shiftChecklistItems.length > 0 ? (
                  <span className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                    {shiftChecklistItems.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => handleOpenAudit()}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'audit' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}`}
              >
                Audit Logs
              </button>
              <button
                type="button"
                onClick={() => withDiscardCheck(() => { setActiveTab('production'); loadProdRecords(); })}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'production' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-800 hover:bg-orange-200'}`}
              >
                Live Production Records
              </button>
              <button
                type="button"
                onClick={() => withDiscardCheck(() => setActiveTab('summary'))}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'summary' ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-800 hover:bg-teal-200'}`}
              >
                Daily Summary
              </button>
              <button
                type="button"
                onClick={() => withDiscardCheck(() => setActiveTab('wip'))}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'wip' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'}`}
              >
                WIP Management
              </button>
            </div>
          </div>

          {activeTab === 'entries' ? (
          <>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
            <h3 className="text-lg font-bold text-gray-900">Manual Entries</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full lg:w-auto">
              <label className="text-xs text-gray-600 flex flex-col items-start gap-1 min-w-0">
                <span className="leading-none text-[11px] font-medium tracking-wide uppercase text-gray-500">From</span>
                <input
                  type="date"
                  value={tableDateFilter}
                  onChange={(e) => {
                    setTableDateFilter(e.target.value);
                    setTablePage(1);
                  }}
                  className="h-9 w-full border border-gray-300 rounded-lg px-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  title="From date"
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col items-start gap-1 min-w-0">
                <span className="leading-none text-[11px] font-medium tracking-wide uppercase text-gray-500">To</span>
                <input
                  type="date"
                  value={tableToDateFilter}
                  onChange={(e) => {
                    setTableToDateFilter(e.target.value);
                    setTablePage(1);
                  }}
                  className="h-9 w-full border border-gray-300 rounded-lg px-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  title="To date"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              value={tableWorkCentreFilter}
              onChange={(e) => {
                setTableWorkCentreFilter(e.target.value);
                setTablePage(1);
                setShowAllMissingSlots(false);
              }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-[140px]"
              title="Filter by line"
            >
              <option value="">All lines</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>{wc.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-2 mb-3">
            <button
              type="button"
              onClick={() => withDiscardCheck(() => {
                setShowForm(true);
                setEditingId(null);
                setEntryDate(getTodayLocalDate());
              })}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-semibold w-full ${!canMutate ? 'hidden' : ''}`}
            >
              Add New Entry
            </button>
            <button
              type="button"
              onClick={loadManualEntries}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-semibold w-full"
              disabled={loadingEntries}
            >
              {loadingEntries ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-semibold w-full"
              disabled={manualEntries.length === 0}
            >
              Export CSV
            </button>
            {canMutate && selectedEntryIds.size > 0 && (
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(true)}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold w-full"
              >
                Delete ({selectedEntryIds.size})
              </button>
            )}
            <div className="relative col-span-2 sm:col-span-2 md:col-span-2 xl:col-span-3 min-w-0">
              <input
                type="text"
                value={tableSearchInput}
                onChange={(e) => {
                  setTableSearchInput(e.target.value);
                }}
                className="border border-gray-300 rounded-lg px-2 py-2 pr-7 text-sm w-full"
                placeholder="Search machine/employee/line"
                title="Search by machine, employee or line"
              />
              {tableSearchInput.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setTableSearchInput('');
                    setTableSearch('');
                    setTablePage(1);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 px-1"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setTableDateFilter(getNowLocalDateTime().split('T')[0]);
                setTableToDateFilter(getNowLocalDateTime().split('T')[0]);
                setTableWorkCentreFilter('');
                setTableSearch('');
                setTableSearchInput('');
                setTableSortBy('created_at');
                setTableSortOrder('desc');
                setTablePage(1);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-semibold w-full"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => {
                const payload = {
                  tableWorkCentreFilter,
                  tableSearchInput,
                  tableLimit,
                  tableSortBy,
                  tableSortOrder,
                };
                localStorage.setItem(FILTER_PRESET_KEY, JSON.stringify(payload));
                toast.success('Filter preset saved');
              }}
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap w-full"
            >
              Save Filters
            </button>
          </div>
          </>
          ) : activeTab === 'coverage' ? (
          <>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
            <h3 className="text-lg font-bold text-gray-900">Coverage &amp; insights</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full lg:w-auto">
              <label className="text-xs text-gray-600 flex flex-col items-start gap-1 min-w-0">
                <span className="leading-none text-[11px] font-medium tracking-wide uppercase text-gray-500">From</span>
                <input
                  type="date"
                  value={tableDateFilter}
                  onChange={(e) => setTableDateFilter(e.target.value)}
                  className="h-9 w-full border border-gray-300 rounded-lg px-2 text-sm shadow-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 bg-white"
                  title="From date"
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col items-start gap-1 min-w-0">
                <span className="leading-none text-[11px] font-medium tracking-wide uppercase text-gray-500">To</span>
                <input
                  type="date"
                  value={tableToDateFilter}
                  onChange={(e) => setTableToDateFilter(e.target.value)}
                  className="h-9 w-full border border-gray-300 rounded-lg px-2 text-sm shadow-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 bg-white"
                  title="To date"
                />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              value={tableWorkCentreFilter}
              onChange={(e) => {
                setTableWorkCentreFilter(e.target.value);
                setShowAllMissingSlots(false);
              }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-[140px]"
              title="Filter by line"
            >
              <option value="">All lines</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>{wc.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadTodayCoverage()}
              disabled={entryHintsLoading || !isSingleDayEntriesView}
              className="text-sm font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg px-3 py-2 disabled:opacity-60"
            >
              {entryHintsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          </>
          ) : activeTab === 'audit' ? (
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Manual Entry Audit Logs</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {auditEntryId ? `Showing history for entry #${auditEntryId}` : 'Showing latest manual entry audit history'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadAuditLogs(auditEntryId || undefined)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    Refresh
                  </button>
                  <input
                    type="text"
                    value={auditSearchInput}
                    onChange={(e) => setAuditSearchInput(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm w-40"
                    placeholder="Search audit logs"
                    title="Search by entry/user/role/reason/action"
                  />
                  <select
                    value={auditLimit}
                    onChange={(e) => {
                      setAuditLimit(e.target.value);
                      setAuditPage(1);
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white"
                    title="Rows per page"
                  >
                    <option value="10">10 / page</option>
                    <option value="20">20 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                    <option value="all">All</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleExportAuditCsv}
                    className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    disabled={auditLogs.length === 0}
                  >
                    Export Audit CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRawAuditJson((prev) => !prev)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    {showRawAuditJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
                  </button>
                </div>
              </div>
              {auditLoading ? (
                <p className="text-sm text-gray-500">Loading audit logs...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No audit logs found.</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${getAuditActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                        <span className="text-sm text-gray-700"><span className="font-semibold text-gray-500">Entry:</span> #{log.entry_id ?? '-'}</span>
                        <span className="text-sm text-gray-700"><span className="font-semibold text-gray-500">User:</span> {log.actor_username || '-'}</span>
                        <span className="text-sm text-gray-700"><span className="font-semibold text-gray-500">Role:</span> {log.actor_role || '-'}</span>
                        <span className="ml-auto text-xs text-gray-500">{formatDisplayDateTime(log.created_at)} IST</span>
                      </div>
                      {/* Body */}
                      <div className="px-4 py-3">
                        {log.reason && (
                          <p className="text-sm text-gray-700 mb-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <span className="font-semibold text-amber-800">Reason:</span> {log.reason}
                          </p>
                        )}
                        {log.action === 'DELETE' && (
                          <div className="mb-3">
                            <button
                              type="button"
                              onClick={() => setRestoreCandidate(log)}
                              disabled={loading}
                              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                            >
                              Restore Entry
                            </button>
                          </div>
                        )}
                        {/* Changes table */}
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-200">
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Field</th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Before</th>
                                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">After</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {toAuditChanges(log).map((row) => {
                                const changed = row.beforeValue !== row.afterValue && row.afterValue !== '-';
                                return (
                                  <tr key={`${log.id}-${row.key}`} className={changed ? 'bg-blue-50/40' : ''}>
                                    <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{row.label}</td>
                                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">{row.beforeValue}</td>
                                    <td className={`px-3 py-2 font-mono text-xs ${changed ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>{row.afterValue}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Raw JSON (toggle) */}
                        {showRawAuditJson && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-gray-600">Before (Raw)</p>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(JSON.stringify(parseAuditJson(log.before_data), null, 2), 'Before JSON copied')}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 overflow-auto max-h-36 font-mono text-[11px] leading-4 text-slate-700">{JSON.stringify(parseAuditJson(log.before_data), null, 2)}</pre>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-gray-600">After (Raw)</p>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(JSON.stringify(parseAuditJson(log.after_data), null, 2), 'After JSON copied')}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 overflow-auto max-h-36 font-mono text-[11px] leading-4 text-slate-700">{JSON.stringify(parseAuditJson(log.after_data), null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-3 text-sm text-gray-600">
                <div className="text-xs sm:text-sm">
                  Showing page {auditPage} of {auditTotalPages} ({auditLogs.length} rows on this page, {auditTotal} total)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditLimit === 'all' || auditPage <= 1 || auditLoading}
                    className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 text-xs sm:text-sm"
                  >
                    Previous
                  </button>
                  <span className="min-w-[70px] sm:min-w-[90px] text-center text-xs sm:text-sm">Page {auditPage}</span>
                  <input
                    type="number"
                    min={1}
                    max={auditTotalPages}
                    value={auditPageInput}
                    onChange={(e) => setAuditPageInput(e.target.value)}
                    onBlur={() => {
                      const next = Math.max(1, Math.min(auditTotalPages, parseInt(auditPageInput, 10) || auditPage));
                      setAuditPage(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const next = Math.max(1, Math.min(auditTotalPages, parseInt(auditPageInput, 10) || auditPage));
                        setAuditPage(next);
                      }
                    }}
                    disabled={auditLimit === 'all' || auditLoading}
                    className="w-14 sm:w-16 px-2 py-1.5 rounded border border-gray-300 text-center disabled:opacity-50 text-xs sm:text-sm"
                    title="Go to page"
                  />
                  <button
                    type="button"
                    onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                    disabled={auditLimit === 'all' || auditPage >= auditTotalPages || auditLoading}
                    className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 text-xs sm:text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {activeTab === 'entries' ? (
        <>
        <div ref={entriesTableRef} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Saved manual entries</h3>
              <p className="text-sm text-gray-600">
                {tableDateFilter && tableToDateFilter
                  ? `${formatProdDateKey(tableDateFilter)}${tableDateFilter !== tableToDateFilter ? ` – ${formatProdDateKey(tableToDateFilter)}` : ''}`
                  : 'All dates'}
                {tableWorkCentreFilter
                  ? ` · ${workCentres.find((wc) => String(wc.id) === tableWorkCentreFilter)?.name || 'Line filter'}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {conflictIds.size > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {conflictIds.size} conflict{conflictIds.size !== 1 ? 's' : ''}
                </span>
              ) : null}
              <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                {tableTotal} total · {totalManualOutput} pairs this page
              </span>
            </div>
          </div>
          {loadingEntries ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
              <span className="ml-3 text-gray-600">Loading entries…</span>
            </div>
          ) : manualEntries.length === 0 ? (
            <div className="text-center py-14 px-4">
              <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden />
              <p className="text-gray-600 font-medium">
                {tableSearch.trim() || tableWorkCentreFilter || tableDateFilter
                  ? 'No entries match your filters'
                  : 'No manual entries yet'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {productionDayLocked
                  ? 'This day is locked — contact Admin to unlock for corrections.'
                  : canEdit
                    ? 'Use Add New Entry to record a completed cycle.'
                    : 'Try adjusting the date range or search.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      {canMutate ? (
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600"
                          checked={manualEntries.length > 0 && manualEntries.every((r) => selectedEntryIds.has(r.id))}
                          onChange={(e) =>
                            setSelectedEntryIds(
                              e.target.checked ? new Set(manualEntries.map((r) => r.id)) : new Set()
                            )
                          }
                          aria-label="Select all on page"
                        />
                      ) : null}
                    </th>
                    <th className="px-4 py-3 text-left">{sortLabel('created_at', 'Date')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Line</th>
                    <th className="px-4 py-3 text-left">{sortLabel('machine_id', 'Machine')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Employee</th>
                    <th className="px-4 py-3 text-left">{sortLabel('start_time', 'Time')}</th>
                    <th className="px-4 py-3 text-center">{sortLabel('target_mins', 'Target')}</th>
                    <th className="px-4 py-3 text-center">{sortLabel('output_pairs', 'Output')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {manualEntries.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-blue-50/40 ${
                        conflictIds.has(row.id) ? 'bg-red-50/60 hover:bg-red-50' : ''
                      }`}
                    >
                      <td className="px-3 py-3">
                        {canMutate ? (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600"
                            checked={selectedEntryIds.has(row.id)}
                            onChange={(e) =>
                              setSelectedEntryIds((prev) => {
                                const n = new Set(prev);
                                if (e.target.checked) n.add(row.id);
                                else n.delete(row.id);
                                return n;
                              })
                            }
                            aria-label={`Select entry ${row.id}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{formatDisplayDate(row.prod_date)}</div>
                        {conflictIds.has(row.id) ? (
                          <span
                            className="mt-1 inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold ring-1 ring-red-200"
                            title="Overlaps a real production cycle"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Conflict
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.work_centre_name || row.work_centre_id}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded ring-1 ring-blue-100">
                            {row.machine_id}
                          </span>
                          {row.machine_name ? (
                            <span className="text-gray-600 truncate max-w-[8rem]" title={row.machine_name}>
                              {row.machine_name}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="font-medium text-gray-900">{row.emp_id}</span>
                        {row.employee_name ? (
                          <span className="text-gray-500 text-xs block truncate max-w-[9rem]" title={row.employee_name}>
                            {row.employee_name}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        <span className="font-medium text-gray-800">{formatShortTime(row.start_time)}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="font-medium text-gray-800">{formatShortTime(row.finish_time)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 tabular-nums">
                        {Number(row.target_mins || 0).toFixed(1)}
                        <span className="text-gray-400 text-xs ml-0.5">m</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex min-w-[2.5rem] justify-center text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md ring-1 ring-blue-100 tabular-nums">
                          {Number(row.output_pairs || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canMutate ? (
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleOpenAudit(row.id)}
                            className="p-1.5 rounded-md text-purple-600 hover:bg-purple-50 hover:text-purple-800 transition-colors"
                            title="History"
                          >
                            <History className="h-4 w-4" aria-hidden />
                          </button>
                          {canMutate ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteCandidate(row);
                                setDeleteReason('');
                              }}
                              className="p-1.5 rounded-md text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gradient-to-r from-gray-50 to-blue-50/30">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                      Page total
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-blue-700 tabular-nums">{totalManualOutput}</td>
                    <td />
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                      Filtered total (all pages)
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-indigo-700 tabular-nums">
                      {tableFilteredOutputTotal}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 px-1 text-sm text-gray-600">
          <div className="text-xs sm:text-sm">
            Page <span className="font-semibold text-gray-800">{tablePage}</span> of{' '}
            <span className="font-semibold text-gray-800">{tableTotalPages}</span>
            <span className="text-gray-400 mx-1">·</span>
            {manualEntries.length} on this page, {tableTotal} total
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tableLimit}
              onChange={(e) => {
                setTableLimit(e.target.value);
                setTablePage(1);
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white shadow-sm"
              title="Rows per page"
            >
              <option value="5">5 / page</option>
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="30">30 / page</option>
              <option value="all">All</option>
            </select>
            <button
              type="button"
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tableLimit === 'all' || tablePage <= 1 || loadingEntries}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs sm:text-sm shadow-sm"
            >
              Previous
            </button>
            <input
              type="number"
              min={1}
              max={tableTotalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const next = Math.max(1, Math.min(tableTotalPages, parseInt(pageInput, 10) || tablePage));
                setTablePage(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const next = Math.max(1, Math.min(tableTotalPages, parseInt(pageInput, 10) || tablePage));
                  setTablePage(next);
                }
              }}
              disabled={tableLimit === 'all' || loadingEntries}
              className="w-14 sm:w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-center disabled:opacity-50 text-xs sm:text-sm bg-white shadow-sm"
              title="Go to page"
              aria-label="Page number"
            />
            <span className="text-xs text-gray-400">/ {tableTotalPages}</span>
            <button
              type="button"
              onClick={() => setTablePage((p) => Math.min(tableTotalPages, p + 1))}
              disabled={tableLimit === 'all' || tablePage >= tableTotalPages || loadingEntries}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-xs sm:text-sm shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
        </>
        ) : null}

        {activeTab === 'coverage' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <Activity className="h-4 w-4 text-emerald-600" aria-hidden />
                Live production
              </span>
              {isTodayEntriesView && coverageInProgressCount > 0 ? (
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  {coverageInProgressCount} cycle{coverageInProgressCount !== 1 ? 's' : ''} running
                </span>
              ) : (
                <span className="text-xs text-gray-600">
                  {isTodayEntriesView ? 'No active cycles for selected line' : 'Live status shown for today only'}
                </span>
              )}
              {coverageSecondsSinceRefresh !== null ? (
                <span className="text-xs text-gray-500">Updated {coverageSecondsSinceRefresh}s ago</span>
              ) : null}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={coverageAutoRefresh}
                onChange={(e) => setCoverageAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600"
              />
              Auto-refresh every 30s
            </label>
          </div>

          {!isSingleDayEntriesView ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Set <strong>From</strong> and <strong>To</strong> to the same date to view reconciliation, checklist, and slot heatmap.
            </div>
          ) : null}

          {isSingleDayEntriesView && (
            <>
              <ManualEntryReconciliationStrip
                rows={reconciliationRows}
                loading={entryHintsLoading && reconciliationRows.length === 0}
              />
              <ManualEntryShiftChecklist items={shiftChecklistItems} onAction={handleChecklistAction} />
              <div ref={heatmapRef}>
                <ManualEntrySlotHeatmap
                  rows={slotHeatmapRows}
                  loading={entryHintsLoading && slotHeatmapRows.length === 0}
                  canEdit={canMutate && isTodayEntriesView}
                  onCellClick={startEntryFromHeatmap}
                  title="Hourly slot coverage (mobile + manual)"
                  hint={
                    isTodayEntriesView
                      ? 'Green = mobile capture · Yellow = manual · Red = missing · Click red cells on live machines to add a manual entry.'
                      : 'Green = mobile capture · Yellow = manual · Red = missing for this date.'
                  }
                />
              </div>
            </>
          )}

          {isTodayEntriesView && (entryHintsLoading || entryNeededHints.length > 0) && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Manual entry may be needed</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Operator logged in on these machines for {MANUAL_ENTRY_HINT_GRACE_MINS}+ minutes with no mobile cycle and no manual entry yet today.
                    Hint clears after the first entry or a real cycle.
                  </p>
                  {entryHintsLoading && entryNeededHints.length === 0 ? (
                    <p className="text-xs text-amber-700 mt-2">Checking active sessions…</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {entryNeededHints.map((hint) => (
                        <li key={`${hint.work_centre_id}-${hint.machine_id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs sm:text-sm">
                            <span className="font-medium">{hint.line_name}</span>
                            {' · '}
                            <span className="font-mono">{hint.machine_id}</span>
                            {hint.machine_name ? ` ${hint.machine_name}` : ''}
                            {' — '}
                            {hint.emp_code} {hint.emp_name}
                            <span className="text-amber-700"> ({hint.mins_waiting}m logged in)</span>
                          </span>
                          {canMutate && (
                            <button
                              type="button"
                              onClick={() => startEntryFromHint(hint)}
                              className="text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md px-2 py-0.5"
                            >
                              Add entry
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {isTodayEntriesView && activeSessions.length > 0 && (
            <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold">Missing hourly slots (logged-in machines)</p>
                  <p className="text-xs text-sky-800 mt-0.5">
                    Only operators logged in on mobile today — no cycle and no manual entry for that hour (9–10 … 1–2 … 5–6).
                    {tableWorkCentreFilter ? ' Filtered to selected line.' : ''}
                  </p>
                </div>
                {allMissingSlotHints.length > 24 && (
                  <button
                    type="button"
                    onClick={() => setShowAllMissingSlots((v) => !v)}
                    className="text-xs font-semibold text-sky-800 underline hover:text-sky-950"
                  >
                    {showAllMissingSlots ? 'Show fewer' : `Show all ${allMissingSlotHints.length}`}
                  </button>
                )}
              </div>
              {entryHintsLoading && allMissingSlotHints.length === 0 ? (
                <p className="text-xs text-sky-700 mt-2">Scanning coverage…</p>
              ) : allMissingSlotHints.length === 0 ? (
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  All due hourly slots are covered for logged-in machines.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                  {visibleMissingSlotHints.map((slot) => (
                    <li
                      key={`${slot.work_centre_id}-${slot.machine_id}-${slot.slot_value}`}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm"
                    >
                      <span>
                        <span className="font-medium">{slot.line_name}</span>
                        {' · '}
                        <span className="font-mono">{slot.machine_id}</span>
                        {slot.machine_name ? ` ${slot.machine_name}` : ''}
                        {' · '}
                        <span className="font-semibold text-sky-900">{slot.slot_label}</span>
                        {slot.emp_code ? (
                          <span className="text-sky-700">
                            {' '}
                            — {slot.emp_code}
                            {slot.emp_name ? ` ${slot.emp_name}` : ''}
                          </span>
                        ) : null}
                      </span>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => startEntryFromMissingSlot(slot)}
                          className="text-xs font-semibold text-sky-900 bg-sky-100 hover:bg-sky-200 border border-sky-300 rounded-md px-2 py-0.5"
                        >
                          Add entry
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </div>
        ) : null}
        {activeTab === 'production' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200/80 bg-gradient-to-r from-orange-50/80 to-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {prodInProgressCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    {prodInProgressCount} running
                  </span>
                ) : (
                  <span className="text-xs text-gray-600">No in-progress cycles</span>
                )}
                {prodSecondsSinceRefresh !== null ? (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <RefreshCw className={`h-3.5 w-3.5 ${prodLoading ? 'animate-spin text-blue-600' : ''}`} aria-hidden />
                    Updated {prodSecondsSinceRefresh}s ago
                  </span>
                ) : null}
                {prodNewCycleIds.size > 0 ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800 ring-1 ring-sky-200">
                    {prodNewCycleIds.size} new
                  </span>
                ) : null}
                {prodFlaggedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setProdQuickFilter('suspicious')}
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 ring-1 ring-red-200 hover:bg-red-200"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {prodFlaggedCount} flagged
                  </button>
                ) : null}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={prodAutoRefresh}
                  onChange={(e) => setProdAutoRefresh(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600"
                />
                Auto-refresh every 30s
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-gray-500">
                <Filter className="h-3.5 w-3.5" aria-hidden />
                Quick view
              </span>
              {PROD_QUICK_FILTERS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => { setProdQuickFilter(chip.id); setProdPage(0); }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    prodQuickFilter === chip.id
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {showProdEditForm && editingProdId && (() => {
              const row = prodRecords.find(r => r.id === editingProdId);
              return (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900">Edit Production Record #{editingProdId}</h2>
                      <button type="button" onClick={() => setShowProdEditForm(false)} className="text-gray-400 hover:text-gray-700 text-xl px-2">×</button>
                    </div>
                    {row && (
                      <div className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-3 space-y-1">
                        <p><span className="font-semibold">Machine:</span> {row.machine_id}{(() => { const m = machines.find(x => x.machine_id === row.machine_id); return (m?.machine_name || m?.name) ? ` - ${m?.machine_name || m?.name}` : ''; })()}</p>
                        <p><span className="font-semibold">Employee:</span> {row.emp_id}{row.employee_name ? ` - ${row.employee_name}` : ''}</p>
                        <p><span className="font-semibold">Line:</span> {row.work_centre_name || row.work_centre_id}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input type="datetime-local" step={1} value={prodStartTime} onChange={e => setProdStartTime(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Finish Time</label>
                        <input type="datetime-local" step={1} value={prodFinishTime} onChange={e => setProdFinishTime(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Output Pairs</label>
                        <input type="number" min="0" value={prodOutputPairs} onChange={e => setProdOutputPairs(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Mins</label>
                        <input type="number" min="0" step="0.1" value={prodTargetMins} onChange={e => setProdTargetMins(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-5">
                      <button type="button" onClick={handleProdSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-60">{loading ? 'Saving...' : 'Save Changes'}</button>
                      <button type="button" onClick={() => setShowProdEditForm(false)} disabled={loading} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-semibold">Cancel</button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {prodDeleteCandidate && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div role="dialog" aria-modal="true" aria-labelledby="delete-production-record-title" className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h2 id="delete-production-record-title" className="text-lg font-bold text-gray-900">Delete Production Record</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    Delete record{' '}
                    <span className="font-semibold">#{prodDeleteCandidate.id}</span>{' '}
                    for machine{' '}
                    <span className="font-semibold">{prodDeleteCandidate.machine_id}</span>?
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    This action cannot be undone.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setProdDeleteCandidate(null)}
                      disabled={loading}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProdDelete(prodDeleteCandidate)}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
                    >
                      {loading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From</label>
                <input type="date" value={prodDateFilter} onChange={e => { setProdDateFilter(e.target.value); setProdPage(0); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To</label>
                <input type="date" value={prodToDateFilter} onChange={e => { setProdToDateFilter(e.target.value); setProdPage(0); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
                <select value={prodLineFilter} onChange={e => { setProdLineFilter(e.target.value); setProdMachineFilter(''); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">All Lines</option>
                  {workCentres.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Machine</label>
                <select value={prodMachineFilter} onChange={e => setProdMachineFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">All Machines</option>
                  {(prodLineFilter ? machines.filter(m => String(m.work_centre_id) === prodLineFilter) : machines).map(m => (
                    <option key={m.machine_id} value={m.machine_id}>{m.machine_id}{m.machine_name ? ` - ${m.machine_name}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Search</label>
                <input type="text" value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Machine / Employee" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Finished Cycles</label>
                <select
                  value={prodFinishedView}
                  onChange={e => { setProdFinishedView(e.target.value as 'all' | 'recent_finished' | 'last_finished'); setProdPage(0); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All cycles</option>
                  <option value="recent_finished">Recently finished (last 50)</option>
                  <option value="last_finished">Last finished cycle</option>
                </select>
              </div>
              <button type="button" onClick={() => { void loadProdRecords(); }} disabled={prodLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
                {prodLoading ? 'Loading...' : 'Refresh'}
              </button>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={prodIncludeInProgress}
                  onChange={(e) => setProdIncludeInProgress(e.target.checked)}
                />
                Show in-progress cycles
              </label>
              <button type="button" onClick={() => {
                const headers = ['Cycle#','Date','Line','Machine','Employee','Start','Finish','Duration(mins)','Target(mins)','Output','Efficiency%','Cycle loss','Flags'];
                const exportRows = prodSearch.trim()
                  ? prodRecords.filter(r => {
                      const q = prodSearch.trim().toLowerCase();
                      const mName = getProdMachineName(r.machine_id);
                      return `${r.machine_id} ${mName}`.toLowerCase().includes(q) ||
                             `${r.emp_id} ${r.employee_name || ''}`.toLowerCase().includes(q);
                    })
                  : prodRecords;
                const exportCtx = buildProdCycleContextMap(exportRows);
                const csvBody = [
                  headers.join(','),
                  ...exportRows.map((r: any) => {
                    const mName = getProdMachineName(r.machine_id);
                    const ctx = exportCtx.get(Number(r.id)) ?? { prevFinishTime: null, cycleNumber: 1, operatorChanged: false };
                    const metrics = analyzeProdCycle(r, ctx);
                    const st = Number(r.button_status || 0);
                    const dur = metrics.durationMins;
                    const eff = calcEfficiency(Number(r.target_mins || 0), r.start_time, r.finish_time, st);
                    const flags = metrics.anomalies.map(getAnomalyLabel).join('; ');
                    return [
                      metrics.cycleNumber,
                      formatDisplayDate(r.prod_date),
                      r.work_centre_name || r.work_centre_id,
                      `${r.machine_id}${mName ? ` - ${mName}` : ''}`,
                      `${r.emp_id}${r.employee_name ? ` - ${r.employee_name}` : ''}`,
                      formatDisplayDateTime(r.start_time),
                      formatDisplayDateTime(r.finish_time),
                      dur ?? '',
                      Number(r.target_mins || 0).toFixed(1),
                      Number(r.output_pairs || 0),
                      eff !== null ? `${eff}%` : '',
                      formatLossBreakdown(metrics, isProdCycleActive(st)),
                      flags,
                    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
                  }),
                ].join('\n');
                const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `production_records_${prodDateFilter || 'all'}.csv`;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
              }} disabled={prodRecords.length === 0} className="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setProdDateFilter(getTodayLocalDate());
                  setProdToDateFilter(getTodayLocalDate());
                  setProdLineFilter('');
                  setProdMachineFilter('');
                  setProdSearch('');
                  setProdIncludeInProgress(true);
                  setProdFinishedView('all');
                  setProdQuickFilter('all');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Reset
              </button>
            </div>

            {(() => {
              const searchFiltered = prodSearch.trim()
                ? prodRecords.filter(r => {
                    const q = prodSearch.trim().toLowerCase();
                    const mName = getProdMachineName(r.machine_id);
                    return `${r.machine_id} ${mName}`.toLowerCase().includes(q) ||
                           `${r.emp_id} ${r.employee_name || ''}`.toLowerCase().includes(q);
                  })
                : prodRecords;
              const cycleContextMap = buildProdCycleContextMap(searchFiltered);
              const metricsForRow = (row: any): ProdCycleMetrics => {
                const ctx = cycleContextMap.get(Number(row.id)) ?? {
                  prevFinishTime: null,
                  cycleNumber: 1,
                  operatorChanged: false,
                };
                return analyzeProdCycle(row, ctx, prodLiveNow);
              };
              const visibleRows = prodQuickFilter === 'all'
                ? searchFiltered
                : searchFiltered.filter((r) => matchesProdQuickFilter(prodQuickFilter, r, metricsForRow(r)));
              const flaggedCount = searchFiltered.filter((r) => metricsForRow(r).isSuspicious).length;
              const totalOutput = visibleRows.reduce((s: number, r: any) => s + Number(r.output_pairs || 0), 0);
              const effValues = visibleRows
                .map((r: any) => {
                  const st = Number(r.button_status || 0);
                  if (isProdCycleActive(st)) return null;
                  return calcEfficiency(Number(r.target_mins || 0), r.start_time, r.finish_time, st);
                })
                .filter((v): v is number => v !== null);
              const avgEff = effValues.length ? Math.round(effValues.reduce((a, b) => a + b, 0) / effValues.length) : null;
              // One accordion per machine; paginate machines (not raw rows)
              const machineKeys = Array.from(new Set(visibleRows.map((r: any) => String(r.machine_id)))).sort((a, b) => a.localeCompare(b));
              const allMachineGroups = machineKeys.map((mid) => ({
                machine_id: mid,
                rows: visibleRows
                  .filter((r: any) => String(r.machine_id) === mid)
                  .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
              }));
              const machineCount = allMachineGroups.length;
              const machinesPerPage = prodPageSize === -1 ? Math.max(1, machineCount) : prodPageSize;
              const totalPages = Math.max(1, Math.ceil(machineCount / (machinesPerPage || 1)));
              const safePage = Math.min(prodPage, totalPages - 1);
              const groupedByMachine =
                prodPageSize === -1
                  ? allMachineGroups
                  : allMachineGroups.slice(safePage * machinesPerPage, safePage * machinesPerPage + machinesPerPage);
              return (
                <>
                {prodLoading ? (
                  <div className="border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">Loading...</div>
                ) : visibleRows.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
                    {searchFiltered.length > 0 && prodQuickFilter !== 'all'
                      ? `No cycles match "${PROD_QUICK_FILTERS.find((c) => c.id === prodQuickFilter)?.label}". Try another quick view or reset filters.`
                      : 'No production records found for selected filters.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupedByMachine.map(({ machine_id: mid, rows: machineRows }) => {
                      const mName = getProdMachineName(mid);
                      const sectionOutput = machineRows.reduce((s: number, r: any) => s + Number(r.output_pairs || 0), 0);
                      const sectionEff = machineRows
                        .map((r: any) => {
                          const st = Number(r.button_status || 0);
                          if (isProdCycleActive(st)) return null;
                          return calcEfficiency(Number(r.target_mins || 0), r.start_time, r.finish_time, st);
                        })
                        .filter((v): v is number => v !== null);
                      const sectionAvgEff = sectionEff.length ? Math.round(sectionEff.reduce((a, b) => a + b, 0) / sectionEff.length) : null;
                      const machineHasLive = machineRows.some((r: any) => isProdCycleActive(Number(r.button_status || 0)));
                      const accOpen = prodMachineAccordionOpen[mid] ?? false;
                      return (
                        <details
                          key={mid}
                          open={accOpen}
                          className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                        >
                          <summary
                            className="cursor-pointer list-none px-4 py-3 bg-gray-50 hover:bg-gray-100 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden"
                            onClick={(e) => {
                              e.preventDefault();
                              setProdMachineAccordionOpen((prev) => ({
                                ...prev,
                                [mid]: !(prev[mid] ?? false),
                              }));
                            }}
                          >
                            <span className="flex items-start gap-2 min-w-0">
                              <ChevronRight
                                className={`h-5 w-5 shrink-0 text-gray-500 mt-0.5 transition-transform duration-200 ${accOpen ? 'rotate-90' : ''}`}
                                aria-hidden
                              />
                              <span>
                                Machine {mid}{mName ? ` — ${mName}` : ''}
                                <span className="font-normal text-gray-600 ml-2">
                                  ({machineRows.length} cycle{machineRows.length !== 1 ? 's' : ''})
                                </span>
                              </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-3 text-xs font-normal">
                              {machineHasLive ? (
                                <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                  </span>
                                  Live
                                </span>
                              ) : null}
                              <span>Output: <strong className="text-gray-900">{sectionOutput}</strong></span>
                              <span>Avg eff: {effBadge(sectionAvgEff)}</span>
                            </span>
                          </summary>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left p-2 border-b border-gray-200">#</th>
                                  <th className="text-left p-2 border-b border-gray-200">Date</th>
                                  <th className="text-left p-2 border-b border-gray-200">Line</th>
                                  <th className="text-left p-2 border-b border-gray-200">Employee</th>
                                  <th className="text-left p-2 border-b border-gray-200">Start</th>
                                  <th className="text-left p-2 border-b border-gray-200">Finish</th>
                                  <th className="text-left p-2 border-b border-gray-200">Duration</th>
                                  <th className="text-left p-2 border-b border-gray-200">Status</th>
                                  <th className="text-left p-2 border-b border-gray-200">Target</th>
                                  <th className="text-left p-2 border-b border-gray-200">Output</th>
                                  <th className="text-left p-2 border-b border-gray-200">Efficiency</th>
                                  <th className="text-left p-2 border-b border-gray-200">Cycle loss</th>
                                  <th className="text-left p-2 border-b border-gray-200">Flags</th>
                                  <th className="text-left p-2 border-b border-gray-200">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {machineRows.map((row: any) => {
                                  const rowStatus = Number(row.button_status || 0);
                                  const isActive = isProdCycleActive(rowStatus);
                                  const ctx = cycleContextMap.get(Number(row.id)) ?? {
                                    prevFinishTime: null,
                                    cycleNumber: 1,
                                    operatorChanged: false,
                                  };
                                  const metrics = analyzeProdCycle(row, ctx, prodLiveNow);
                                  const dur = metrics.durationMins;
                                  const eff = isActive ? null : metrics.efficiencyPct;
                                  const isNew = prodNewCycleIds.has(Number(row.id));
                                  const rowTone = isNew
                                    ? 'bg-sky-50 ring-1 ring-inset ring-sky-300'
                                    : isActive
                                      ? 'bg-amber-50/70'
                                      : metrics.isSuspicious
                                        ? 'bg-red-50/80'
                                        : 'hover:bg-gray-50';
                                  return (
                                    <tr
                                      key={row.id}
                                      className={`border-b border-gray-100 ${rowTone}`}
                                    >
                                      <td className="p-2 tabular-nums text-xs font-bold text-gray-500">{metrics.cycleNumber}</td>
                                      <td className="p-2">{formatDisplayDate(row.prod_date)}</td>
                                      <td className="p-2">{row.work_centre_name || row.work_centre_id}</td>
                                      <td className="p-2">
                                        {row.emp_id}{row.employee_name ? ` - ${row.employee_name}` : ''}
                                        {metrics.operatorChanged ? (
                                          <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-bold text-violet-800">Op. change</span>
                                        ) : null}
                                      </td>
                                      <td className="p-2">{formatDisplayDateTime(row.start_time)}</td>
                                      <td className="p-2">
                                        {isActive ? (
                                          <span className="text-amber-700 text-xs font-medium">Running…</span>
                                        ) : (
                                          formatDisplayDateTime(row.finish_time)
                                        )}
                                      </td>
                                      <td
                                        className={`p-2 tabular-nums ${
                                          isActive
                                            ? 'text-amber-800 font-bold'
                                            : metrics.anomalies.includes('duration_short')
                                              ? 'text-red-600 font-semibold'
                                              : 'text-gray-600'
                                        }`}
                                      >
                                        {dur !== null ? `${dur.toFixed(1)} m${isActive ? ' +' : ''}` : '-'}
                                      </td>
                                      <td className="p-2">{prodStatusBadge(rowStatus)}</td>
                                      <td className="p-2">{Number(row.target_mins || 0).toFixed(1)}</td>
                                      <td className="p-2 font-medium">{Number(row.output_pairs || 0)}</td>
                                      <td className="p-2">{isActive ? <span className="text-xs text-amber-700 font-medium">Live</span> : effBadge(eff)}</td>
                                      <td className="p-2 text-xs max-w-[11rem]">
                                        {isActive ? (
                                          <span className="text-amber-700 font-medium">Running</span>
                                        ) : (
                                          <div className="space-y-0.5">
                                            <span
                                              className={
                                                metrics.netLostMins >= 1
                                                  ? 'font-semibold text-rose-700'
                                                  : metrics.isFirstCycle
                                                    ? 'font-medium text-slate-600'
                                                    : 'font-medium text-emerald-700'
                                              }
                                            >
                                              {formatLossBreakdown(metrics, false)}
                                            </span>
                                            {(() => {
                                              const shiftNote = formatFirstCycleShiftNote(metrics);
                                              return shiftNote ? (
                                                <span className="block text-[10px] text-slate-500" title="Idle time before the first cycle on this machine today">
                                                  {shiftNote}
                                                </span>
                                              ) : null;
                                            })()}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        <div className="flex flex-wrap gap-1 max-w-[9rem]">
                                          {isNew ? (
                                            <span className="rounded bg-sky-200 px-1.5 py-0.5 text-[10px] font-bold text-sky-900">New</span>
                                          ) : null}
                                          {metrics.anomalies.slice(0, 3).map((code) => (
                                            <span
                                              key={code}
                                              className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800"
                                              title={getAnomalyLabel(code)}
                                            >
                                              {getAnomalyLabel(code)}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleProdEdit(row)}
                                            className="px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-semibold"
                                          >
                                            Edit
                                          </button>
                                          {canMutate && (
                                            <button
                                              type="button"
                                              onClick={() => setProdDeleteCandidate(row)}
                                              className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold"
                                            >
                                              Delete
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
                {visibleRows.length > 0 && !prodLoading && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                    <span>
                      Total ({visibleRows.length} cycle{visibleRows.length !== 1 ? 's' : ''})
                      {prodQuickFilter !== 'all' ? (
                        <span className="ml-2 text-xs font-normal text-orange-700">
                          · filtered: {PROD_QUICK_FILTERS.find((c) => c.id === prodQuickFilter)?.label}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-4 font-normal text-gray-700">
                      <span>Output: <strong className="text-gray-900">{totalOutput}</strong></span>
                      <span className="flex items-center gap-1">Avg efficiency: {effBadge(avgEff)}</span>
                      {flaggedCount > 0 ? (
                        <span className="text-red-700 text-xs font-semibold">{flaggedCount} flagged in view</span>
                      ) : null}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-sm text-gray-600">
                  <span className="text-xs">
                    {machineCount} machine{machineCount !== 1 ? 's' : ''} · {visibleRows.length} cycle{visibleRows.length !== 1 ? 's' : ''}
                    {prodPageSize !== -1 ? (
                      <> · showing {groupedByMachine.length} machine{groupedByMachine.length !== 1 ? 's' : ''} on this page · page {safePage + 1} of {totalPages}</>
                    ) : (
                      <> · page {safePage + 1} of {totalPages}</>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <select value={prodPageSize} onChange={e => { setProdPageSize(Number(e.target.value)); setProdPage(0); }} className="border border-gray-300 rounded px-2 py-1 text-xs bg-white">
                      <option value={10}>10 machines/page</option>
                      <option value={20}>20 machines/page</option>
                      <option value={50}>50 machines/page</option>
                      <option value={-1}>All machines</option>
                    </select>
                    <button onClick={() => setProdPage(p => Math.max(0, p - 1))} disabled={safePage === 0 || prodPageSize === -1} className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50 text-xs">Prev</button>
                    <button onClick={() => setProdPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1 || prodPageSize === -1} className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50 text-xs">Next</button>
                  </div>
                </div>
                </>
              );
            })()}
          </div>
        )}
        {activeTab === 'wip' && (
          <WipDailyStateTab workCentres={workCentres} canEdit={canMutate} />
        )}

        {activeTab === 'summary' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
                <input type="date" value={summaryDate} onChange={e => setSummaryDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={loadSummary} disabled={summaryLoading} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
                {summaryLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {summaryLoading ? (
              <p className="text-sm text-gray-500">Loading summary...</p>
            ) : summaryData.length === 0 ? (
              <p className="text-sm text-gray-500">No data for selected date.</p>
            ) : (
              <>
              {(() => {
                const totalOut = summaryData.reduce((s: number, r: any) => s + r.total_output, 0);
                const manualOut = summaryData.reduce((s: number, r: any) => s + r.manual_output, 0);
                const pct = totalOut > 0 ? Math.round((manualOut / totalOut) * 100) : 0;
                if (pct >= MANUAL_PCT_ALERT) return (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                    <span className="text-red-500 text-lg">⚠️</span>
                    <div>
                      <p className="text-red-700 font-semibold text-sm">High Manual Entry Alert</p>
                      <p className="text-red-600 text-xs mt-0.5">{pct}% of today's output ({manualOut} of {totalOut} pairs) was entered manually. This exceeds the {MANUAL_PCT_ALERT}% threshold — please verify data integrity.</p>
                    </div>
                  </div>
                );
                return null;
              })()}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 border-b">Machine</th>
                      <th className="text-left p-2 border-b">Line</th>
                      <th className="text-left p-2 border-b">Real Cycles</th>
                      <th className="text-left p-2 border-b">Manual Cycles</th>
                      <th className="text-left p-2 border-b">Total Cycles</th>
                      <th className="text-left p-2 border-b">Real Output</th>
                      <th className="text-left p-2 border-b">Manual Output</th>
                      <th className="text-left p-2 border-b">Total Output</th>
                      <th className="text-left p-2 border-b">Manual %</th>
                      <th className="text-left p-2 border-b">Avg Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row: any) => (
                      <tr key={row.machine_id} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{row.machine_id}{row.machine_name ? ` - ${row.machine_name}` : ''}</td>
                        <td className="p-2">{row.work_centre_name}</td>
                        <td className="p-2">{row.real_cycles}</td>
                        <td className="p-2">
                          {row.manual_cycles > 0
                            ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">{row.manual_cycles}</span>
                            : <span className="text-gray-400">0</span>}
                        </td>
                        <td className="p-2 font-semibold">{row.total_cycles}</td>
                        <td className="p-2">{row.real_output}</td>
                        <td className="p-2">{row.manual_output > 0 ? <span className="text-orange-600 font-medium">{row.manual_output}</span> : <span className="text-gray-400">0</span>}</td>
                        <td className="p-2 font-semibold">{row.total_output}</td>
                        <td className="p-2">
                          {(() => {
                            const pct = row.total_output > 0 ? Math.round((row.manual_output / row.total_output) * 100) : 0;
                            const cls = pct > 50 ? 'bg-red-100 text-red-700' : pct > 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
                            return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{pct}%</span>;
                          })()}
                        </td>
                        <td className="p-2">{effBadge(row.avg_eff)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="p-2 border-t" colSpan={2}>Total</td>
                      <td className="p-2 border-t">{summaryData.reduce((s: number, r: any) => s + r.real_cycles, 0)}</td>
                      <td className="p-2 border-t">{summaryData.reduce((s: number, r: any) => s + r.manual_cycles, 0)}</td>
                      <td className="p-2 border-t">{summaryData.reduce((s: number, r: any) => s + r.total_cycles, 0)}</td>
                      <td className="p-2 border-t">{summaryData.reduce((s: number, r: any) => s + r.real_output, 0)}</td>
                      <td className="p-2 border-t">{summaryData.reduce((s: number, r: any) => s + r.manual_output, 0)}</td>

                      <td className="p-2 border-t">{summaryData.reduce((s: number, r: any) => s + r.total_output, 0)}</td>
                      <td className="p-2 border-t">
                        {(() => {
                          const totalOut = summaryData.reduce((s: number, r: any) => s + r.total_output, 0);
                          const manualOut = summaryData.reduce((s: number, r: any) => s + r.manual_output, 0);
                          const pct = totalOut > 0 ? Math.round((manualOut / totalOut) * 100) : 0;
                          const cls = pct > 50 ? 'bg-red-100 text-red-700' : pct > 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
                          return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{pct}%</span>;
                        })()}
                      </td>
                      <td className="p-2 border-t">{effBadge(summaryData.filter((r: any) => r.avg_eff !== null).length ? Math.round(summaryData.filter((r: any) => r.avg_eff !== null).reduce((s: number, r: any) => s + r.avg_eff, 0) / summaryData.filter((r: any) => r.avg_eff !== null).length) : null)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};

