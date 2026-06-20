import React from 'react';
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Edit,
  X,
  RotateCcw,
  Download,
  Route,
  Search,
  FileSpreadsheet,
  Layers,
  Package,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import { computeShiftTargetPairs, getProductiveShiftTotals } from '../utils/shiftPaceUtils';
import {
  applyAutoCalc,
  calculateLineValues,
  calcToLineFields,
  CALC_FIELDS,
  type CalcField,
  type RoutingLine,
} from './ProductionRoutingForm.helpers';
import * as XLSX from 'xlsx';

const routingFieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30';
const routingReadonlyClass =
  'w-full rounded-lg border border-gray-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-700 tabular-nums shadow-inner';
const routingTableInputClass =
  'h-9 w-full min-w-0 max-w-full rounded-md border border-gray-300 bg-white px-1.5 text-sm tabular-nums text-gray-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/25';
const routingTableCalcCellClass =
  'h-9 w-full min-w-0 max-w-full rounded-md border border-violet-200 bg-violet-50/60 px-1.5 text-sm tabular-nums text-violet-950 shadow-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/25';

const FieldLabel: React.FC<{ label: string; required?: boolean; hint?: string }> = ({ label, required, hint }) => (
  <div className="mb-1.5">
    <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
      {label}
      {required ? <span className="text-red-500 ml-0.5">*</span> : null}
    </label>
    {hint ? <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{hint}</p> : null}
  </div>
);

interface MasterOption {
  id: number;
  code: string;
  name: string;
  machine_id?: string;
  machine_name?: string;
}


const buildMachineSelectOptions = (
  machineCentres: MasterOption[],
  lines: RoutingLine[],
  rowIndex: number
): SearchableSelectOption[] => {
  const taken = new Set(
    lines
      .filter((_, i) => i !== rowIndex)
      .map((l) => l.machine_centre_id)
      .filter(Boolean)
  );
  return machineCentres.map((m) => {
    const val = m.machine_id || String(m.id);
    return {
      value: val,
      label: m.machine_name ?? m.name,
      subLabel: m.machine_id || undefined,
      disabled: taken.has(val),
    };
  });
};

interface HeaderData {
  customer_id: string;
  group_id: string;
  leather_id: string;
  style_id: string;
  color_id: string;
  created_on: string;
  machine_centre_id: string;
  target_per_day: string;
  tot_smv: string;
}

