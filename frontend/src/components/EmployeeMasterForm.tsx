import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Plus, Edit, Trash2, X, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { API_BASE_URL as API_BASE } from '../services/api';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';

interface EmployeeRecord {
  id: number;
  code: string;
  name: string;
  work_centre_id?: number;
  work_centre_name?: string;
  machine_centre_id?: number;
  machine_centre_name?: string;
}

export const EmployeeMasterForm: React.FC = () => {
  const [records, setRecords] = React.useState<EmployeeRecord[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<EmployeeRecord | null>(null);
  const [formData, setFormData] = React.useState({
    code: '',
    name: '',
    work_centre_id: '',
    machine_centre_id: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [fetchLoading, setFetchLoading] = React.useState(false);
  const [workCentres, setWorkCentres] = React.useState<EmployeeRecord[]>([]);
  const [machineCentres, setMachineCentres] = React.useState<EmployeeRecord[]>([]);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  
  const { currentPage, setCurrentPage, paginatedData, totalPages, totalItems, itemsPerPage } = usePagination(records, 10);


  const fetchRecords = async () => {
    setFetchLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/masters/employees`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchWorkCentres = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/masters/work_centres`);
      const result = await response.json();
      if (result.success) {
        setWorkCentres(result.data);
      }
    } catch (error) {
      console.error('Error fetching work centres:', error);
    }
  };

  const fetchMachineCentres = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/masters/machine_centres`);
      const result = await response.json();
      if (result.success) {
        setMachineCentres(result.data);
      }
    } catch (error) {
      console.error('Error fetching machine centres:', error);
    }
  };

  React.useEffect(() => {
    fetchRecords();
    fetchWorkCentres();
    fetchMachineCentres();
  }, []);

  const resetForm = () => {
    setFormData({ code: '', name: '', work_centre_id: '', machine_centre_id: '' });
    setEditingRecord(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Employee ID and name are required');
      return;
    }

    setLoading(true);
    try {
      const url = editingRecord
        ? `${API_BASE}/api/masters/employees/${editingRecord.id}`
        : `${API_BASE}/api/masters/employees`;

      const method = editingRecord ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(editingRecord ? 'Employee updated' : 'Employee created');
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

  const handleEdit = (record: EmployeeRecord) => {
    setEditingRecord(record);
    setFormData({
      code: record.code,
      name: record.name,
      work_centre_id: record.work_centre_id?.toString() || '',
      machine_centre_id: record.machine_centre_id?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteId(null);
    try {
      const response = await fetch(`${API_BASE}/api/masters/employees/${deleteId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Employee deleted');
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
      'Employee ID': record.code,
      'Employee Name': record.name,
      'Work Centre': record.work_centre_name || '',
      'Machine Centre': record.machine_centre_name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees Master');

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Employees_Master_${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
    toast.success('Exported successfully');
  };

  return (
    <div className="p-6">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Employee"
        message="Are you sure you want to delete this employee? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
      
      <header className="sticky top-0 bg-white shadow-sm border-b border-gray-200 px-4 py-3 z-40 mb-6 pl-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Employees Master</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
                {editingRecord ? 'Edit' : 'Add'} Employee
              </h2>
              <button onClick={resetForm}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID *
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
                  Employee Name *
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
                  Work Centre
                </label>
                <select
                  value={formData.work_centre_id}
                  onChange={(e) => setFormData({ ...formData, work_centre_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Work Centre</option>
                  {workCentres.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Machine Centre
                </label>
                <select
                  value={formData.machine_centre_id}
                  onChange={(e) => setFormData({ ...formData, machine_centre_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Machine Centre</option>
                  {machineCentres.map((mc) => (
                    <option key={mc.id} value={mc.id}>
                      {mc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 text-lg">Loading data...</span>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Work Centre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Machine Centre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((record) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {record.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.work_centre_name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.machine_centre_name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {records.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No employees found
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
          </>
        )}
      </div>
    </div>
  );
};
