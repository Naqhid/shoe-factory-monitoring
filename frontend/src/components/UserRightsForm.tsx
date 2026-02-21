
import React from 'react';
import { Save, Plus, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { API_BASE_URL as API_BASE } from '../services/api';

interface UserOption {
  id: number;
  code: string;
  name: string;
}

interface FormOption {
  id: number;
  code: string;
  name: string;
}

interface LineItem {
  form_id: string;
  form_name: string;
  read_permission: boolean;
  write_permission: boolean;
}

interface UserRightRecord {
  id: number;
  user_id: number;
  user_name: string;
  user_code: string;
  form_id: number;
  form_name: string;
  form_code: string;
  read_permission: boolean;
  write_permission: boolean;
}

const emptyLine = (): LineItem => ({
  form_id: '',
  form_name: '',
  read_permission: false,
  write_permission: false,
});

export const UserRightsForm: React.FC = () => {
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [forms, setForms] = React.useState<FormOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [existingRecords, setExistingRecords] = React.useState<UserRightRecord[]>([]);

  // Header
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [selectedUserCode, setSelectedUserCode] = React.useState('');

  // Line items
  const [lines, setLines] = React.useState<LineItem[]>([emptyLine()]);


  // Fetch users and forms on mount
  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/masters/users`);
        const result = await response.json();
        if (result.success) setUsers(result.data);
      } catch (error) {
        toast.error('Error loading users');
        console.error(error);
      }
    };

    const fetchForms = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/masters/forms_master`);
        const result = await response.json();
        if (result.success) setForms(result.data);
      } catch (error) {
        toast.error('Error loading forms');
        console.error(error);
      }
    };

    const fetchExistingRecords = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/user-rights`);
        const result = await response.json();
        if (result.success) setExistingRecords(result.data);
      } catch (error) {
        console.error('Error loading existing records:', error);
      }
    };

    fetchUsers();
    fetchForms();
    fetchExistingRecords();
  }, []);

  // When user is selected, populate User ID and load existing rights
  const handleUserChange = async (userId: string) => {
    setSelectedUserId(userId);

    if (!userId) {
      setSelectedUserCode('');
      setLines([emptyLine()]);
      return;
    }

    const user = users.find(u => u.id === parseInt(userId));
    setSelectedUserCode(user?.code || '');

    // Load existing rights for this user
    try {
      const response = await fetch(`${API_BASE}/api/user-rights/user/${userId}`);
      const result = await response.json();
      if (result.success && result.data.length > 0) {
        const existingLines: LineItem[] = result.data.map((r: UserRightRecord) => ({
          form_id: String(r.form_id),
          form_name: r.form_name,
          read_permission: r.read_permission,
          write_permission: r.write_permission,
        }));
        setLines(existingLines.length > 0 ? existingLines : [emptyLine()]);
      } else {
        setLines([emptyLine()]);
      }
    } catch (error) {
      console.error('Error loading user rights:', error);
      setLines([emptyLine()]);
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

  const handleFormChange = (idx: number, formId: string) => {
    const form = forms.find(f => f.id === parseInt(formId));
    updateLine(idx, {
      form_id: formId,
      form_name: form?.name || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    const validLines = lines.filter(l => l.form_id);
    if (validLines.length === 0) {
      toast.error('Please add at least one form with permissions');
      return;
    }

    // Check for duplicate forms
    const formIds = validLines.map(l => l.form_id);
    const uniqueFormIds = new Set(formIds);
    if (formIds.length !== uniqueFormIds.size) {
      toast.error('Duplicate forms are not allowed');
      return;
    }

    setLoading(true);
    try {
      // Delete existing rights for this user first
      await fetch(`${API_BASE}/api/user-rights/user/${selectedUserId}`, {
        method: 'DELETE',
      });

      // Insert new rights
      let successCount = 0;
      let errorCount = 0;

      for (const line of validLines) {
        try {
          const payload = {
            user_id: parseInt(selectedUserId),
            form_id: parseInt(line.form_id),
            read_permission: line.read_permission,
            write_permission: line.write_permission,
          };

          const response = await fetch(`${API_BASE}/api/user-rights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          const result = await response.json();
          if (result.success) successCount++;
          else errorCount++;
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Saved ${successCount} permission(s)${errorCount ? `, ${errorCount} failed` : ''}`);
        // Refresh existing records
        const response = await fetch(`${API_BASE}/api/user-rights`);
        const result = await response.json();
        if (result.success) setExistingRecords(result.data);
      } else {
        toast.error('Failed to save permissions');
      }
    } catch (error) {
      toast.error('Network error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    if (existingRecords.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = existingRecords.map(record => ({
      'User Name': record.user_name,
      'User ID': record.user_code,
      'Form Name': record.form_name,
      'Form ID': record.form_code,
      'Read': record.read_permission ? 'Yes' : 'No',
      'Write': record.write_permission ? 'Yes' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'User Rights');

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `User_Rights_${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
    toast.success('Exported successfully');
  };

  return (
    <div className="p-6">
      <header className="sticky top-0 bg-white shadow-sm border-b border-gray-200 px-4 py-3 z-40 mb-6 pl-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">User Rights</h1>
          <button
            onClick={handleExportToExcel}
            className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Download className="h-4 w-4" />
            <span className="sm:inline hidden">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        {/* Header: User Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">User Selection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Name <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => handleUserChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select User</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <input
                type="text"
                value={selectedUserCode}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600"
                placeholder="Populated from user master"
              />
            </div>
          </div>
        </div>

        {/* Line Items: Form Permissions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Form Permissions</h2>
            <button
              type="button"
              onClick={addLine}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Form Name</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Form ID</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Read</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Write</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 px-2">
                      <select
                        value={line.form_id}
                        onChange={(e) => handleFormChange(idx, e.target.value)}
                        className="w-full min-w-[180px] border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Select Form</option>
                        {forms.map((form) => (
                          <option key={form.id} value={form.id}>
                            {form.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={forms.find(f => f.id === parseInt(line.form_id))?.code || ''}
                        readOnly
                        className="w-full min-w-[100px] border border-gray-200 rounded px-2 py-1 bg-gray-50"
                        placeholder="From form master"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={line.read_permission}
                        onChange={(e) => updateLine(idx, { read_permission: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={line.write_permission}
                        onChange={(e) => updateLine(idx, { write_permission: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 1}
                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                        title="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Form ID is populated automatically when you select a form from the dropdown.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Rights'}
          </button>
        </div>
      </form>

      {/* Existing Records Table */}
      {existingRecords.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">All User Rights</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Form Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Form ID
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Read
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Write
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {existingRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {record.user_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {record.user_code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {record.form_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {record.form_code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.read_permission ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {record.read_permission ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.write_permission ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {record.write_permission ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