export const ProductionRoutingForm: React.FC = () => {
  const [routings, setRoutings] = React.useState<any[]>([]);
  const [showModal, setShowModal] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [customers, setCustomers] = React.useState<MasterOption[]>([]);
  const [groups, setGroups] = React.useState<MasterOption[]>([]);
  const [leathers, setLeathers] = React.useState<MasterOption[]>([]);
  const [styles, setStyles] = React.useState<MasterOption[]>([]);
  const [colors, setColors] = React.useState<MasterOption[]>([]);
  const [machineCentres, setMachineCentres] = React.useState<MasterOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const hasFetched = React.useRef(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [restoreId, setRestoreId] = React.useState<number | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const routingTableRef = React.useRef<HTMLDivElement | null>(null);
  const nextRowIdRef = React.useRef(1);
  const [highlightedRowId, setHighlightedRowId] = React.useState<number | null>(null);

  const createEmptyLine = (): RoutingLine => ({
    _rowId: nextRowIdRef.current++,
    machine_centre_id: '',
    machine_name: '',
    process: '',
    observed_time: '',
    base_observed_time: '',
    rating_factor: '',
    normal_time_secs_pr: '',
    std_time_secs_pr: '',
    mins_6_prs_box: '',
    pairs_per_hr: '',
    pairs_per_day: '',
    manpower: '',
  });

  const withRowIds = (items: Omit<RoutingLine, '_rowId'>[]): RoutingLine[] =>
    items.map((line) => ({ ...line, _rowId: nextRowIdRef.current++ }));

  const [headerData, setHeaderData] = React.useState<HeaderData>({
    customer_id: '',
    group_id: '',
    leather_id: '',
    style_id: '',
    color_id: '',
    created_on: new Date().toISOString().split('T')[0],
    machine_centre_id: '',
    target_per_day: '',
    tot_smv: '',
  });

  const [lines, setLines] = React.useState<RoutingLine[]>([createEmptyLine()]);

  React.useEffect(() => {
    if (highlightedRowId == null) return;
    const timer = window.setTimeout(() => setHighlightedRowId(null), 2600);
    requestAnimationFrame(() => {
      const rowEl = routingTableRef.current?.querySelector(`[data-row-id="${highlightedRowId}"]`);
      rowEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => window.clearTimeout(timer);
  }, [highlightedRowId, lines.length]);

  React.useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchRoutings();
    fetchMasters();
  }, []);

  React.useEffect(() => {
    if (hasFetched.current) {
      fetchRoutings();
    }
  }, [currentPage, itemsPerPage, searchTerm, showDeleted]);

  const fetchRoutings = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (showDeleted) params.set('include_deleted', '1');
      const [res] = await Promise.all([
        apiFetch(`${API_BASE}/api/production-routing?${params.toString()}`),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
      const result = await res.json();
      if (result.success) {
        setRoutings(result.data);
        if (result.pagination) {
          setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
        }
      }
    } catch (error) {
      console.error('Error fetching routings:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/production-routing/masters`);
      const result = await res.json();
      
      if (result.success) {
        setCustomers(result.data.customers);
        setGroups(result.data.groups);
        setLeathers(result.data.leathers);
        setStyles(result.data.styles);
        setColors(result.data.colors);
        setMachineCentres(result.data.machineCentres);
      }
    } catch (error: any) {
      toast.error('Error loading master data');
    }
  };

  const targetPerHour = headerData.target_per_day ? Math.round(parseFloat(headerData.target_per_day) / 8) : 0;

  const getDuplicateMachineIds = (routingLines: RoutingLine[]): string[] => {
    const counts = new Map<string, number>();
    routingLines.forEach((line) => {
      const machineId = (line.machine_centre_id || '').trim();
      if (!machineId) return;
      counts.set(machineId, (counts.get(machineId) || 0) + 1);
    });
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([machineId]) => machineId);
  };



  const routingLineFromApi = (l: any): RoutingLine => {
    const existingManpower = Number(l.manpower) || 0;
    const existingObserved = Number(l.observed_time) || 0;
    const baseObserved =
      l.base_observed_time != null
        ? Number(l.base_observed_time)
        : existingManpower > 0
          ? existingObserved / existingManpower
          : existingObserved;

    const line: RoutingLine = {
      machine_centre_id: String(l.machine_centre_id),
      machine_name: l.machine_name || l.machine_centre_name || '',
      process: l.process || '',
      observed_time: String(l.observed_time),
      base_observed_time: String(baseObserved),
      rating_factor: String(l.rating_factor),
      manpower: String(l.manpower),
      normal_time_secs_pr: l.normal_time_secs_pr != null ? String(Math.round(Number(l.normal_time_secs_pr))) : '',
      std_time_secs_pr: l.std_time_secs_pr != null ? String(Math.round(Number(l.std_time_secs_pr))) : '',
      mins_6_prs_box: l.mins_6_prs_box != null ? String(Number(l.mins_6_prs_box)) : '',
      pairs_per_hr: l.pairs_per_hr != null ? String(l.pairs_per_hr) : '',
      pairs_per_day: l.pairs_per_day != null ? String(l.pairs_per_day) : '',
    };
    const auto = calculateLineValues(line);
    const locked: CalcField[] = [];
    for (const key of CALC_FIELDS) {
      const stored = parseFloat(line[key]);
      const autoVal =
        key === 'mins_6_prs_box'
          ? auto.mins_6_prs_box
          : Number(auto[key as keyof typeof auto]);
      if (Number.isFinite(stored) && Math.abs(stored - autoVal) > 0.05) {
        locked.push(key);
      }
    }
    const filled = applyAutoCalc({ ...line, _lockedCalcFields: locked.length ? locked : undefined });
    for (const key of locked) {
      filled[key] = line[key];
    }
    return filled;
  };

  const addLine = () => {
    const newLine = createEmptyLine();
    setLines((prev) => {
      const next = [...prev, newLine];
      toast.success(`Machine row ${next.length} added`, { id: 'routing-add-line', duration: 1800 });
      return next;
    });
    setHighlightedRowId(newLine._rowId!);
  };
  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      toast.error('At least one line required');
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
    toast('Row removed', { id: 'routing-remove-line', duration: 1200 });
  };
  const updateLine = (index: number, field: keyof RoutingLine, value: string) => {
    setLines((prev) => {
      const newLines = [...prev];
      let next: RoutingLine = { ...newLines[index], [field]: value };
      if (field === 'observed_time') {
        next.base_observed_time = value;
        next = applyAutoCalc(next);
      } else if (field === 'rating_factor') {
        next = applyAutoCalc(next);
      } else if (field === 'manpower') {
        // Unlock all calc fields so manpower change recalculates everything
        next._lockedCalcFields = undefined;
        next = applyAutoCalc(next);
      } else if (CALC_FIELDS.includes(field as CalcField)) {
        const locked = [...(next._lockedCalcFields || [])];
        if (!locked.includes(field as CalcField)) locked.push(field as CalcField);
        next._lockedCalcFields = locked;
      }
      newLines[index] = next;
      return newLines;
    });
  };

  const handleAdd = () => {
    setEditingId(null);
    setHeaderData({ customer_id: '', group_id: '', leather_id: '', style_id: '', color_id: '', created_on: new Date().toISOString().split('T')[0], machine_centre_id: '', target_per_day: '', tot_smv: '' });
    setLines([createEmptyLine()]);
    setHighlightedRowId(null);
    setShowModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/production-routing/${id}`);
      const result = await res.json();
      if (result.success) {
        setEditingId(id);
        const header = result.data.header;
        setHeaderData({
          ...header,
          customer_id: String(header.customer_id),
          group_id: String(header.group_id),
          leather_id: header.leather_id != null ? String(header.leather_id) : '',
          style_id: String(header.style_id),
          color_id: String(header.color_id),
          created_on: header.created_on ? new Date(header.created_on).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          target_per_day: String(header.target_per_day),
          tot_smv: String(header.tot_smv)
        });
        setLines(withRowIds(result.data.lines.map((l: any) => routingLineFromApi(l))));
        setHighlightedRowId(null);
        setShowModal(true);
      }
    } catch (error) {
      toast.error('Failed to load routing');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteId(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/production-routing/${deleteId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Routing deleted');
        fetchRoutings();
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
      const res = await apiFetch(`${API_BASE}/api/production-routing/${restoreId}/restore`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast.success('Routing restored');
        fetchRoutings();
      } else {
        toast.error(result.error || 'Restore failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerData.customer_id || !headerData.style_id || !headerData.target_per_day || !headerData.tot_smv) {
      toast.error('Please fill all required header fields');
      return;
    }
    if (lines.some(l => !l.machine_centre_id || !l.observed_time || !l.rating_factor || !l.manpower
      || !l.normal_time_secs_pr || !l.std_time_secs_pr || !l.mins_6_prs_box || !l.pairs_per_hr || !l.pairs_per_day)) {
      toast.error('Please fill all line item fields');
      return;
    }
    const targetPerDay = parseFloat(headerData.target_per_day);
    const totalSmv = parseFloat(headerData.tot_smv);
    if (!Number.isFinite(targetPerDay) || targetPerDay <= 0) {
      toast.error('Target per day must be greater than 0');
      return;
    }
    if (!Number.isFinite(totalSmv) || totalSmv <= 0) {
      toast.error('Total SMV must be greater than 0');
      return;
    }
    const invalidLineIndex = lines.findIndex((line) => {
      const observedTime = parseFloat(line.observed_time);
      const ratingFactor = parseFloat(line.rating_factor);
      const manpower = parseFloat(line.manpower);
      return (
        !Number.isFinite(observedTime) || observedTime <= 0 ||
        !Number.isFinite(ratingFactor) || ratingFactor <= 0 || ratingFactor > 200 ||
        !Number.isFinite(manpower) || manpower <= 0
      );
    });
    if (invalidLineIndex >= 0) {
      toast.error(`Line ${invalidLineIndex + 1}: invalid observed time / rating factor / manpower`);
      return;
    }
    const duplicateMachineIds = getDuplicateMachineIds(lines);
    if (duplicateMachineIds.length > 0) {
      toast.error('Duplicate machine centre entries are not allowed');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        header: headerData,
        lines: lines.map(line => ({
          machine_centre_id: line.machine_centre_id,
          process: line.process || null,
          observed_time: parseFloat(line.observed_time),
          rating_factor: parseFloat(line.rating_factor),
          normal_time_secs_pr: parseFloat(line.normal_time_secs_pr),
          std_time_secs_pr: parseFloat(line.std_time_secs_pr),
          mins_6_prs_box: parseFloat(line.mins_6_prs_box),
          pairs_per_hr: parseFloat(line.pairs_per_hr),
          pairs_per_day: parseFloat(line.pairs_per_day),
          manpower: parseFloat(line.manpower),
        })),
      };

      const url = editingId ? `${API_BASE}/api/production-routing/${editingId}` : `${API_BASE}/api/production-routing`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();

      if (result.success) {
        toast.success(editingId ? 'Routing updated' : 'Routing created');
        setShowModal(false);
        fetchRoutings();
      } else {
        toast.error(result.error || 'Failed to save routing');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setLoading(false);
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

  const resolveMasterId = (options: MasterOption[], raw: any) => {
    const needle = String(raw || '').trim();
    if (!needle) return '';
    const lower = needle.toLowerCase();
    const exact = options.find((o) =>
      String(o.id) === needle ||
      String(o.code || '').toLowerCase() === lower ||
      String(o.name || '').toLowerCase() === lower
    );
    return exact ? String(exact.id) : '';
  };

  const resolveMachineId = (raw: any) => {
    const needle = String(raw || '').trim();
    if (!needle) return '';
    const lower = needle.toLowerCase();
    const exact = machineCentres.find((m) =>
      String(m.machine_id || '') === needle ||
      String(m.machine_name || '').toLowerCase() === lower ||
      String(m.name || '').toLowerCase() === lower
    );
    return exact ? String(exact.machine_id) : '';
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (customers.length === 0 || styles.length === 0 || machineCentres.length === 0) {
      toast.error('Master data is not loaded yet. Please retry in a moment.');
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
        Object.keys(r).forEach((k) => {
          normalized[normalizeKey(k)] = r[k];
        });
        return normalized;
      });

      const routingGroups = new Map<string, { header: HeaderData; lines: RoutingLine[] }>();
      const today = new Date().toISOString().split('T')[0];

      rows.forEach((row, idx) => {
        const customerRaw = getField(row, ['customer_id', 'customer_code', 'customer']);
        const groupRaw = getField(row, ['group_id', 'group_code', 'group']);
        const leatherRaw = getField(row, ['leather_id', 'leather_code', 'leather']);
        const styleRaw = getField(row, ['style_id', 'style_code', 'style']);
        const colorRaw = getField(row, ['color_id', 'color_code', 'color']);
        const createdOnRaw = getField(row, ['created_on', 'created_date', 'date']) || today;
        const targetRaw = getField(row, ['target_per_day', 'target_day', 'target']);
        const smvRaw = getField(row, ['tot_smv', 'total_smv', 'smv']);
        const machineRaw = getField(row, ['machine_centre_id', 'machine_id', 'machine']);
        const processRaw = getField(row, ['process']);
        const observedRaw = getField(row, ['observed_time', 'observed']);
        const ratingRaw = getField(row, ['rating_factor', 'rating']);
        const manpowerRaw = getField(row, ['manpower']);

        const customerId = resolveMasterId(customers, customerRaw);
        const groupId = resolveMasterId(groups, groupRaw);
        const leatherId = leatherRaw ? resolveMasterId(leathers, leatherRaw) : null;
        const styleId = resolveMasterId(styles, styleRaw);
        const colorId = resolveMasterId(colors, colorRaw);
        const machineId = resolveMachineId(machineRaw);

        if (!customerId || !groupId || !styleId || !colorId) {
          throw new Error(`Row ${idx + 2}: invalid customer/group/style/color mapping`);
        }
        if (leatherRaw && !leatherId) {
          throw new Error(`Row ${idx + 2}: invalid leather mapping`);
        }
        if (!machineId) {
          throw new Error(`Row ${idx + 2}: invalid machine mapping`);
        }
        if (!targetRaw || !smvRaw || !observedRaw || !ratingRaw || !manpowerRaw) {
          throw new Error(`Row ${idx + 2}: missing target/smv/observed/rating/manpower`);
        }

        const header: HeaderData = {
          customer_id: customerId,
          group_id: groupId,
          leather_id: leatherId ? String(leatherId) : '',
          style_id: styleId,
          color_id: colorId,
          created_on: String(createdOnRaw).split('T')[0],
          machine_centre_id: '',
          target_per_day: String(targetRaw),
          tot_smv: String(smvRaw),
        };

        const line: RoutingLine = {
          machine_centre_id: machineId,
          machine_name: '',
          process: String(processRaw || ''),
          observed_time: String(observedRaw),
          rating_factor: String(ratingRaw),
          manpower: String(manpowerRaw),
        };

        const groupKey = [
          header.customer_id,
          header.group_id,
          header.leather_id,
          header.style_id,
          header.color_id,
          header.created_on,
          header.target_per_day,
          header.tot_smv,
        ].join('|');

        if (!routingGroups.has(groupKey)) {
          routingGroups.set(groupKey, { header, lines: [] });
        }
        routingGroups.get(groupKey)!.lines.push(line);
      });

      const items = Array.from(routingGroups.values()).map((group) => {
        const dedupedLines = group.lines.filter((line, index, arr) =>
          arr.findIndex((x) => x.machine_centre_id === line.machine_centre_id) === index
        );
        return {
          header: group.header,
          lines: dedupedLines.map((line) => ({
            machine_centre_id: line.machine_centre_id,
            process: line.process || null,
            observed_time: parseFloat(line.observed_time),
            rating_factor: parseFloat(line.rating_factor),
            manpower: parseFloat(line.manpower),
          })),
        };
      });

      const response = await apiFetch(`${API_BASE}/api/production-routing/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Import failed while saving routing');
      }

      const createdCount = Number(result?.data?.created_count || items.length);
      toast.success(`Imported ${createdCount} routing record(s) from Excel`);
      fetchRoutings();
    } catch (error: any) {
      toast.error(error?.message || 'Excel import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pageStats = React.useMemo(() => {
    const activeOnPage = routings.filter((r) => !r.is_deleted).length;
    const deletedOnPage = routings.filter((r) => r.is_deleted).length;
    const machinesOnPage = routings.reduce((sum, r) => sum + Number(r.line_count || 0), 0);
    return { activeOnPage, deletedOnPage, machinesOnPage };
  }, [routings]);

  const routingModalSummary = React.useMemo(() => {
    const style = styles.find((s) => String(s.id) === headerData.style_id);
    const customer = customers.find((c) => String(c.id) === headerData.customer_id);
    const filledLines = lines.filter((l) => l.machine_centre_id.trim()).length;
    return {
      styleName: style?.name || '',
      customerName: customer?.name || '',
      filledLines,
    };
  }, [styles, customers, headerData.style_id, headerData.customer_id, lines]);

  const calcCellClass = (line: RoutingLine, field: CalcField) =>
    line._lockedCalcFields?.includes(field) ? routingTableCalcCellClass + ' ring-1 ring-amber-300/80' : routingTableCalcCellClass;

  const routingLineRowBg = (isHighlighted: boolean, isEmptyRow: boolean, index: number) =>
    isHighlighted
      ? 'bg-indigo-50'
      : isEmptyRow
        ? 'bg-amber-50/60'
        : index % 2 === 0
          ? 'bg-white'
          : 'bg-slate-50/40';

  const downloadRoutingTemplate = () => {
    const rows = [
      {
        customer: 'CUST01',
        group: 'GRP01',
        leather: 'LEA01',
        style: 'STYLE01',
        color: 'COL01',
        created_on: new Date().toISOString().split('T')[0],
        target_per_day: 1200,
        tot_smv: 28.5,
        machine_id: 'MC01',
        process: 'Stitching',
        observed_time: 145,
        rating_factor: 100,
        manpower: 1.2,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'routing_template');
    XLSX.writeFile(wb, 'production_routing_template.xlsx');
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-white px-3 py-4 sm:px-5 sm:py-6">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Routing"
        message="Are you sure you want to delete this routing? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
      <ConfirmDialog
        isOpen={restoreId !== null}
        title="Restore Routing"
        message="Restore this routing back to active records?"
        onConfirm={confirmRestore}
        onCancel={() => setRestoreId(null)}
        confirmText="Restore"
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-900/5 mb-5 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-emerald-500/[0.04] pointer-events-none" aria-hidden />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 ring-1 ring-indigo-100">
              <Route className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">Style routing</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Production Routing</h1>
            <p className="text-sm text-gray-600 mt-1.5 max-w-2xl leading-relaxed">
              Define machine sequence, observed times, and SMV per style — feeds planning, targets, and production tracking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold shadow-sm shadow-indigo-600/25 transition"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add routing
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
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-semibold shadow-sm shadow-emerald-600/20 disabled:opacity-50 transition"
              title="Upload Excel with customer, style, machine, observed time, rating, manpower columns"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}
              {importing ? 'Importing…' : 'Import Excel'}
            </button>
            <button
              type="button"
              onClick={() => setShowTemplatePreview(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 text-sm font-semibold shadow-sm transition"
            >
              <Download className="h-4 w-4" aria-hidden />
              Template
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {(
          [
            {
              label: 'Total records',
              value: pagination.total,
              icon: Layers,
              card: 'border-indigo-100 from-indigo-50/80 to-white',
              labelCls: 'text-indigo-700',
              valueCls: 'text-indigo-950',
              iconWrap: 'bg-indigo-600/10 text-indigo-600',
            },
            {
              label: 'Active (page)',
              value: pageStats.activeOnPage,
              icon: Package,
              card: 'border-emerald-100 from-emerald-50/80 to-white',
              labelCls: 'text-emerald-700',
              valueCls: 'text-emerald-950',
              iconWrap: 'bg-emerald-600/10 text-emerald-600',
            },
            {
              label: 'Machines (page)',
              value: pageStats.machinesOnPage,
              icon: Route,
              card: 'border-violet-100 from-violet-50/80 to-white',
              labelCls: 'text-violet-700',
              valueCls: 'text-violet-950',
              iconWrap: 'bg-violet-600/10 text-violet-600',
            },
            {
              label: 'Deleted (page)',
              value: pageStats.deletedOnPage,
              icon: Trash2,
              card: 'border-rose-100 from-rose-50/80 to-white',
              labelCls: 'text-rose-700',
              valueCls: 'text-rose-950',
              iconWrap: 'bg-rose-600/10 text-rose-600',
            },
          ] as const
        ).map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ring-1 ring-black/[0.03] ${stat.card}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${stat.labelCls}`}>{stat.label}</p>
                  <p className={`text-2xl sm:text-3xl font-black mt-1.5 tabular-nums ${stat.valueCls}`}>{stat.value}</p>
                </div>
                <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${stat.iconWrap}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm ring-1 ring-black/[0.03] overflow-hidden relative min-h-[420px]">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Search routings</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Style, customer, color, target, SMV…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/25"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:pt-5">
            <label
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium cursor-pointer select-none transition ${
                showDeleted
                  ? 'border-rose-200 bg-rose-50 text-rose-800 ring-1 ring-rose-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => {
                  setShowDeleted(e.target.checked);
                  setCurrentPage(1);
                }}
                className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-400/30"
              />
              Show deleted
            </label>
            <button
              type="button"
              onClick={fetchRoutings}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {refreshing && routings.length === 0 && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-8 py-6 shadow-lg">
              <Loader2 className="h-9 w-9 text-indigo-600 animate-spin" aria-hidden />
              <span className="text-sm font-medium text-gray-700">Loading routings…</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gradient-to-r from-slate-100/90 to-slate-50/50">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Style</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Color</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target/day</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">SMV</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Machines</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/80">
              {routings.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`group transition-colors ${
                    r.is_deleted
                      ? 'bg-rose-50/50 hover:bg-rose-50/70'
                      : idx % 2 === 0
                        ? 'bg-white hover:bg-indigo-50/30'
                        : 'bg-slate-50/40 hover:bg-indigo-50/30'
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="text-sm font-semibold text-gray-900">{r.customer_name || '—'}</div>
                    {r.group_name ? (
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[10rem]">{r.group_name}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-sm font-bold text-gray-900">{r.style_name || '—'}</div>
                    {r.leather_name ? (
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[10rem]">{r.leather_name}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex text-xs font-medium text-gray-700 bg-gray-100/80 px-2 py-1 rounded-md ring-1 ring-gray-200/60">
                      {r.color_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm tabular-nums font-bold text-indigo-700">
                      {Number(r.target_per_day || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-mono tabular-nums text-gray-700">{r.tot_smv ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${
                        r.line_count > 0
                          ? 'bg-violet-50 text-violet-800 ring-violet-200/80'
                          : 'bg-amber-50 text-amber-800 ring-amber-200/80'
                      }`}
                    >
                      <Route className="h-3 w-3" aria-hidden />
                      {r.line_count}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600 tabular-nums whitespace-nowrap">
                    {new Date(r.created_on).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5">
                    {r.is_deleted ? (
                      <span className="inline-flex text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 ring-1 ring-rose-200/80">
                        Deleted
                      </span>
                    ) : (
                      <span className="inline-flex text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1 opacity-90 group-hover:opacity-100">
                      {r.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => setRestoreId(r.id)}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-emerald-700 hover:bg-emerald-100/80 ring-1 ring-transparent hover:ring-emerald-200 transition"
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(r.id)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-indigo-700 hover:bg-indigo-100/80 ring-1 ring-transparent hover:ring-indigo-200 transition"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-rose-700 hover:bg-rose-100/80 ring-1 ring-transparent hover:ring-rose-200 transition"
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
              {routings.length === 0 && !refreshing && (
                <tr>
                  <td colSpan={9} className="px-4 py-20 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                        <Route className="h-7 w-7 text-indigo-400" aria-hidden />
                      </div>
                      <p className="mt-4 text-base font-semibold text-gray-800">No routing records found</p>
                      <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                        {searchTerm || showDeleted
                          ? 'Try adjusting your search or filters.'
                          : 'Add a routing manually or import from Excel to get started.'}
                      </p>
                      {!searchTerm && !showDeleted && (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleAdd}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold shadow-sm transition"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                            Add routing
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm font-semibold transition"
                          >
                            <FileSpreadsheet className="h-4 w-4" aria-hidden />
                            Import Excel
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 bg-slate-50/50 px-4 sm:px-5 py-3">
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

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-0 sm:p-4"
          onClick={() => setShowModal(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-[min(100vw,1440px)] max-h-[96vh] sm:max-h-[94vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/10"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="routing-modal-title"
          >
            <div className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 px-4 sm:px-6 py-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
                    <Route className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                      {editingId ? 'Update routing' : 'Create routing'}
                    </p>
                    <h2 id="routing-modal-title" className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                      {editingId ? 'Edit' : 'Add'} Production Routing
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                      {routingModalSummary.styleName
                        ? <>Timing for <span className="font-semibold text-gray-700">{routingModalSummary.styleName}</span>{routingModalSummary.customerName ? <> · {routingModalSummary.customerName}</> : null}</>
                        : 'Set style details, then add one row per machine centre.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-white/80 hover:text-gray-700 ring-1 ring-transparent hover:ring-gray-200 transition"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50/80 to-white shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-200 bg-white/70">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden />
                      <h3 className="text-sm font-bold text-gray-900">Header information</h3>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full ring-1 ring-indigo-100">
                      <Layers className="h-3 w-3" aria-hidden />
                      One routing per style · all machines
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 space-y-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Style &amp; product</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <FieldLabel label="Customer" required />
                          <select value={headerData.customer_id} onChange={(e) => setHeaderData({ ...headerData, customer_id: e.target.value })} className={routingFieldClass} required>
                            <option value="">Select customer</option>
                            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <FieldLabel label="Group" required />
                          <select value={headerData.group_id} onChange={(e) => setHeaderData({ ...headerData, group_id: e.target.value })} className={routingFieldClass} required>
                            <option value="">Select group</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <FieldLabel label="Leather" hint="Optional" />
                          <select value={headerData.leather_id} onChange={(e) => setHeaderData({ ...headerData, leather_id: e.target.value })} className={routingFieldClass}>
                            <option value="">No leather selected</option>
                            {leathers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <FieldLabel label="Style" required />
                          <select value={headerData.style_id} onChange={(e) => setHeaderData({ ...headerData, style_id: e.target.value })} className={routingFieldClass} required>
                            <option value="">Select style</option>
                            {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <FieldLabel label="Color" required />
                          <select value={headerData.color_id} onChange={(e) => setHeaderData({ ...headerData, color_id: e.target.value })} className={routingFieldClass} required>
                            <option value="">Select color</option>
                            {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <FieldLabel label="Created on" required />
                          <input type="date" value={headerData.created_on} onChange={(e) => setHeaderData({ ...headerData, created_on: e.target.value })} className={routingFieldClass} required />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Production targets</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <FieldLabel label="Target per day" required hint="Pairs planned for the full shift" />
                          <input type="number" min="1" step="1" value={headerData.target_per_day} onChange={(e) => setHeaderData({ ...headerData, target_per_day: e.target.value })} className={routingFieldClass} required />
                        </div>
                        <div>
                          <FieldLabel label="Target per hour" hint="Auto: target ÷ 8" />
                          <input type="text" value={targetPerHour} readOnly className={routingReadonlyClass} />
                        </div>
                        <div>
                          <FieldLabel label="Total SMV" required />
                          <input type="number" min="0.0001" step="0.0001" value={headerData.tot_smv} onChange={(e) => setHeaderData({ ...headerData, tot_smv: e.target.value })} className={routingFieldClass} required />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-200 bg-slate-50/80">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">Machine routing lines</h3>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 tabular-nums ring-1 ring-blue-200/80">
                          {routingModalSummary.filledLines}/{lines.length} configured
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Purple cells auto-calculate from observed time · edit to override
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addLine}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-sm font-semibold shadow-sm shadow-indigo-600/20 shrink-0 transition"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Add machine
                    </button>
                  </div>

                  <div ref={routingTableRef} className="overflow-x-auto max-h-[min(52vh,520px)] overflow-y-auto overscroll-x-contain">
                    <table className="w-full min-w-[1040px] text-sm table-fixed border-separate border-spacing-0">
                      <colgroup>
                        <col className="w-12" />
                        <col className="w-[min(240px,28vw)]" />
                        <col className="w-[5.25rem]" />
                        <col className="w-[4.75rem]" />
                        <col className="w-[4.5rem]" />
                        <col className="w-[4.5rem]" />
                        <col className="w-[4.75rem]" />
                        <col className="w-[4.75rem]" />
                        <col className="w-[5rem]" />
                        <col className="w-[4.25rem]" />
                        <col className="w-11" />
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-gray-200">
                          <th
                            className="sticky left-0 z-30 px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide bg-white border-r border-gray-200 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]"
                            rowSpan={2}
                          >
                            #
                          </th>
                          <th
                            className="sticky left-12 z-30 px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide bg-white border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                            rowSpan={2}
                          >
                            Machine centre
                          </th>
                          <th
                            className="px-1 py-1.5 text-center text-[10px] font-bold text-sky-700 uppercase tracking-wide bg-sky-50 border-l border-sky-100"
                            colSpan={2}
                          >
                            Input
                          </th>
                          <th
                            className="px-1 py-1.5 text-center text-[10px] font-bold text-violet-700 uppercase tracking-wide bg-violet-50 border-l border-violet-100"
                            colSpan={5}
                          >
                            Calculated · editable
                          </th>
                          <th
                            className="px-1 py-1.5 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide bg-white border-l border-gray-100"
                            rowSpan={2}
                          >
                            MP
                          </th>
                          <th className="bg-white w-11" rowSpan={2} />
                        </tr>
                        <tr className="border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide shadow-sm">
                          <th className="px-1.5 py-2 text-center bg-sky-50 border-l border-sky-100 whitespace-nowrap">Observed</th>
                          <th className="px-1.5 py-2 text-center bg-sky-50 whitespace-nowrap">Rating %</th>
                          <th className="px-1.5 py-2 text-center bg-violet-50 border-l border-violet-100 whitespace-nowrap">Normal</th>
                          <th className="px-1.5 py-2 text-center bg-violet-50 whitespace-nowrap">Std</th>
                          <th className="px-1.5 py-2 text-center bg-violet-50 whitespace-nowrap">Mins/6</th>
                          <th className="px-1.5 py-2 text-center bg-violet-50 whitespace-nowrap" title="Pairs per hour">Pr/hr</th>
                          <th className="px-1.5 py-2 text-center bg-violet-50 whitespace-nowrap" title="Pairs per day">Pr/day</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lines.map((line, index) => {
                          const rowId = line._rowId ?? index;
                          const isHighlighted = highlightedRowId === rowId;
                          const isEmptyRow = !line.machine_centre_id.trim();
                          const rowBg = routingLineRowBg(isHighlighted, isEmptyRow, index);
                          return (
                            <tr
                              key={rowId}
                              data-row-id={rowId}
                              className={[
                                'transition-colors duration-300',
                                isHighlighted
                                  ? 'ring-2 ring-inset ring-indigo-300'
                                  : 'hover:bg-slate-50/80',
                                rowBg,
                              ].join(' ')}
                            >
                              <td className={`sticky left-0 z-[1] px-2 py-2 text-xs font-bold text-gray-500 tabular-nums align-middle border-r border-gray-100 ${rowBg}`}>
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600">{index + 1}</span>
                                  {isHighlighted ? (
                                    <span className="rounded bg-indigo-600 px-1.5 py-px text-[8px] font-bold uppercase text-white">New</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className={`sticky left-12 z-[1] px-2 py-2 border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] ${rowBg}`}>
                                <SearchableSelect
                                  value={line.machine_centre_id}
                                  options={buildMachineSelectOptions(machineCentres, lines, index)}
                                  onChange={(val) => updateLine(index, 'machine_centre_id', val)}
                                  placeholder="Select machine"
                                  searchPlaceholder="Search by ID or name…"
                                  footerCountLabel="machines"
                                  compact
                                  required
                                  className="min-w-0 w-full"
                                />
                              </td>
                              <td className="px-1.5 py-2 border-l border-sky-50">
                                <input type="number" min="0.01" step="0.01" value={line.observed_time} onChange={(e) => updateLine(index, 'observed_time', e.target.value)} className={routingTableInputClass} title="Observed time (seconds)" required />
                              </td>
                              <td className="px-1.5 py-2">
                                <input type="number" min="0.01" max="200" step="0.01" value={line.rating_factor} onChange={(e) => updateLine(index, 'rating_factor', e.target.value)} className={routingTableInputClass} title="Rating factor %" required />
                              </td>
                              <td className="px-1.5 py-2 border-l border-violet-50">
                                <input type="number" min="0" step="any" value={line.normal_time_secs_pr} onChange={(e) => updateLine(index, 'normal_time_secs_pr', e.target.value)} className={calcCellClass(line, 'normal_time_secs_pr')} title="Normal time (sec/pair)" required />
                              </td>
                              <td className="px-1.5 py-2">
                                <input type="number" min="0" step="any" value={line.std_time_secs_pr} onChange={(e) => updateLine(index, 'std_time_secs_pr', e.target.value)} className={calcCellClass(line, 'std_time_secs_pr')} title="Std time (sec/pair)" required />
                              </td>
                              <td className="px-1.5 py-2">
                                <input type="number" min="0" step="any" value={line.mins_6_prs_box} onChange={(e) => updateLine(index, 'mins_6_prs_box', e.target.value)} className={calcCellClass(line, 'mins_6_prs_box')} title="Minutes for 6 pairs" required />
                              </td>
                              <td className="px-1.5 py-2">
                                <input type="number" min="0" step="any" value={line.pairs_per_hr} onChange={(e) => updateLine(index, 'pairs_per_hr', e.target.value)} className={calcCellClass(line, 'pairs_per_hr')} required />
                              </td>
                              <td className="px-1.5 py-2">
                                <input type="number" min="0" step="any" value={line.pairs_per_day} onChange={(e) => updateLine(index, 'pairs_per_day', e.target.value)} className={calcCellClass(line, 'pairs_per_day')} required />
                              </td>
                              <td className="px-1.5 py-2 border-l border-gray-50">
                                <input type="number" min="0.1" step="0.1" value={line.manpower} onChange={(e) => updateLine(index, 'manpower', e.target.value)} className={routingTableInputClass} required />
                              </td>
                              <td className="px-1 py-2">
                                <button
                                  type="button"
                                  onClick={() => removeLine(index)}
                                  disabled={lines.length <= 1}
                                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition"
                                  title="Remove line"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="shrink-0 border-t border-gray-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3.5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-gray-500 text-center sm:text-left">
                  <span className="font-semibold text-gray-700">{routingModalSummary.filledLines}</span> machine{routingModalSummary.filledLines === 1 ? '' : 's'} ready to save
                  {routingModalSummary.styleName ? <> · <span className="text-gray-600">{routingModalSummary.styleName}</span></> : null}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 shadow-sm shadow-emerald-600/20 disabled:opacity-50 transition"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                    {loading ? 'Saving…' : 'Save routing'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplatePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowTemplatePreview(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-black/5"
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
                    {['customer', 'group', 'leather', 'style', 'color', 'created_on', 'target_per_day', 'tot_smv', 'machine_id', 'process', 'observed_time', 'rating_factor', 'manpower'].map((h) => (
                      <th key={h} className="px-2 py-2 border-b border-gray-200 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {['CUST01', 'GRP01', 'LEA01', 'STYLE01', 'COL01', new Date().toISOString().split('T')[0], '1200', '28.5', 'MC01', 'Stitching', '145', '100', '1.2'].map((v, idx) => (
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
                onClick={downloadRoutingTemplate}
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
