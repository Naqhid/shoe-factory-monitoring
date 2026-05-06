import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Save, Upload, Plus, Trash2, RefreshCw, Edit, X, RotateCcw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';
import * as XLSX from 'xlsx';

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
  const [planDate, setPlanDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = React.useState<LineItem[]>([emptyLine()]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterDate, setFilterDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [filterWorkCentre, setFilterWorkCentre] = React.useState('');
  const [filterStyle, setFilterStyle] = React.useState('');
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    fetchPlans();
    fetchMasters();
  }, []);

  React.useEffect(() => {
    fetchPlans();
  }, [currentPage, itemsPerPage, searchTerm, filterDate, filterWorkCentre, filterStyle, showDeleted]);

  const fetchPlans = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (filterDate) params.set('plan_date', filterDate);
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

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
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
    setPlanDate(new Date().toISOString().split('T')[0]);
    setLines([emptyLine()]);
    setShowModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/production-planning/${id}`);
      const result = await res.json();
      if (result.success) {
        const plan = result.data;
        setEditingId(id);
        setPlanDate(plan.plan_date ? new Date(plan.plan_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
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
          fetchPlans();
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
        toast.success(`Saved ${ok} line(s)`);
        setShowModal(false);
        fetchPlans();
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
      const defaultDate = new Date().toISOString().split('T')[0];
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

  const downloadPlanningTemplate = () => {
    const rows = [
      {
        plan_date: new Date().toISOString().split('T')[0],
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
    <div className="p-6">
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
      
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Production Planning</h1>
            <div className="flex gap-2">
              <button onClick={fetchPlans} disabled={refreshing} className="text-sm text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh'}
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
                className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                title="Upload Excel with columns like: style, work_centre, plan_date, total_target_per_day, target_pairs_per_tray"
              >
                {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? 'Importing...' : 'Upload Excel'}
              </button>
              <button
                type="button"
                onClick={() => setShowTemplatePreview(true)}
                className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                View Template
              </button>
              <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                <Plus className="h-4 w-4" />Add New
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search style/customer/work centre..."
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <select
              value={filterWorkCentre}
              onChange={(e) => {
                setFilterWorkCentre(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Work Centres</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={String(wc.id)}>{wc.code} - {wc.name}</option>
              ))}
            </select>
            <select
              value={filterStyle}
              onChange={(e) => {
                setFilterStyle(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Styles</option>
              {styles.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => {
                  setShowDeleted(e.target.checked);
                  setCurrentPage(1);
                }}
              />
              Show deleted
            </label>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-lg shadow-md p-6 relative min-h-[400px]">
        {refreshing && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              <span className="text-sm text-gray-600">Loading...</span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Style</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Work Centre</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pairs/Tray</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Record</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-sm">{new Date(p.plan_date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-sm">{p.style_name}</td>
                  <td className="px-4 py-2 text-sm">{p.work_centre_name}</td>
                  <td className="px-4 py-2 text-sm">{p.total_target_per_day}</td>
                  <td className="px-4 py-2 text-sm">{p.target_pairs_per_tray}</td>
                  <td className="px-4 py-2 text-sm">
                    {p.is_deleted ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Deleted</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="flex gap-2">
                      {p.is_deleted ? (
                        <button onClick={() => setRestoreId(p.id)} className="text-emerald-600 hover:text-emerald-900" title="Restore">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(p.id)} className="text-blue-600 hover:text-blue-900">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-900">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No planning records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Production Plan</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="max-w-xs border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  <button type="button" onClick={addLine} className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium">
                    <Plus className="h-4 w-4" /> Add Line
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Customer</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Style</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Leather</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Color</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Group</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Work Centre</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Total Target</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Pairs/Tray</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Tray Count</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Man Hrs (min)</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">SMV</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-1 px-2">
                            <input readOnly value={line.customer_name} className="w-full min-w-[100px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                          </td>
                          <td className="py-1 px-2">
                            <select
                              value={line.style_id}
                              onChange={(e) => handleStyleChange(idx, e.target.value)}
                              className={`w-full min-w-[120px] border rounded px-2 py-1 ${line.style_id && !line.smv_per_pair ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                            >
                              <option value="">Style</option>
                              {styles.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            {line.style_id && !line.smv_per_pair && (
                              <p className="text-xs text-red-500 mt-0.5">No routing for today</p>
                            )}
                          </td>
                          <td className="py-1 px-2">
                            <input readOnly value={line.leather_name} className="w-full min-w-[90px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                          </td>
                          <td className="py-1 px-2">
                            <input readOnly value={line.color_name} className="w-full min-w-[80px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                          </td>
                          <td className="py-1 px-2">
                            <input readOnly value={line.group_name} className="w-full min-w-[90px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                          </td>
                          <td className="py-1 px-2">
                            <select
                              value={line.work_centre_id}
                              onChange={(e) => updateLine(idx, { work_centre_id: e.target.value })}
                              className="w-full min-w-[120px] border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="">Work Centre</option>
                              {workCentres.map((c) => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 px-2">
                            <input type="number" value={line.total_target_per_day} onChange={(e) => {
                              const val = e.target.value;
                              const tray = line.target_pairs_per_tray;
                              const trayCount = val && tray ? String(Math.ceil(parseInt(val) / parseInt(tray))) : line.tray_count;
                              updateLine(idx, { total_target_per_day: val, tray_count: trayCount });
                            }} className="w-20 border border-gray-300 rounded px-2 py-1" />
                          </td>
                          <td className="py-1 px-2">
                            <input type="number" value={line.target_pairs_per_tray} onChange={(e) => {
                              const val = e.target.value;
                              const target = line.total_target_per_day;
                              const trayCount = val && target ? String(Math.ceil(parseInt(target) / parseInt(val))) : line.tray_count;
                              updateLine(idx, { target_pairs_per_tray: val, tray_count: trayCount });
                            }} className="w-20 border border-gray-300 rounded px-2 py-1" />
                          </td>
                          <td className="py-1 px-2">
                            <input readOnly value={line.tray_count} className="w-20 border border-gray-200 rounded px-2 py-1 bg-gray-50" />
                          </td>
                          <td className="py-1 px-2">
                            <input readOnly value={line.man_hours_minutes} className="w-24 border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                          </td>
                          <td className="py-1 px-2">
                            <input readOnly value={line.smv_per_pair} className="w-16 border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                          </td>
                          <td className="py-1 px-1">
                            <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 1} className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-40">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-sm text-gray-600">Customer, Group, Leather, and Color are filled from Production Routing when you select a Style.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
                  <Save className="h-4 w-4" />{loading ? 'Saving...' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplatePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Production Planning Template Preview</h3>
              <button onClick={() => setShowTemplatePreview(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
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
                      new Date().toISOString().split('T')[0],
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
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTemplatePreview(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={downloadPlanningTemplate}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




