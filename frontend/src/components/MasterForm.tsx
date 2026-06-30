import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, X, Download, Loader2, Search, RotateCcw, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';
import { getEffectiveRole } from '../utils/roleConfig';

interface MasterRecord {
  id: number;
  code: string;
  name: string;
  machine_id?: string;
  machine_name?: string;
  work_centre_id?: number;
  work_centre_name?: string;
  machine_centre_id?: number;
  machine_centre_name?: string;
  input_machine_id?: string | null;
  eol_machine_id?: string | null;
  input_machine_label?: string | null;
  eol_machine_label?: string | null;
}

interface MasterFormProps {
  title: string;
  table: string;
}

const ARCHIVE_TABLES = ['customers', 'groups_master', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees'];
const USAGE_CHECK_TABLES = ['groups_master', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees'];

export const MasterForm: React.FC<MasterFormProps> = ({ title, table }) => {
  const navigate = useNavigate();
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const effectiveRole = getEffectiveRole(userInfo);
  const canCreate = !(table === 'work_centres' && effectiveRole === 'Project Monitor');
  const [records, setRecords] = React.useState<MasterRecord[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<MasterRecord | null>(null);
  const [formData, setFormData] = React.useState({
    code: '',
    name: '',
    machine_id: '',
    machine_name: '',
    work_centre_id: '',
    machine_centre_id: '',
    input_machine_id: '',
    eol_machine_id: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [fetchLoading, setFetchLoading] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [showArchived, setShowArchived] = React.useState(false);
  const [deleteMessage, setDeleteMessage] = React.useState('Are you sure you want to delete this record? This action cannot be undone.');
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('Delete');
  const [deleteBlocked, setDeleteBlocked] = React.useState(false);
  const [workCentres, setWorkCentres] = React.useState<Array<{ id: number; name: string }>>([]);
  const [machineCentres, setMachineCentres] = React.useState<Array<{ id: number; name: string; machine_id?: string; work_centre_id?: number }>>([]);
  const [styles, setStyles] = React.useState<Array<{ id: number; code: string; name: string }>>([]);
  const [selectedStyleId, setSelectedStyleId] = React.useState('');
  const isArchiveTable = ARCHIVE_TABLES.includes(table);
  const needsUsageCheck = USAGE_CHECK_TABLES.includes(table);
  const archiveLabel = title || 'Record';
  const isArchivedRecord = (record: any) => Boolean(
    record?.deleted_at ||
    record?.is_active === 0 ||
    record?.active === 0 ||
    record?.is_deleted === 1
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    if (table !== 'machine_centres' && table !== 'employees' && table !== 'work_centres') return;
    apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`)
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setWorkCentres(result.data || []);
      })
      .catch(() => {});
    apiFetch(`${API_BASE}/api/masters/machine_centres?limit=500`)
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setMachineCentres(result.data || []);
      })
      .catch(() => {});
    if (table === 'machine_centres') {
      apiFetch(`${API_BASE}/api/masters/styles?limit=500`)
        .then((r) => r.json())
        .then((result) => {
          if (result.success) setStyles(result.data || []);
        })
        .catch(() => {});
    }
  }, [table]);

  const lineMachineOptions = React.useMemo(() => {
    if (table !== 'work_centres' || !editingRecord?.id) return [];
    return machineCentres.filter(
      (mc) => Number(mc.work_centre_id) === Number(editingRecord.id)
    );
  }, [table, editingRecord?.id, machineCentres]);

  const fetchRecords = async () => {
    setFetchLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (table === 'machine_centres' && selectedStyleId) params.set('styleId', selectedStyleId);
      if (isArchiveTable && showArchived) params.set('includeArchived', 'true');
      const response = await apiFetch(`${API_BASE}/api/masters/${table}?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
        if (result.pagination) {
          setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
        }
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setFetchLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRecords();
  }, [currentPage, itemsPerPage, table, debouncedSearch, showArchived, selectedStyleId]);

  const resetForm = () => {
    setFormData({ code: '', name: '', machine_id: '', machine_name: '', work_centre_id: '', machine_centre_id: '', input_machine_id: '', eol_machine_id: '' });
    setEditingRecord(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Code and name are required');
      return;
    }
    if (table === 'machine_centres' && !formData.machine_id.trim()) {
      toast.error('Machine ID is required');
      return;
    }
    if (table === 'work_centres' && formData.input_machine_id && formData.eol_machine_id
      && formData.input_machine_id === formData.eol_machine_id) {
      toast.error('Input machine and EOL machine must be different');
      return;
    }

    setLoading(true);
    try {
      const url = editingRecord
        ? `${API_BASE}/api/masters/${table}/${editingRecord.id}`
        : `${API_BASE}/api/masters/${table}`;

      const method = editingRecord ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          work_centre_id: formData.work_centre_id ? Number(formData.work_centre_id) : null,
          machine_centre_id: formData.machine_centre_id ? Number(formData.machine_centre_id) : null,
          input_machine_id: formData.input_machine_id || null,
          eol_machine_id: formData.eol_machine_id || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(editingRecord ? 'Record updated' : 'Record created');
        resetForm();
        fetchRecords();
      } else {
        toast.error(result.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: MasterRecord) => {
    setEditingRecord(record);
    setFormData({
      code: record.code,
      name: record.name,
      machine_id: record.machine_id || '',
      machine_name: record.machine_name || '',
      work_centre_id: record.work_centre_id ? String(record.work_centre_id) : '',
      machine_centre_id: record.machine_centre_id ? String(record.machine_centre_id) : '',
      input_machine_id: record.input_machine_id || '',
      eol_machine_id: record.eol_machine_id || '',
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!isArchiveTable) {
      setDeleteBlocked(false);
      setDeleteConfirmText('Delete');
      setDeleteMessage('Are you sure you want to delete this record? This action cannot be undone.');
      setDeleteId(id);
      return;
    }

    setDeleteBlocked(false);
    setDeleteConfirmText('Archive');
    setDeleteMessage('Checking usage impact...');
    setDeleteId(id);

    if (!needsUsageCheck) {
      setDeleteMessage(`This ${archiveLabel.toLowerCase()} will be archived and can be restored later.`);
      return;
    }

    apiFetch(`${API_BASE}/api/masters/${table}/${id}/usage`)
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) {
          setDeleteBlocked(false);
          setDeleteConfirmText('Archive');
          setDeleteMessage(`Unable to verify usage. ${archiveLabel} will be archived if you continue.`);
          return;
        }
        const usage = result.data;
        if (usage.total > 0) {
          const detailText = (usage.details || [])
            .filter((d: any) => Number(d.count) > 0)
            .map((d: any) => `${d.label}: ${d.count}`)
            .join(', ');
          setDeleteBlocked(true);
          setDeleteConfirmText('OK');
          setDeleteMessage(`Cannot archive/delete this ${archiveLabel.toLowerCase()} because it is in use (${detailText}).`);
        } else {
          setDeleteBlocked(false);
          setDeleteConfirmText('Archive');
          setDeleteMessage(`This ${archiveLabel.toLowerCase()} has no dependencies. It will be archived and can be restored later.`);
        }
      })
      .catch(() => {
        setDeleteBlocked(false);
        setDeleteConfirmText('Archive');
        setDeleteMessage(`Unable to verify usage. ${archiveLabel} will be archived if you continue.`);
      });
  };

  const confirmDelete = async () => {
    if (deleteBlocked) {
      setDeleteId(null);
      return;
    }
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);

    try {
      const response = await apiFetch(`${API_BASE}/api/masters/${table}/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success(isArchiveTable ? 'Record archived' : 'Record deleted');
        fetchRecords();
      } else {
        toast.error(result.error || 'Delete failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/${table}/${id}/restore`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast.success('Record restored');
        fetchRecords();
      } else {
        toast.error(result.error || 'Restore failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleExportToExcel = () => {
    if (records.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Prepare data for export
    const exportData = records.map(record => {
      const row: any = {};

      if (table === 'machine_centres' && record.machine_id) {
        row['Machine ID'] = record.machine_id;
        row['Work Centre'] = record.work_centre_name || '';
      }

      row.Code = record.code;
      row.Name = record.name;

      return row;
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${title}_Master_${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
    toast.success('Exported successfully');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title={isArchiveTable ? `Archive ${archiveLabel}` : 'Delete Record'}
        message={deleteMessage}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={deleteConfirmText}
      />

      {/* Enhanced Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-900/5 mb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage {title.toLowerCase()} master records</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
              />
            </div>
            {table === 'machine_centres' && (
              <select
                value={selectedStyleId}
                onChange={(e) => { setSelectedStyleId(e.target.value); setCurrentPage(1); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 bg-white"
              >
                <option value="">All articles</option>
                {styles.map((style) => (
                  <option key={style.id} value={String(style.id)}>{style.code} - {style.name}</option>
                ))}
              </select>
            )}
            {isArchiveTable && (
              <button
                onClick={() => setShowArchived((prev) => !prev)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  showArchived ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {showArchived ? 'Hide Archived' : 'Show Archived'}
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchRecords()}
              disabled={fetchLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${fetchLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm ${!canCreate ? 'hidden' : ''}`}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Form Modal — Enhanced */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ring-1 ring-black/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  {editingRecord ? 'Edit record' : 'New record'}
                </p>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingRecord ? 'Edit' : 'Add'} {title}
                </h2>
              </div>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-gray-100 transition">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {(table === 'machine_centres' || table === 'employees') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Work Centre <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={formData.work_centre_id}
                    onChange={(e) => setFormData({ ...formData, work_centre_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                  >
                    <option value="">No work centre</option>
                    {workCentres.map((wc) => (
                      <option key={wc.id} value={wc.id}>{wc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {table === 'employees' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Machine Centre <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={formData.machine_centre_id}
                    onChange={(e) => setFormData({ ...formData, machine_centre_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                  >
                    <option value="">No fixed machine</option>
                    {machineCentres
                      .filter((mc) => !formData.work_centre_id || String(mc.work_centre_id || '') === String(formData.work_centre_id))
                      .map((mc) => (
                        <option key={mc.id} value={mc.id}>{mc.name}</option>
                      ))}
                  </select>
                </div>
              )}

              {table === 'machine_centres' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Machine ID *</label>
                  <input
                    type="text"
                    value={formData.machine_id}
                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                    placeholder="e.g., 01"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{title} Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                  required
                />
              </div>

              {table !== 'machine_centres' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{title} Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                    required
                  />
                </div>
              )}

              {table === 'machine_centres' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Process Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, machine_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                    placeholder="e.g., Eyelet Attaching"
                    required
                  />
                </div>
              )}

              {table === 'work_centres' && editingRecord && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Input machine</label>
                    <select
                      value={formData.input_machine_id}
                      onChange={(e) => setFormData({ ...formData, input_machine_id: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                    >
                      <option value="">Auto-detect</option>
                      {lineMachineOptions.map((mc) => (
                        <option key={mc.id} value={mc.machine_id || ''}>{mc.machine_id} — {mc.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Feeds WIP input and TV dashboard Input %.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">EOL machine (line output)</label>
                    <select
                      value={formData.eol_machine_id}
                      onChange={(e) => setFormData({ ...formData, eol_machine_id: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                    >
                      <option value="">Auto-detect</option>
                      {lineMachineOptions.map((mc) => (
                        <option key={`eol-${mc.id}`} value={mc.machine_id || ''}>{mc.machine_id} — {mc.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Used for Output %, hourly chart, and pacing.</p>
                  </div>
                </>
              )}

              {table === 'work_centres' && !editingRecord && (
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  Save the line first, add its machines, then edit to set Input and EOL machines.
                </p>
              )}

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition"
                >
                  {loading ? 'Saving...' : editingRecord ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hint banner for work_centres */}
      {table === 'work_centres' && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" /></svg>
          Edit a line to set Input and EOL machines. Click a row to open mobile production for that line.
        </div>
      )}

      {/* Records Table — Enhanced */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm ring-1 ring-black/[0.03] overflow-hidden">
        {fetchLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-500">Loading…</span>
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                {table === 'machine_centres' && (
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                    Machine ID
                  </th>
                )}
                <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                  Code
                </th>
                {table !== 'machine_centres' && (
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                    Name
                  </th>
                )}
                {table === 'work_centres' && (
                  <>
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                      Input machine
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                      EOL machine
                    </th>
                  </>
                )}
                {table === 'machine_centres' && (
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                    Process Name
                  </th>
                )}
                {table === 'machine_centres' && (
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                    Work Centre
                  </th>
                )}
                {table === 'employees' && (
                  <>
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                      Work Centre
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                      Machine Centre
                    </th>
                  </>
                )}
                {isArchiveTable && (
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">
                    Status
                  </th>
                )}
                <th className="px-4 sm:px-6 py-3.5 text-right text-[11px] font-bold text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record, idx) => (
                <tr
                  key={record.id}
                  onClick={table === 'work_centres' && !isArchivedRecord(record) ? () => navigate(`/mobile?line=${encodeURIComponent(record.name)}`) : undefined}
                  className={[
                    idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/50',
                    table === 'work_centres' && !isArchivedRecord(record) ? 'cursor-pointer hover:bg-blue-100/60 transition-colors' : 'hover:bg-blue-50/60 transition-colors',
                  ].join(' ')}
                >
                  {table === 'machine_centres' && (
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {record.machine_id || 'N/A'}
                    </td>
                  )}
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm font-semibold text-blue-700">
                    {record.code}
                  </td>
                  {table !== 'machine_centres' && (
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-gray-800">
                      {record.name}
                    </td>
                  )}
                  {table === 'work_centres' && (
                    <>
                      <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-teal-600">
                        {record.input_machine_id
                          ? `${record.input_machine_id}${record.input_machine_label ? ` — ${record.input_machine_label}` : ''}`
                          : 'Auto'}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-violet-600">
                        {record.eol_machine_id
                          ? `${record.eol_machine_id}${record.eol_machine_label ? ` — ${record.eol_machine_label}` : ''}`
                          : 'Auto'}
                      </td>
                    </>
                  )}
                  {table === 'machine_centres' && (
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-emerald-700">
                      {record.machine_name || 'N/A'}
                    </td>
                  )}
                  {table === 'machine_centres' && (
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-amber-700">
                      {record.work_centre_name || 'N/A'}
                    </td>
                  )}
                  {table === 'employees' && (
                    <>
                      <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-teal-600">
                        {record.work_centre_name || 'N/A'}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-violet-600">
                        {record.machine_centre_name || 'N/A'}
                      </td>
                    </>
                  )}
                  {isArchiveTable && (
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm">
                      {isArchivedRecord(record) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold ring-1 ring-amber-200/60">Archived</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold ring-1 ring-emerald-200/60">Active</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 sm:px-6 py-3.5 text-right whitespace-nowrap">
                    {isArchiveTable && isArchivedRecord(record) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(record.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition ring-1 ring-emerald-200/60"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </button>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(record);
                          }}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(record.id);
                          }}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-100 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

            {/* Mobile card list — visible only on small screens */}
            <div className="sm:hidden p-3 space-y-2.5">
              {records.map((record) => {
                const archived = isArchivedRecord(record);
                return (
                  <div
                    key={record.id}
                    onClick={table === 'work_centres' && !archived ? () => navigate(`/mobile?line=${encodeURIComponent(record.name)}`) : undefined}
                    className={[
                      'rounded-xl border bg-white p-3.5 shadow-sm transition-all',
                      archived
                        ? 'border-amber-200/80 bg-amber-50/30 opacity-75'
                        : 'border-gray-200/80 hover:shadow-md active:scale-[0.99]',
                      table === 'work_centres' && !archived ? 'cursor-pointer' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: avatar + info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 text-xs font-bold ${
                          archived
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {record.code.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{record.code}</span>
                            {isArchiveTable && (
                              archived ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold ring-1 ring-amber-200/60">Archived</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200/60">Active</span>
                              )
                            )}
                          </div>
                          {table !== 'machine_centres' && (
                            <p className="text-[13px] text-gray-600 truncate mt-0.5">{record.name}</p>
                          )}
                          {table === 'machine_centres' && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                ID: {record.machine_id || 'N/A'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                                {record.machine_name || 'N/A'}
                              </span>
                              <span className="text-gray-400">{record.work_centre_name || 'No WC'}</span>
                            </div>
                          )}
                          {table === 'work_centres' && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                              <span>Input: <span className="font-medium text-gray-700">{record.input_machine_id || 'Auto'}</span></span>
                              <span>EOL: <span className="font-medium text-gray-700">{record.eol_machine_id || 'Auto'}</span></span>
                            </div>
                          )}
                          {table === 'employees' && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                              <span>WC: <span className="font-medium text-gray-700">{record.work_centre_name || 'N/A'}</span></span>
                              <span>MC: <span className="font-medium text-gray-700">{record.machine_centre_name || 'N/A'}</span></span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                        {isArchiveTable && archived ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(record.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(record);
                              }}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(record.id);
                              }}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 active:bg-red-100 transition"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

        {records.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">{debouncedSearch || selectedStyleId ? 'No matching records found' : 'No records found'}</p>
          </div>
        )}

        {pagination.total > 10 && (
        <div className="border-t border-gray-100 px-4 sm:px-5 py-3">
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
        )}
          </>
        )}
      </div>
    </div>
  );
};


