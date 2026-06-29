import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Edit,
  X,
  RotateCcw,
  Download,
  ClipboardList,
  Search,
  FileSpreadsheet,
  Calendar,
  Target,
  Layers,
  Loader2,
  Factory,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';
import * as XLSX from 'xlsx';
import { todayDateKey, dayBeforeDateKey, dayAfterDateKey, parseDateKey } from '../utils/compareDateUtils';

interface MasterOption {
  id: number;
  code: string;
  name: string;
}

interface LineItem {
  style_id: string;
  customer_id: string;
  group_id: string;
  leather_id: string;
  color_id: string;
  customer_name: string;
  group_name: string;
  leather_name: string;
  color_name: string;
  work_centre_id: string;
  total_target_per_day: string;
  target_pairs_per_tray: string;
  tray_count: string;
  man_hours_minutes: string;
  smv_per_pair: string;
}

const formatPlanDateLabel = (value: string | null | undefined) => {
  const part = parseDateKey(value);
  if (!part) return '—';
  const [y, m, d] = part.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
};

interface PlanGapDay {
  dateKey: string;
  missingCount: number;
  totalLines: number;
  missingLines: Array<{ code: string; name: string }>;
}

const planRecordToLineItem = (plan: Record<string, unknown>): LineItem => ({
  style_id: String(plan.style_id ?? ''),
  customer_id: String(plan.customer_id ?? ''),
  group_id: String(plan.group_id ?? ''),
  leather_id: String(plan.leather_id ?? ''),
  color_id: String(plan.color_id ?? ''),
  customer_name: String(plan.customer_name || ''),
  group_name: String(plan.group_name || ''),
  leather_name: String(plan.leather_name || ''),
  color_name: String(plan.color_name || ''),
  work_centre_id: String(plan.work_centre_id ?? ''),
  total_target_per_day: String(plan.total_target_per_day ?? ''),
  target_pairs_per_tray: String(plan.target_pairs_per_tray ?? ''),
  tray_count: String(plan.tray_count ?? '0'),
  man_hours_minutes: String(plan.man_hours_minutes ?? ''),
  smv_per_pair: String(plan.smv_per_pair ?? ''),
});

const emptyLine = (): LineItem => ({
  style_id: '',
  customer_id: '',
  group_id: '',
  leather_id: '',
  color_id: '',
  customer_name: '',
  group_name: '',
  leather_name: '',
  color_name: '',
  work_centre_id: '',
  total_target_per_day: '',
  target_pairs_per_tray: '',
  tray_count: '',
  man_hours_minutes: '',
  smv_per_pair: '',
});

