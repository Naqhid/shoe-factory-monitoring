import React from 'react';
import { Plus, Trash2, Save, RefreshCw, Edit, X, RotateCcw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';
import * as XLSX from 'xlsx';

interface MasterOption {
  id: number;
  code: string;
  name: string;
  machine_id?: string;
  machine_name?: string;
}

// Searchable dropdown component
const SearchableSelect: React.FC<{
  value: string;
  options: MasterOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabledValues?: string[];
}> = ({ value, options, onChange, placeholder = 'Select', disabledValues = [] }) => {
  const [search, setSearch] = React.useState('');
  const getOptionValue = (o: MasterOption) => o.machine_id || String(o.id);

  const getLabel = (o: MasterOption) =>
    o.machine_id ? `${o.machine_id} - ${o.machine_name ?? o.name}` : (o.machine_name ?? o.name);

  const filtered = options.filter(o =>
    getLabel(o).toLowerCase().includes(search.toLowerCase()) ||
    o.machine_id?.toLowerCase().includes(search.toLowerCase()) ||
    (o.machine_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find(o => getOptionValue(o) === value);

  return (
    <div className="flex flex-col min-w-[190px] rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white">
      {/* Search input */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search machine..."
          className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 focus:outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {/* Dropdown */}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-2 py-1 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 cursor-pointer"
        size={Math.min(5, Math.max(2, filtered.length + 1))}
      >
        <option value="" className="text-gray-400">{placeholder}</option>
        {filtered.map(opt => (
          <option
            key={opt.id}
            value={opt.machine_id || String(opt.id)}
            className="py-1"
            disabled={disabledValues.includes(getOptionValue(opt))}
          >
            {getLabel(opt)}
          </option>
        ))}
      </select>
      {/* Selected badge */}
      {selected && (
        <div className="px-2 py-1 bg-blue-50 border-t border-blue-100 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          <span className="text-xs text-blue-700 font-medium truncate">{getLabel(selected)}</span>
        </div>
      )}
      {filtered.length === 0 && (
        <div className="px-2 py-2 text-xs text-gray-400 text-center">No results</div>
      )}
    </div>
  );
};

interface RoutingLine {
  machine_centre_id: string;
  machine_name: string;
  process: string;
  observed_time: string;
  rating_factor: string;
  manpower: string;
}

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

  const [lines, setLines] = React.useState<RoutingLine[]>([{
    machine_centre_id: '', machine_name: '', process: '', observed_time: '', rating_factor: '', manpower: '',
  }]);

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

  const calculateLineValues = (line: RoutingLine) => {
    const observedTime = parseFloat(line.observed_time) || 0;
    const ratingFactor = parseFloat(line.rating_factor) || 0;
    const targetPerDay = parseFloat(headerData.target_per_day) || 0;

    const normalTimeSecs = (observedTime * ratingFactor) / 100;
    const stdTimeSecs = normalTimeSecs * 1.15;
    const mins12Prs = Math.round(((stdTimeSecs * 12) / 60) * 10) / 10;
    const pairsPerHr = stdTimeSecs > 0 ? Math.round(targetPerDay / stdTimeSecs) : 0;
    const pairsPerDay = pairsPerHr * 8;
    const manpower = line.manpower ? (Math.round(parseFloat(line.manpower) * 10) / 10) : 0;

    return { normal_time_secs_pr: Math.round(normalTimeSecs), std_time_secs_pr: Math.round(stdTimeSecs), mins_12_prs_box: mins12Prs, pairs_per_hr: pairsPerHr, pairs_per_day: pairsPerDay, manpower };
  };

  const addLine = () => setLines([...lines, { machine_centre_id: '', machine_name: '', process: '', observed_time: '', rating_factor: '', manpower: '' }]);
  const removeLine = (index: number) => lines.length > 1 ? setLines(lines.filter((_, i) => i !== index)) : toast.error('At least one line required');
  const updateLine = (index: number, field: keyof RoutingLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleAdd = () => {
    setEditingId(null);
    setHeaderData({ customer_id: '', group_id: '', leather_id: '', style_id: '', color_id: '', created_on: new Date().toISOString().split('T')[0], machine_centre_id: '', target_per_day: '', tot_smv: '' });
    setLines([{ machine_centre_id: '', machine_name: '', process: '', observed_time: '', rating_factor: '', manpower: '' }]);
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
          leather_id: String(header.leather_id),
          style_id: String(header.style_id),
          color_id: String(header.color_id),
          created_on: header.created_on ? new Date(header.created_on).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          target_per_day: String(header.target_per_day),
          tot_smv: String(header.tot_smv)
        });
        setLines(result.data.lines.map((l: any) => ({ machine_centre_id: String(l.machine_centre_id), machine_name: l.machine_name || '', process: l.process || '', observed_time: String(l.observed_time), rating_factor: String(l.rating_factor), manpower: String(l.manpower) })));
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
    if (lines.some(l => !l.machine_centre_id || !l.observed_time || !l.rating_factor || !l.manpower)) {
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
        lines: lines.map(line => ({ machine_centre_id: line.machine_centre_id, process: line.process || null, observed_time: parseFloat(line.observed_time), rating_factor: parseFloat(line.rating_factor), manpower: parseFloat(line.manpower) })),
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
        const leatherId = resolveMasterId(leathers, leatherRaw);
        const styleId = resolveMasterId(styles, styleRaw);
        const colorId = resolveMasterId(colors, colorRaw);
        const machineId = resolveMachineId(machineRaw);

        if (!customerId || !groupId || !leatherId || !styleId || !colorId) {
          throw new Error(`Row ${idx + 2}: invalid customer/group/leather/style/color mapping`);
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
          leather_id: leatherId,
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
    <div className="p-6">
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
      
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Production Routing</h1>
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by style, customer, color, target..."
              className="w-full md:w-72 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
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
            <button onClick={fetchRoutings} disabled={refreshing} className="text-sm text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50">
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
              title="Upload first sheet with columns: customer/group/leather/style/color,target_per_day,tot_smv,machine_id,process,observed_time,rating_factor,manpower"
            >
              {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Style</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target/Day</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total SMV</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Lines</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created On</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Record</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {routings.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-sm">{r.customer_name}</td>
                  <td className="px-4 py-2 text-sm">{r.style_name}</td>
                  <td className="px-4 py-2 text-sm">{r.color_name}</td>
                  <td className="px-4 py-2 text-sm">{r.target_per_day}</td>
                  <td className="px-4 py-2 text-sm font-mono">{r.tot_smv}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.line_count > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {r.line_count} {r.line_count === 1 ? 'machine' : 'machines'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">{new Date(r.created_on).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-sm">
                    {r.is_deleted ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Deleted</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="flex gap-2">
                      {r.is_deleted ? (
                        <button onClick={() => setRestoreId(r.id)} className="text-emerald-600 hover:text-emerald-900" title="Restore">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(r.id)} className="text-blue-600 hover:text-blue-900" title="Edit">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-900" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {routings.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No routing records found</td>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0">
          <div className="bg-white rounded-lg w-full h-full max-h-screen overflow-y-auto" style={{ maxWidth: '100vw', maxHeight: '100vh' }}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Production Routing</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Header Information</h3>
                  <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">One routing covers all machines for this style</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer <span className="text-red-500">*</span></label>
                    <select value={headerData.customer_id} onChange={(e) => setHeaderData({ ...headerData, customer_id: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required>
                      <option value="">Select Customer</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group <span className="text-red-500">*</span></label>
                    <select value={headerData.group_id} onChange={(e) => setHeaderData({ ...headerData, group_id: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required>
                      <option value="">Select Group</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leather <span className="text-red-500">*</span></label>
                    <select value={headerData.leather_id} onChange={(e) => setHeaderData({ ...headerData, leather_id: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required>
                      <option value="">Select Leather</option>
                      {leathers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Style <span className="text-red-500">*</span></label>
                    <select value={headerData.style_id} onChange={(e) => setHeaderData({ ...headerData, style_id: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required>
                      <option value="">Select Style</option>
                      {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color <span className="text-red-500">*</span></label>
                    <select value={headerData.color_id} onChange={(e) => setHeaderData({ ...headerData, color_id: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required>
                      <option value="">Select Color</option>
                      {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created On <span className="text-red-500">*</span></label>
                    <input type="date" value={headerData.created_on} onChange={(e) => setHeaderData({ ...headerData, created_on: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target per Day <span className="text-red-500">*</span></label>
                    <input type="number" min="1" step="1" value={headerData.target_per_day} onChange={(e) => setHeaderData({ ...headerData, target_per_day: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target per Hour</label>
                    <input type="text" value={targetPerHour} readOnly className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total SMV <span className="text-red-500">*</span></label>
                    <input type="number" min="0.0001" step="0.0001" value={headerData.tot_smv} onChange={(e) => setHeaderData({ ...headerData, tot_smv: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" required />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Machine Routing Lines</h3>
                  <button type="button" onClick={addLine} className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center gap-1 text-sm">
                    <Plus className="h-4 w-4" />Add Machine
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Machine Centre</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Observed Time</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating Factor %</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Normal Time</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Std Time</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mins 12 prs</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pairs/hr</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pairs/day</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Manpower</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lines.map((line, index) => {
                        const calc = calculateLineValues(line);
                        return (
                          <tr key={index}>
                            <td className="px-2 py-2">
                              <SearchableSelect
                                value={line.machine_centre_id}
                                options={machineCentres}
                                onChange={(val) => updateLine(index, 'machine_centre_id', val)}
                                placeholder="Select Machine"
                                disabledValues={lines
                                  .filter((_, i) => i !== index)
                                  .map((l) => l.machine_centre_id)
                                  .filter(Boolean)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" min="0.01" step="0.01" value={line.observed_time} onChange={(e) => updateLine(index, 'observed_time', e.target.value)} className="w-20 border border-gray-300 rounded px-2 py-1" required />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" min="0.01" max="200" step="0.01" value={line.rating_factor} onChange={(e) => updateLine(index, 'rating_factor', e.target.value)} className="w-20 border border-gray-300 rounded px-2 py-1" required />
                            </td>
                            <td className="px-2 py-2 text-gray-700">{calc.normal_time_secs_pr}</td>
                            <td className="px-2 py-2 text-gray-700">{calc.std_time_secs_pr}</td>
                            <td className="px-2 py-2 text-gray-700">{calc.mins_12_prs_box.toFixed(1)}</td>
                            <td className="px-2 py-2 text-gray-700">{calc.pairs_per_hr}</td>
                            <td className="px-2 py-2 text-gray-700">{calc.pairs_per_day}</td>
                            <td className="px-2 py-2">
                              <input type="number" min="0.1" step="0.1" value={line.manpower} onChange={(e) => updateLine(index, 'manpower', e.target.value)} className="w-20 border border-gray-300 rounded px-2 py-1" required />
                            </td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => removeLine(index)} className="text-red-600 hover:text-red-900">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
                  <Save className="h-4 w-4" />{loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplatePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Production Routing Template Preview</h3>
              <button onClick={() => setShowTemplatePreview(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
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
                onClick={downloadRoutingTemplate}
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
