import React from 'react';
import { Plus, Edit, Trash2, X, Download, Loader2, Search, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';

interface MasterRecord {
  id: number;
  code: string;
  name: string;
  machine_id?: string;
  machine_name?: string;
  work_centre_id?: number;
  work_centre_name?: string;
}

interface MasterFormProps {
  title: string;
  table: string;
}

const ARCHIVE_TABLES = ['customers', 'groups_master', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres'];
const USAGE_CHECK_TABLES = ['groups_master', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres'];

export const MasterForm: React.FC<MasterFormProps> = ({ title, table }) => {
  const [records, setRecords] = React.useState<MasterRecord[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<MasterRecord | null>(null);
  const [formData, setFormData] = React.useState({ code: '', name: '', machine_id: '', machine_name: '', work_centre_id: '' });
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
    if (table !== 'machine_centres') return;
    apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`)
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setWorkCentres(result.data || []);
      })
      .catch(() => {});
  }, [table]);

  const fetchRecords = async () => {
    setFetchLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
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
  }, [currentPage, itemsPerPage, table, debouncedSearch, showArchived]);

  const resetForm = () => {
    setFormData({ code: '', name: '', machine_id: '', machine_name: '', work_centre_id: '' });
    setEditingRecord(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Code and name are required');
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
      work_centre_id: record.work_centre_id ? String(record.work_centre_id) : ''
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
    <div className="p-6">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title={isArchiveTable ? `Archive ${archiveLabel}` : 'Delete Record'}
        message={deleteMessage}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={deleteConfirmText}
      />
      <header className="sticky top-0 bg-white shadow-sm border-b border-gray-200 px-4 py-3 z-40 mb-6 pl-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {isArchiveTable && (
              <button
                onClick={() => setShowArchived((prev) => !prev)}
                className={`px-3 sm:px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm sm:text-base ${
                  showArchived ? 'bg-slate-700 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {showArchived ? 'Hide Archived' : 'Show Archived'}
              </button>
            )}
            <button
              onClick={handleExportToExcel}
              className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Download className="h-4 w-4" />
              <span className="sm:inline hidden">Export to Excel</span>
              <span className="sm:hidden">Export</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus className="h-4 w-4" />
              <span className="sm:inline hidden">Add New</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingRecord ? 'Edit' : 'Add'} {title}
              </h2>
              <button onClick={resetForm}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {table === 'machine_centres' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Centre
                  </label>
                  <select
                    value={formData.work_centre_id}
                    onChange={(e) => setFormData({ ...formData, work_centre_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Work Centre</option>
                    {workCentres.map((wc) => (
                      <option key={wc.id} value={wc.id}>{wc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {table === 'machine_centres' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Machine ID
                  </label>
                  <input
                    type="text"
                    value={formData.machine_id}
                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={editingRecord !== null}
                    placeholder={editingRecord ? "Machine ID cannot be changed" : "Enter machine ID"}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {title} Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {table !== 'machine_centres' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {title} Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {table === 'machine_centres' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Process Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, machine_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Eyelet Attaching"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow">
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 text-lg">Loading data...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {table === 'machine_centres' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Machine ID
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                {table !== 'machine_centres' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                )}
                {table === 'machine_centres' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Process Name
                  </th>
                )}
                {table === 'machine_centres' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Centre
                  </th>
                )}
                {isArchiveTable && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id}>
                  {table === 'machine_centres' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.machine_id || 'N/A'}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.code}
                  </td>
                  {table !== 'machine_centres' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.name}
                    </td>
                  )}
                  {table === 'machine_centres' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.machine_name || 'N/A'}
                    </td>
                  )}
                  {table === 'machine_centres' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.work_centre_name || 'N/A'}
                    </td>
                  )}
                  {isArchiveTable && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isArchivedRecord(record) ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Archived</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Active</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {isArchiveTable && isArchivedRecord(record) ? (
                      <button
                        onClick={() => handleRestore(record.id)}
                        className="text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-4 w-4" /> Restore
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(record)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {records.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {debouncedSearch ? 'No matching records found' : 'No records found'}
          </div>
        )}

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
          </>
        )}
      </div>
    </div>
  );
};


