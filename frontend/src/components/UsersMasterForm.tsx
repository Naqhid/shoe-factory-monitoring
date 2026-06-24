import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Plus, Edit, Trash2, X, Download, Loader2, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';

interface UserRecord {
  id: number;
  code: string;
  name: string;
  role: string;
  work_centre_id?: number;
  work_centre_code?: string;
  work_centre_name?: string;
  machine_id?: string;
}

interface RoleOption {
  id?: number;
  role_name: string;
}

export const UsersMasterForm: React.FC = () => {
  const [records, setRecords] = React.useState<UserRecord[]>([]);
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<UserRecord | null>(null);
  const [formData, setFormData] = React.useState({
    code: '',
    name: '',
    password: '',
    role: 'Admin',
    work_centre_id: '',
    machine_id: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [fetchLoading, setFetchLoading] = React.useState(false);
  const [workCentres, setWorkCentres] = React.useState<UserRecord[]>([]);
  const [machineCentres, setMachineCentres] = React.useState<any[]>([]);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('');
  const [styleFilter, setStyleFilter] = React.useState('');
  const [stylesList, setStylesList] = React.useState<{ id: number; code: string; name: string }[]>([]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchRecords = async () => {
    setFetchLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (roleFilter) params.set('role', roleFilter);
      if (styleFilter) params.set('style_id', styleFilter);
      const response = await apiFetch(`${API_BASE}/api/masters/users?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
        if (result.pagination) {
          setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchWorkCentres = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/work_centres`);
      const result = await response.json();
      if (result.success) {
        setWorkCentres(result.data);
      }
    } catch (error) {
      console.error('Error fetching work centres:', error);
    }
  };

  const fetchMachineCentres = async (workCentreId?: string) => {
    if (!workCentreId) { setMachineCentres([]); return; }
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/machine_centres?limit=1000&work_centre_id=${workCentreId}`);
      const result = await response.json();
      if (result.success) {
        setMachineCentres(result.data);
      }
    } catch (error) {
      console.error('Error fetching machine centres:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/api/roles`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setRoles(data);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const defaultRole = React.useMemo(() => {
    return roles.find((r) => r.role_name === 'Admin')?.role_name || roles[0]?.role_name || 'Admin';
  }, [roles]);

  const fetchStyles = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/styles?limit=1000`);
      const result = await response.json();
      if (result.success) setStylesList(result.data || []);
    } catch (error) {
      console.error('Error fetching styles:', error);
    }
  };

  React.useEffect(() => {
    fetchWorkCentres();
    fetchMachineCentres();
    fetchRoles();
    fetchStyles();
  }, []);

  React.useEffect(() => {
    fetchRecords();
  }, [currentPage, itemsPerPage, debouncedSearch, roleFilter, styleFilter]);

  const handleRefresh = async () => {
    await fetchRecords();
    await fetchWorkCentres();
    await fetchMachineCentres();
    await fetchRoles();
  };

  const filteredMachines = machineCentres;

  const resetForm = () => {
    setFormData({ code: '', name: '', password: '', role: defaultRole, work_centre_id: '', machine_id: '' });
    setEditingRecord(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Login and name are required');
      return;
    }

    setLoading(true);
    try {
      const url = editingRecord
        ? `${API_BASE}/api/masters/users/${editingRecord.id}`
        : `${API_BASE}/api/masters/users`;

      const method = editingRecord ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(editingRecord ? 'User updated' : 'User created');
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

  const handleEdit = (record: UserRecord) => {
    setEditingRecord(record);
    setFormData({
      code: record.code,
      name: record.name,
      password: '', // Don't populate password for security
      role: record.role,
      work_centre_id: record.work_centre_id?.toString() || '',
      machine_id: record.machine_id || ''
    });
    // Fetch machine centres for the user's work centre so the dropdown is populated
    if (record.work_centre_id) {
      fetchMachineCentres(record.work_centre_id.toString());
    }
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteId(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/users/${deleteId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('User deleted');
        fetchRecords();
      } else {
        toast.error(result.error || 'Delete failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleExportToExcel = () => {
    if (records.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = records.map(record => ({
      'Login': record.code,
      'Name': record.name,
      'Role': record.role,
      'Work Centre Code': record.work_centre_code || '',
      'Work Centre Name': record.work_centre_name || '',
      'Machine ID': record.machine_id || '',
    
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users Master');

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Users_Master_${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
    toast.success('Exported successfully');
  };

  return (
    <div className="p-4 sm:p-6">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
      
      <header className="bg-white border-b border-gray-200 px-4 py-3 mb-6 pl-12 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Users Master</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users..."
                className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setStyleFilter(''); setCurrentPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.id ?? r.role_name} value={r.role_name}>{r.role_name}</option>
              ))}
            </select>
            {roleFilter && roleFilter.toLowerCase().includes('machine') && (
              <select
                value={styleFilter}
                onChange={(e) => { setStyleFilter(e.target.value); setCurrentPage(1); }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Articles</option>
                {stylesList.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={fetchLoading}
              title="Reload from server"
              className="bg-slate-100 text-slate-700 border border-slate-200 px-3 sm:px-4 py-2 rounded-md hover:bg-slate-200 flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${fetchLoading ? 'animate-spin' : ''}`} />
              <span className="sm:inline hidden">Refresh</span>
            </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingRecord ? 'Edit' : 'Add'} User
              </h2>
              <button onClick={resetForm}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login (Code) *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingRecord ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editingRecord}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {roles.length === 0 ? (
                    <option value={formData.role}>{formData.role || 'Loading roles…'}</option>
                  ) : (
                    roles.map((role) => (
                      <option key={role.id ?? role.role_name} value={role.role_name}>
                        {role.role_name}
                      </option>
                    ))
                  )}
                  {formData.role && !roles.some((r) => r.role_name === formData.role) && (
                    <option value={formData.role}>{formData.role}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Centre
                </label>
                <select
                  value={formData.work_centre_id}
                  onChange={(e) => { setFormData({ ...formData, work_centre_id: e.target.value, machine_id: '' }); fetchMachineCentres(e.target.value); }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Work Centre</option>
                  {workCentres.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.code} - {wc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Machine Centre
                </label>
                <select
                  value={formData.machine_id}
                  onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {machineCentres.map((machine) => (
                    <option key={machine.id} value={machine.machine_id}>
                      {machine.machine_id} - {machine.machine_name || machine.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex-1"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 flex-1"
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
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Login
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Work Centre
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Machine ID
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.code}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.name}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {record.role}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.work_centre_code ? `${record.work_centre_code} - ${record.work_centre_name}` : 'N/A'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.machine_id || 'N/A'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(record)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {records.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {debouncedSearch ? 'No matching users found' : 'No users found'}
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