export const ProductionPlanningForm: React.FC = () => {
  const [plans, setPlans] = React.useState<any[]>([]);
  const [showModal, setShowModal] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [styles, setStyles] = React.useState<MasterOption[]>([]);
  const [workCentres, setWorkCentres] = React.useState<MasterOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [restoreId, setRestoreId] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [planDate, setPlanDate] = React.useState(() => todayDateKey());
  const [lines, setLines] = React.useState<LineItem[]>([emptyLine()]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterDate, setFilterDate] = React.useState(() => todayDateKey());
  const [filterWorkCentre, setFilterWorkCentre] = React.useState('');
  const [filterStyle, setFilterStyle] = React.useState('');
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [copyingPlans, setCopyingPlans] = React.useState(false);
  const [planGaps, setPlanGaps] = React.useState<{
    today: PlanGapDay | null;
    tomorrow: PlanGapDay | null;
    loading: boolean;
  }>({ today: null, tomorrow: null, loading: true });

  const fetchPlanGaps = React.useCallback(async () => {
    const todayKey = todayDateKey();
    const tomorrowKey = dayAfterDateKey(todayKey);
    setPlanGaps((prev) => ({ ...prev, loading: true }));
    try {
      const parseBoard = (dateKey: string, json: { success?: boolean; data?: any }): PlanGapDay => {
        const lines = json.data?.lines || [];
        const missing = lines.filter((l: { missing_plan?: boolean }) => l.missing_plan);
        return {
          dateKey,
          missingCount: missing.length,
          totalLines: lines.length,
          missingLines: missing.map((l: { work_centre_code?: string; work_centre_name?: string }) => ({
            code: l.work_centre_code || '—',
            name: l.work_centre_name || '—',
          })),
        };
      };

      const [todayRes, tomorrowRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/production-planning/board/today?date=${encodeURIComponent(todayKey)}`),
        apiFetch(`${API_BASE}/api/production-planning/board/today?date=${encodeURIComponent(tomorrowKey)}`),
      ]);
      const [todayJson, tomorrowJson] = await Promise.all([todayRes.json(), tomorrowRes.json()]);

      setPlanGaps({
        today: todayRes.ok && todayJson.success ? parseBoard(todayKey, todayJson) : null,
        tomorrow: tomorrowRes.ok && tomorrowJson.success ? parseBoard(tomorrowKey, tomorrowJson) : null,
        loading: false,
      });
    } catch {
      setPlanGaps({ today: null, tomorrow: null, loading: false });
    }
  }, []);

  React.useEffect(() => {
    fetchMasters();
    fetchPlanGaps();
  }, []);

  React.useEffect(() => {
    const syncCalendarDay = () => {
      const today = todayDateKey();
      setFilterDate((prev) => {
        const yesterday = dayBeforeDateKey(today);
        return prev === yesterday ? today : prev;
      });
      fetchPlanGaps();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncCalendarDay();
    };

    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(syncCalendarDay, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [fetchPlanGaps]);

  React.useEffect(() => {
    fetchPlans();
  }, [currentPage, itemsPerPage, searchTerm, filterDate, filterWorkCentre, filterStyle, showDeleted]);

  const fetchPlans = async (options?: { planDate?: string }) => {
    setRefreshing(true);
    try {
      const dateFilter = options?.planDate ?? filterDate;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (dateFilter) params.set('plan_date', dateFilter);
      if (filterWorkCentre) params.set('work_centre_id', filterWorkCentre);
      if (filterStyle) params.set('style_id', filterStyle);
      if (showDeleted) params.set('include_deleted', '1');
      const [res] = await Promise.all([
        apiFetch(`${API_BASE}/api/production-planning?${params.toString()}`),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
      const result = await res.json();
      if (result.success) {
        setPlans(result.data);
        if (result.pagination) {
          setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setRefreshing(false);
      fetchPlanGaps();
    }
  };

  const fetchMasters = async () => {
    try {
      const [stylesRes, wcRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/masters/styles`),
        apiFetch(`${API_BASE}/api/masters/work_centres`)
      ]);
      const [stylesData, wcData] = await Promise.all([stylesRes.json(), wcRes.json()]);
      if (stylesData.success) setStyles(stylesData.data);
      if (wcData.success) setWorkCentres(wcData.data);
    } catch (error) {
      toast.error('Error loading master data');
    }
  };

  const updateLine = (idx: number, updates: Partial<LineItem>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...updates } : l)));
  };

  const handleStyleChange = async (idx: number, styleId: string) => {
    updateLine(idx, {
      style_id: styleId,
      customer_id: '', group_id: '', leather_id: '', color_id: '',
      customer_name: '', group_name: '', leather_name: '', color_name: '',
      smv_per_pair: '', total_target_per_day: '', man_hours_minutes: '',
    });
    if (!styleId) return;

    try {
      const res = await apiFetch(`${API_BASE}/api/production-routing/style/${styleId}`);
      const result = await res.json();
      if (res.status === 403) {
        toast.error('You do not have permission to load routing for this style.');
        updateLine(idx, { style_id: styleId });
        return;
      }
      if (result.success && result.data) {
        const r = result.data;
        // Calculate man hours: sum of (std_time_secs_pr * manpower) across all lines, converted to minutes
        let manHoursMins = '';
        if (r.lines && r.lines.length > 0) {
          const totalSecs = r.lines.reduce((sum: number, l: any) => {
            const obs = parseFloat(l.observed_time) || 0;
            const rf = parseFloat(l.rating_factor) || 0;
            const mp = parseFloat(l.manpower) || 0;
            const stdTime = (obs * rf / 100) * 1.15;
            return sum + stdTime * mp;
          }, 0);
          manHoursMins = String(Math.round(totalSecs / 60));
        }
        updateLine(idx, {
          style_id: styleId,
          customer_id: String(r.customer_id ?? ''),
          group_id: String(r.group_id ?? ''),
          leather_id: String(r.leather_id ?? ''),
          color_id: String(r.color_id ?? ''),
          customer_name: r.customer_name || '',
          group_name: r.group_name || '',
          leather_name: r.leather_name || '',
          color_name: r.color_name || '',
          smv_per_pair: String(r.tot_smv ?? ''),
          total_target_per_day: String(r.target_per_day ?? ''),
          man_hours_minutes: manHoursMins,
        });
      } else {
        toast.error(result.error || 'No routing found for this style. Please create routing first.');
        updateLine(idx, { style_id: styleId });
      }
    } catch (e) {
      toast.error('Error fetching routing');
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setPlanDate(filterDate || todayDateKey());
    setLines([emptyLine()]);
    setShowModal(true);
  };

  const handleCopyPlansFrom = async (sourceDate: string) => {
    const workCentreId = lines[0]?.work_centre_id;

    setCopyingPlans(true);
    try {
      const params = new URLSearchParams({
        plan_date: sourceDate,
        limit: '500',
        page: '1',
      });
      const res = await apiFetch(`${API_BASE}/api/production-planning?${params.toString()}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to load plans');
      }

      let sourcePlans: Record<string, unknown>[] = result.data || [];
      if (workCentreId) {
        sourcePlans = sourcePlans.filter((p) => String(p.work_centre_id) === workCentreId);
      }

      if (sourcePlans.length === 0) {
        const hint = workCentreId ? ' for this work centre' : '';
        toast.error(`No plans found for ${formatPlanDateLabel(sourceDate)}${hint}`);
        return;
      }

      setLines(sourcePlans.map((p) => planRecordToLineItem(p)));
      const targetLabel = formatPlanDateLabel(planDate);
      const sourceLabel = formatPlanDateLabel(sourceDate);
      toast.success(
        workCentreId
          ? `Copied plan from ${sourceLabel} — review and save for ${targetLabel}`
          : `Loaded ${sourcePlans.length} plan(s) from ${sourceLabel} — review and save for ${targetLabel}`
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to copy plans';
      toast.error(message);
    } finally {
      setCopyingPlans(false);
    }
  };

  const handleCopyFromYesterday = () => handleCopyPlansFrom(dayBeforeDateKey(planDate));
  const handleCopyFromToday = () => handleCopyPlansFrom(todayDateKey());

  const handleEdit = async (id: number) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/production-planning/${id}`);
      const result = await res.json();
      if (result.success) {
        const plan = result.data;
        setEditingId(id);
        setPlanDate(parseDateKey(plan.plan_date) || todayDateKey());
        setLines([{
          style_id: String(plan.style_id),
          customer_id: String(plan.customer_id),
          group_id: String(plan.group_id || ''),
          leather_id: String(plan.leather_id || ''),
          color_id: String(plan.color_id || ''),
          customer_name: plan.customer_name || '',
          group_name: plan.group_name || '',
          leather_name: plan.leather_name || '',
          color_name: plan.color_name || '',
          work_centre_id: String(plan.work_centre_id),
          total_target_per_day: String(plan.total_target_per_day),
          target_pairs_per_tray: String(plan.target_pairs_per_tray),
          tray_count: String(plan.tray_count || '0'),
          man_hours_minutes: String(plan.man_hours_minutes),
          smv_per_pair: String(plan.smv_per_pair),
        }]);
        setShowModal(true);
      }
    } catch (error) {
      toast.error('Failed to load plan');
    }
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteId(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/production-planning/${deleteId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Plan deleted');
        fetchPlans();
      } else {
        toast.error(result.error || 'Delete failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const confirmRestore = async () => {
    if (!restoreId) return;
    setRestoreId(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/production-planning/${restoreId}/restore`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast.success('Plan restored');
        fetchPlans();
      } else {
        toast.error(result.error || 'Restore failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toSave = lines.filter(
      (l) =>
        l.style_id && l.customer_id && l.work_centre_id && l.total_target_per_day &&
        l.target_pairs_per_tray && l.man_hours_minutes && l.smv_per_pair
    );
    if (toSave.length === 0) {
      toast.error('Add at least one complete line');
      return;
    }

    // Block save if any line is missing routing data
    const missingRouting = lines.filter(l => l.style_id && !l.smv_per_pair);
    if (missingRouting.length > 0) {
      toast.error('Some styles have no routing defined for today. Please create routing first.');
      return;
    }

    setLoading(true);
    
    if (editingId) {
      // Update existing plan
      try {
        const l = toSave[0];
        const payload = {
          plan_date: planDate,
          style_id: parseInt(l.style_id),
          customer_id: parseInt(l.customer_id),
          group_id: l.group_id ? parseInt(l.group_id) : null,
          leather_id: l.leather_id ? parseInt(l.leather_id) : null,
          color_id: l.color_id ? parseInt(l.color_id) : null,
          work_centre_id: parseInt(l.work_centre_id),
          total_target_per_day: parseInt(l.total_target_per_day),
          target_pairs_per_tray: parseInt(l.target_pairs_per_tray),
          tray_count: parseInt(l.tray_count || '0'),
          man_hours_minutes: parseInt(l.man_hours_minutes),
          smv_per_pair: parseFloat(l.smv_per_pair),
        };
        const res = await apiFetch(`${API_BASE}/api/production-planning/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.success) {
          toast.success('Plan updated');
          setShowModal(false);
          setFilterDate(planDate);
          setCurrentPage(1);
          fetchPlans({ planDate });
          fetchPlanGaps();
        } else {
          toast.error(result.error || 'Failed to update plan');
        }
      } catch (e) {
        toast.error('Network error');
      }
      setLoading(false);
    } else {
      // Create new plans atomically
      const payload = {
        lines: toSave.map((l) => ({
          plan_date: planDate,
          style_id: parseInt(l.style_id),
          customer_id: parseInt(l.customer_id),
          group_id: l.group_id ? parseInt(l.group_id) : null,
          leather_id: l.leather_id ? parseInt(l.leather_id) : null,
          color_id: l.color_id ? parseInt(l.color_id) : null,
          work_centre_id: parseInt(l.work_centre_id),
          total_target_per_day: parseInt(l.total_target_per_day),
          target_pairs_per_tray: parseInt(l.target_pairs_per_tray),
          tray_count: parseInt(l.tray_count || '0'),
          man_hours_minutes: parseInt(l.man_hours_minutes),
          smv_per_pair: parseFloat(l.smv_per_pair),
        }))
      };
      let ok = 0;
      try {
        const res = await apiFetch(`${API_BASE}/api/production-planning/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await res.json();
        if (j.success) {
          ok = j?.data?.count || toSave.length;
        } else {
          toast.error(j.error || 'Failed to save planning lines');
        }
      } catch (e) {
        toast.error('Network error');
      }
      setLoading(false);
      if (ok > 0) {
        toast.success(`Saved ${ok} plan(s)`);
        setShowModal(false);
        setFilterDate(planDate);
        setCurrentPage(1);
        fetchPlans({ planDate });
        fetchPlanGaps();
      }
    }
  };

  const normalizeKey = (key: string) => String(key || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const getField = (row: Record<string, any>, aliases: string[]) => {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(row, alias)) {
        const value = row[alias];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
    }
    return '';
  };

  const resolveStyleId = (raw: any) => {
    const needle = String(raw || '').trim();
    if (!needle) return '';
    const lower = needle.toLowerCase();
    const exact = styles.find((s) =>
      String(s.id) === needle ||
      String(s.code || '').toLowerCase() === lower ||
      String(s.name || '').toLowerCase() === lower
    );
    return exact ? String(exact.id) : '';
  };

  const resolveWorkCentreId = (raw: any) => {
    const needle = String(raw || '').trim();
    if (!needle) return '';
    const lower = needle.toLowerCase();
    const exact = workCentres.find((w) =>
      String(w.id) === needle ||
      String(w.code || '').toLowerCase() === lower ||
      String(w.name || '').toLowerCase() === lower
    );
    return exact ? String(exact.id) : '';
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (styles.length === 0 || workCentres.length === 0) {
      toast.error('Master data not loaded. Please retry in a moment.');
      return;
    }

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Excel file has no sheets');
      const sheet = workbook.Sheets[sheetName];
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rawRows.length) throw new Error('Excel sheet is empty');

      const rows = rawRows.map((r) => {
        const normalized: Record<string, any> = {};
        Object.keys(r).forEach((k) => { normalized[normalizeKey(k)] = r[k]; });
        return normalized;
      });

      const routingCache = new Map<string, any>();
      const defaultDate = todayDateKey();
      const payloadLines = [];

      for (let idx = 0; idx < rows.length; idx += 1) {
        const row = rows[idx];
        const styleRaw = getField(row, ['style_id', 'style_code', 'style']);
        const workCentreRaw = getField(row, ['work_centre_id', 'work_centre_code', 'work_centre']);
        const planDateRaw = getField(row, ['plan_date', 'date']) || defaultDate;
        const targetRaw = getField(row, ['total_target_per_day', 'target_per_day', 'target']);
        const pairsRaw = getField(row, ['target_pairs_per_tray', 'pairs_per_tray']);
        const trayRaw = getField(row, ['tray_count']);
        const manHoursRaw = getField(row, ['man_hours_minutes', 'man_hours', 'manhours']);
        const smvRaw = getField(row, ['smv_per_pair', 'smv']);

        const styleId = resolveStyleId(styleRaw);
        const workCentreId = resolveWorkCentreId(workCentreRaw);
        if (!styleId) throw new Error(`Row ${idx + 2}: invalid style`);
        if (!workCentreId) throw new Error(`Row ${idx + 2}: invalid work centre`);
        if (!targetRaw || !pairsRaw) throw new Error(`Row ${idx + 2}: missing total_target_per_day or target_pairs_per_tray`);

        if (!routingCache.has(styleId)) {
          const res = await apiFetch(`${API_BASE}/api/production-routing/style/${styleId}`);
          const routing = await res.json();
          if (!routing.success || !routing.data) {
            throw new Error(`Row ${idx + 2}: routing not found for selected style`);
          }
          let computedManHours = 0;
          if (Array.isArray(routing.data.lines)) {
            const secs = routing.data.lines.reduce((sum: number, l: any) => {
              const obs = parseFloat(l.observed_time) || 0;
              const rf = parseFloat(l.rating_factor) || 0;
              const mp = parseFloat(l.manpower) || 0;
              const std = (obs * rf / 100) * 1.15;
              return sum + (std * mp);
            }, 0);
            computedManHours = Math.round(secs / 60);
          }
          routingCache.set(styleId, {
            customer_id: routing.data.customer_id,
            group_id: routing.data.group_id || null,
            leather_id: routing.data.leather_id || null,
            color_id: routing.data.color_id || null,
            smv_per_pair: routing.data.tot_smv,
            man_hours_minutes: computedManHours,
          });
        }

        const routingData = routingCache.get(styleId);
        const totalTarget = Math.round(Number(targetRaw));
        const pairsPerTray = Math.round(Number(pairsRaw));
        const trayCount = trayRaw ? Math.round(Number(trayRaw)) : (pairsPerTray > 0 ? Math.ceil(totalTarget / pairsPerTray) : 0);

        payloadLines.push({
          plan_date: String(planDateRaw).split('T')[0],
          style_id: Number(styleId),
          customer_id: Number(routingData.customer_id),
          group_id: routingData.group_id ? Number(routingData.group_id) : null,
          leather_id: routingData.leather_id ? Number(routingData.leather_id) : null,
          color_id: routingData.color_id ? Number(routingData.color_id) : null,
          work_centre_id: Number(workCentreId),
          total_target_per_day: totalTarget,
          target_pairs_per_tray: pairsPerTray,
          tray_count: trayCount,
          man_hours_minutes: Math.round(Number(manHoursRaw || routingData.man_hours_minutes || 0)),
          smv_per_pair: Number(smvRaw || routingData.smv_per_pair || 0),
        });
      }

      const res = await apiFetch(`${API_BASE}/api/production-planning/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: payloadLines }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Bulk import failed');

      toast.success(`Imported ${result?.data?.count || payloadLines.length} planning line(s)`);
      fetchPlans();
    } catch (error: any) {
      toast.error(error?.message || 'Excel import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pageStats = React.useMemo(() => {
    const activeOnPage = plans.filter((p) => !p.is_deleted).length;
    const deletedOnPage = plans.filter((p) => p.is_deleted).length;
    const targetOnPage = plans
      .filter((p) => !p.is_deleted)
      .reduce((sum, p) => sum + Number(p.total_target_per_day || 0), 0);
    return { activeOnPage, deletedOnPage, targetOnPage };
  }, [plans]);

  const downloadPlanningTemplate = () => {
    const rows = [
      {
        plan_date: todayDateKey(),
        style: 'STYLE01',
        work_centre: 'WC01',
        total_target_per_day: 1200,
        target_pairs_per_tray: 24,
        tray_count: 50,
        man_hours_minutes: 210,
        smv_per_pair: 28.5,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'planning_template');
    XLSX.writeFile(wb, 'production_planning_template.xlsx');
  };

  return (
    <div className="bg-gray-100 min-h-full px-3 py-4 sm:px-4 sm:py-6">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Plan"
        message="Are you sure you want to delete this plan? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
      <ConfirmDialog
        isOpen={restoreId !== null}
        title="Restore Plan"
        message="Restore this plan back to active records?"
        onConfirm={confirmRestore}
        onCancel={() => setRestoreId(null)}
        confirmText="Restore"
      />

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 p-4 sm:p-5 shadow-sm mb-4">
        <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-0.5 sm:py-1 ring-1 ring-emerald-200">
              <ClipboardList className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-700" aria-hidden />
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-800">Daily plans</span>
            </div>
            <h1 className="mt-2 sm:mt-3 text-xl sm:text-2xl font-bold text-gray-900">Production Planning</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl hidden sm:block">
              Set daily line targets by style and work centre — feeds TV dashboard EOD targets and production tracking.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span>Add</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm disabled:opacity-50"
              title="Upload Excel: style, work_centre, plan_date, total_target_per_day, target_pairs_per_tray"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}
              <span className="sm:hidden">{importing ? '…' : 'Import'}</span>
              <span className="hidden sm:inline">{importing ? 'Importing…' : 'Import Excel'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTemplatePreview(true)}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold"
            >
              <Download className="h-4 w-4" aria-hidden />
              Template
            </button>
          </div>
        </div>
      </div>

      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="rounded-xl border border-indigo-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-indigo-700">
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wide">Total records</p>
          </div>
          <p className="text-xl sm:text-3xl font-black text-indigo-900 mt-1.5 sm:mt-2 tabular-nums">{pagination.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-700">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wide">Active (page)</p>
          </div>
          <p className="text-xl sm:text-3xl font-black text-emerald-900 mt-1.5 sm:mt-2 tabular-nums">{pageStats.activeOnPage}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-blue-700">
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wide">Target (active)</p>
          </div>
          <p className="text-xl sm:text-3xl font-black text-blue-900 mt-1.5 sm:mt-2 tabular-nums">{pageStats.targetOnPage.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-rose-700">
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wide">Deleted (page)</p>
          </div>
          <p className="text-xl sm:text-3xl font-black text-rose-900 mt-1.5 sm:mt-2 tabular-nums">{pageStats.deletedOnPage}</p>
        </div>
      </div>

      {!planGaps.loading && (planGaps.today?.missingCount || planGaps.tomorrow?.missingCount) ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-bold text-amber-900">Missing production plans</p>
              {planGaps.today && planGaps.today.missingCount > 0 && (
                <div className="text-sm text-amber-900">
                  <span className="font-semibold">
                    {planGaps.today.missingCount} of {planGaps.today.totalLines} line
                    {planGaps.today.totalLines === 1 ? '' : 's'}{' '}
                    {planGaps.today.missingCount === 1 ? 'has' : 'have'} no plan for today
                  </span>
                  <span className="text-amber-800"> ({formatPlanDateLabel(planGaps.today.dateKey)})</span>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {planGaps.today.missingLines.map((l) => l.code).join(', ')}
                  </p>
                </div>
              )}
              {planGaps.tomorrow && planGaps.tomorrow.missingCount > 0 && (
                <div className="text-sm text-amber-900">
                  <span className="font-semibold">
                    {planGaps.tomorrow.missingCount} of {planGaps.tomorrow.totalLines} line
                    {planGaps.tomorrow.totalLines === 1 ? '' : 's'}{' '}
                    {planGaps.tomorrow.missingCount === 1 ? 'has' : 'have'} no plan for tomorrow
                  </span>
                  <span className="text-amber-800"> ({formatPlanDateLabel(planGaps.tomorrow.dateKey)})</span>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {planGaps.tomorrow.missingLines.map((l) => l.code).join(', ')}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={fetchPlanGaps}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative min-h-[400px]">
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
            <div className="xl:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Style, customer, work centre…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Plan date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFilterDate(todayDateKey());
                    setCurrentPage(1);
                  }}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                    filterDate === todayDateKey()
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterDate(dayAfterDateKey(todayDateKey()));
                    setCurrentPage(1);
                  }}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                    filterDate === dayAfterDateKey(todayDateKey())
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Tomorrow
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Work centre</label>
              <select
                value={filterWorkCentre}
                onChange={(e) => {
                  setFilterWorkCentre(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">All lines</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={String(wc.id)}>{wc.code} — {wc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Style</label>
              <select
                value={filterStyle}
                onChange={(e) => {
                  setFilterStyle(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">All styles</option>
                {styles.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 cursor-pointer select-none hover:bg-gray-50">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => {
                  setShowDeleted(e.target.checked);
                  setCurrentPage(1);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Show deleted
            </label>
            <button
              type="button"
              onClick={() => fetchPlans()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            {filterDate && (
              <span className="text-xs font-semibold text-gray-500 ml-auto">
                Filtering: {formatPlanDateLabel(filterDate)}
              </span>
            )}
          </div>
        </div>

        {refreshing && plans.length === 0 && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" aria-hidden />
              <span className="text-sm text-gray-600">Loading plans…</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto hidden sm:block">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-gray-200 sticky top-0 z-[1]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Style</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Work centre</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Target/day</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Pairs/tray</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50/80 ${p.is_deleted ? 'bg-rose-50/40' : ''}`}>
                  <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{formatPlanDateLabel(p.plan_date)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.style_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Factory className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
                      {p.work_centre_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-blue-800 tabular-nums">{Number(p.total_target_per_day || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-700">{p.target_pairs_per_tray}</td>
                  <td className="px-4 py-3 text-sm">
                    {p.is_deleted ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 ring-1 ring-rose-200">Deleted</span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1.5">
                      {p.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => setRestoreId(p.id)}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(p.id)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-blue-700 hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && !refreshing && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" aria-hidden />
                    <p className="text-sm font-semibold text-gray-700">No planning records found</p>
                    <p className="text-xs text-gray-500 mt-1">Add a plan or adjust filters for {filterDate ? formatPlanDateLabel(filterDate) : 'today'}.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden space-y-2 p-2">
          {plans.length === 0 && !refreshing && (
            <div className="px-4 py-14 text-center">
              <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" aria-hidden />
              <p className="text-sm font-semibold text-gray-700">No planning records found</p>
              <p className="text-xs text-gray-500 mt-1">Add a plan or adjust filters.</p>
            </div>
          )}
          {plans.map((p) => (
            <div key={p.id} className={`rounded-xl border p-3 shadow-sm ${p.is_deleted ? 'border-rose-200 bg-rose-50/40' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-gray-900">{p.style_name}</span>
                    {p.is_deleted ? (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 ring-1 ring-rose-200">Deleted</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                    <Factory className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
                    <span className="font-medium text-gray-700">{p.work_centre_name}</span>
                    <span className="text-gray-300 mx-0.5">·</span>
                    <span className="tabular-nums">{formatPlanDateLabel(p.plan_date)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {p.is_deleted ? (
                    <button type="button" onClick={() => setRestoreId(p.id)} className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100" title="Restore">
                      <RotateCcw className="h-4 w-4" aria-hidden />
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => handleEdit(p.id)} className="p-2 rounded-lg text-blue-700 hover:bg-blue-50 active:bg-blue-100" title="Edit">
                        <Edit className="h-4 w-4" aria-hidden />
                      </button>
                      <button type="button" onClick={() => handleDelete(p.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 active:bg-red-100" title="Delete">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2.5 flex items-center border-t border-gray-100 pt-2.5">
                <div className="flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Target/day</p>
                  <p className="text-lg font-black text-blue-800 tabular-nums leading-none mt-0.5">{Number(p.total_target_per_day || 0).toLocaleString()}</p>
                </div>
                <div className="px-4 text-center border-l border-gray-100">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Pairs/tray</p>
                  <p className="text-sm font-bold tabular-nums text-gray-700 mt-0.5">{p.target_pairs_per_tray}</p>
                </div>
                <div className="px-4 text-center border-l border-gray-100">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Trays</p>
                  <p className="text-sm font-bold tabular-nums text-gray-700 mt-0.5">{p.tray_count || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 px-3 py-2">
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newLimit) => {
              setItemsPerPage(newLimit);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
      </>

      {showModal && (() => {
        const cellInput = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400';
        const cellReadOnly = 'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-slate-50 text-slate-700';
        const modalLines = editingId ? [lines[0] ?? emptyLine()] : lines;
        const yesterdaySourceLabel = formatPlanDateLabel(dayBeforeDateKey(planDate));
        const todaySourceLabel = formatPlanDateLabel(todayDateKey());

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowModal(false)}
            role="presentation"
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[min(100vw,1400px)] max-h-[100dvh] sm:h-auto sm:max-h-[95vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="plan-modal-title"
            >
              <div className="sticky top-0 z-10 border-b border-gray-200 bg-gradient-to-r from-emerald-50/80 via-slate-50 to-white px-4 sm:px-6 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] flex justify-between items-start gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <ClipboardList className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                      {editingId ? `Edit record · #${editingId}` : 'New record'}
                    </p>
                    <h2 id="plan-modal-title" className="text-lg sm:text-xl font-bold text-gray-900">
                      {editingId ? 'Edit' : 'Add'} Production Plan
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      All fields on one row — scroll horizontally if needed.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-slate-600" aria-hidden />
                      <h3 className="text-sm font-bold text-gray-900">
                        {modalLines.length > 1 ? `Plan lines (${modalLines.length})` : 'Plan line'}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!editingId && (
                        <>
                          <button
                            type="button"
                            onClick={handleCopyFromToday}
                            disabled={copyingPlans}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                            title={`Load plans from ${todaySourceLabel} for review before saving on ${formatPlanDateLabel(planDate)}`}
                          >
                            {copyingPlans ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Copy from today
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyFromYesterday}
                            disabled={copyingPlans}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                            title={`Load plans from ${yesterdaySourceLabel} for review before saving on ${formatPlanDateLabel(planDate)}`}
                          >
                            {copyingPlans ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Copy from yesterday
                          </button>
                        </>
                      )}
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full ring-1 ring-emerald-200">
                        Routing fields auto-fill when you pick a style
                      </span>
                    </div>
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-white">
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Plan date</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Customer</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Style</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Leather</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Color</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Group</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Work centre</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Target</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Pairs/tray</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Trays</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Man hrs</th>
                          <th className="text-left py-2.5 px-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">SMV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalLines.map((line, idx) => (
                          <tr key={`plan-line-${idx}-${line.work_centre_id || 'new'}`} className="hover:bg-slate-50/60 border-b border-gray-100 last:border-0">
                            {idx === 0 ? (
                              <td className="py-2 px-2 align-top min-w-[140px]" rowSpan={modalLines.length}>
                                <input
                                  type="date"
                                  value={planDate}
                                  onChange={(e) => setPlanDate(e.target.value)}
                                  className={cellInput}
                                  required
                                />
                                {!editingId && (
                                  <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                                    Copy from today ({todaySourceLabel}) or yesterday ({yesterdaySourceLabel})
                                  </p>
                                )}
                              </td>
                            ) : null}
                            <td className="py-2 px-2 align-top min-w-[110px]">
                              <input readOnly value={line.customer_name} className={cellReadOnly} placeholder="From routing" />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[130px]">
                              <select
                                value={line.style_id}
                                onChange={(e) => handleStyleChange(idx, e.target.value)}
                                className={`${cellInput} ${line.style_id && !line.smv_per_pair ? 'border-red-400 bg-red-50 focus:ring-red-300' : ''}`}
                                required
                              >
                                <option value="">Style</option>
                                {styles.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              {line.style_id && !line.smv_per_pair && (
                                <p className="text-[10px] text-red-600 mt-0.5 leading-tight">No routing</p>
                              )}
                            </td>
                            <td className="py-2 px-2 align-top min-w-[100px]">
                              <input readOnly value={line.leather_name} className={cellReadOnly} placeholder="From routing" />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[90px]">
                              <input readOnly value={line.color_name} className={cellReadOnly} placeholder="From routing" />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[100px]">
                              <input readOnly value={line.group_name} className={cellReadOnly} placeholder="From routing" />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[150px]">
                              <select
                                value={line.work_centre_id}
                                onChange={(e) => updateLine(idx, { work_centre_id: e.target.value })}
                                className={cellInput}
                                required
                              >
                                <option value="">Work centre</option>
                                {workCentres.map((c) => (
                                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 align-top min-w-[80px]">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={line.total_target_per_day}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const tray = line.target_pairs_per_tray;
                                  const trayCount = val && tray ? String(Math.ceil(parseInt(val) / parseInt(tray))) : line.tray_count;
                                  updateLine(idx, { total_target_per_day: val, tray_count: trayCount });
                                }}
                                className={`${cellInput} tabular-nums`}
                                required
                              />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[80px]">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={line.target_pairs_per_tray}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const target = line.total_target_per_day;
                                  const trayCount = val && target ? String(Math.ceil(parseInt(target) / parseInt(val))) : line.tray_count;
                                  updateLine(idx, { target_pairs_per_tray: val, tray_count: trayCount });
                                }}
                                className={`${cellInput} tabular-nums`}
                                required
                              />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[72px]">
                              <input readOnly value={line.tray_count} className={`${cellReadOnly} tabular-nums font-semibold`} />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[80px]">
                              <input readOnly value={line.man_hours_minutes} className={`${cellReadOnly} tabular-nums`} placeholder="—" />
                            </td>
                            <td className="py-2 px-2 align-top min-w-[72px]">
                              <input readOnly value={line.smv_per_pair} className={`${cellReadOnly} tabular-nums`} placeholder="—" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile stacked card view */}
                  <div className="sm:hidden p-3 space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Plan date</label>
                      <input
                        type="date"
                        value={planDate}
                        onChange={(e) => setPlanDate(e.target.value)}
                        className={cellInput}
                        required
                      />
                    </div>
                    {modalLines.map((line, idx) => (
                      <div key={`plan-line-mobile-${idx}-${line.work_centre_id || 'new'}`} className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                        {modalLines.length > 1 && (
                          <p className="text-[10px] font-bold uppercase text-gray-400">Line {idx + 1}</p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Style *</label>
                            <select
                              value={line.style_id}
                              onChange={(e) => handleStyleChange(idx, e.target.value)}
                              className={`${cellInput} ${line.style_id && !line.smv_per_pair ? 'border-red-400 bg-red-50 focus:ring-red-300' : ''}`}
                              required
                            >
                              <option value="">Select style</option>
                              {styles.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            {line.style_id && !line.smv_per_pair && (
                              <p className="text-[10px] text-red-600 mt-0.5">No routing found</p>
                            )}
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Work centre *</label>
                            <select
                              value={line.work_centre_id}
                              onChange={(e) => updateLine(idx, { work_centre_id: e.target.value })}
                              className={cellInput}
                              required
                            >
                              <option value="">Select work centre</option>
                              {workCentres.map((c) => (
                                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Target *</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={line.total_target_per_day}
                              onChange={(e) => {
                                const val = e.target.value;
                                const tray = line.target_pairs_per_tray;
                                const trayCount = val && tray ? String(Math.ceil(parseInt(val) / parseInt(tray))) : line.tray_count;
                                updateLine(idx, { total_target_per_day: val, tray_count: trayCount });
                              }}
                              className={`${cellInput} tabular-nums`}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Pairs/tray *</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={line.target_pairs_per_tray}
                              onChange={(e) => {
                                const val = e.target.value;
                                const target = line.total_target_per_day;
                                const trayCount = val && target ? String(Math.ceil(parseInt(target) / parseInt(val))) : line.tray_count;
                                updateLine(idx, { target_pairs_per_tray: val, tray_count: trayCount });
                              }}
                              className={`${cellInput} tabular-nums`}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Trays</label>
                            <input readOnly value={line.tray_count} className={`${cellReadOnly} tabular-nums font-semibold`} />
                          </div>
                        </div>
                        {(line.customer_name || line.leather_name || line.color_name || line.group_name || line.man_hours_minutes || line.smv_per_pair) && (
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                            {line.customer_name && (
                              <div>
                                <p className="text-[9px] font-bold uppercase text-gray-400">Customer</p>
                                <p className="text-xs text-gray-700 truncate">{line.customer_name}</p>
                              </div>
                            )}
                            {line.color_name && (
                              <div>
                                <p className="text-[9px] font-bold uppercase text-gray-400">Color</p>
                                <p className="text-xs text-gray-700 truncate">{line.color_name}</p>
                              </div>
                            )}
                            {line.group_name && (
                              <div>
                                <p className="text-[9px] font-bold uppercase text-gray-400">Group</p>
                                <p className="text-xs text-gray-700 truncate">{line.group_name}</p>
                              </div>
                            )}
                            {line.man_hours_minutes && (
                              <div>
                                <p className="text-[9px] font-bold uppercase text-gray-400">Man hrs</p>
                                <p className="text-xs font-semibold tabular-nums text-gray-700">{line.man_hours_minutes}</p>
                              </div>
                            )}
                            {line.smv_per_pair && (
                              <div>
                                <p className="text-[9px] font-bold uppercase text-gray-400">SMV</p>
                                <p className="text-xs font-semibold tabular-nums text-gray-700">{line.smv_per_pair}</p>
                              </div>
                            )}
                            {line.leather_name && (
                              <div>
                                <p className="text-[9px] font-bold uppercase text-gray-400">Leather</p>
                                <p className="text-xs text-gray-700 truncate">{line.leather_name}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="px-4 py-2.5 text-xs text-gray-500 border-t border-gray-100 bg-gray-50/80">
                    {!editingId
                      ? 'Use Copy from today or yesterday to load existing plans, adjust targets if needed, then save for the plan date above.'
                      : 'Customer, group, leather, color, man-hours and SMV auto-fill from Production Routing when you pick a style.'}
                  </p>
                </div>

                <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                    {loading ? 'Saving…' : (editingId ? 'Update plan' : (lines.length > 1 ? `Save ${lines.length} plans` : 'Save plan'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {showTemplatePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowTemplatePreview(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-4 py-3 border-b border-gray-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-700" aria-hidden />
                <h3 className="text-lg font-bold text-gray-900">Excel import template</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatePreview(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <table className="min-w-full text-sm border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['plan_date', 'style', 'work_centre', 'total_target_per_day', 'target_pairs_per_tray', 'tray_count', 'man_hours_minutes', 'smv_per_pair'].map((h) => (
                      <th key={h} className="px-2 py-2 border-b border-gray-200 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[
                      todayDateKey(),
                      'STYLE01',
                      'WC01',
                      '1200',
                      '24',
                      '50',
                      '210',
                      '28.5',
                    ].map((v, idx) => (
                      <td key={idx} className="px-2 py-2 border-b border-gray-100 whitespace-nowrap">{v}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTemplatePreview(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={downloadPlanningTemplate}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




