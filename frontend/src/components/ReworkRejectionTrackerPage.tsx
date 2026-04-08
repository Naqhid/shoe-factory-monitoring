import React, { useState, useEffect } from 'react';
import { Save, Calendar, Building, Cpu, Loader2, Edit, Trash2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, apiFetch } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';

interface ReworkData {
  emp_id: string;
  employee_name: string;
  machine_centre_name: string;
  total_output_pairs: number;
  target_pairs: number;
  bins_completed: number;
  rework_qty: number;
  rejection_qty: number;
  reason_category: string;
  reason: string;
}

interface SavedRecord {
  id: number;
  machine_centre_name: string;
  total_output_pairs: number;
  bins_completed: number;
  rework_qty: number;
  rejection_qty: number;
  reason_category: string;
  reason: string;
  saved_at: string;
  production_date: string;
}

interface WorkCentre {
  id: number;
  name: string;
}

interface MachineCentre {
  id: number;
  name: string;
  machine_id: string;
}

const REASON_OPTIONS: Record<string, string[]> = {
  MAN: ['Skill', 'Handling', 'Spec Awareness', 'Inspection'],
  MACHINE: ['Settings', 'Needle/Foot', 'Skiving/Folding', 'Alignment'],
  MATERIAL: ['Quality/Thickness', 'Thread/Accessories', 'Component Accuracy', 'Defects'],
  METHOD: ['Sequence', 'SOP', 'Marking', 'QC Checks'],
};

export const ReworkRejectionTrackerPage: React.FC = () => {
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const isSupervisor = userInfo?.role === 'Line Supervisor';
  const canEditDelete = ['Admin', 'IED'].includes(userInfo?.role);
  const supervisorWorkCentreId = userInfo?.work_centre_id ? String(userInfo.work_centre_id) : '';

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([]);
  const [machineCentres, setMachineCentres] = useState<MachineCentre[]>([]);
  const [selectedWorkCentre, setSelectedWorkCentre] = useState(isSupervisor ? supervisorWorkCentreId : '');
  const [selectedMachineCentre, setSelectedMachineCentre] = useState('');
  const [reworkData, setReworkData] = useState<ReworkData[]>([]);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<SavedRecord>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const reasonCategories = [
    { value: '', label: 'Select Category' },
    { value: 'MAN', label: 'MAN' },
    { value: 'MACHINE', label: 'MACHINE' },
    { value: 'MATERIAL', label: 'MATERIAL' },
    { value: 'METHOD', label: 'METHOD' },
  ];

  useEffect(() => {
    const fetchWorkCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/masters/work_centres`);
        const result = await response.json();
        if (result.success) setWorkCentres(result.data);
      } catch (error) {
        console.error('Error fetching work centres:', error);
      }
    };
    fetchWorkCentres();
  }, []);

  useEffect(() => {
    if (isSupervisor && supervisorWorkCentreId && workCentres.length > 0) {
      setSelectedWorkCentre(supervisorWorkCentreId);
    }
  }, [workCentres]);

  useEffect(() => {
    if (isSupervisor && supervisorWorkCentreId && selectedWorkCentre) {
      fetchProductionData();
      fetchSavedRecords();
    }
  }, [selectedWorkCentre]);

  useEffect(() => {
    const fetchMachineCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/masters/machine_centres`);
        const result = await response.json();
        if (result.success) setMachineCentres(result.data);
      } catch (error) {
        console.error('Error fetching machine centres:', error);
      }
    };
    if (selectedWorkCentre) fetchMachineCentres();
  }, [selectedWorkCentre]);

  const fetchSavedRecords = async () => {
    const wcId = isSupervisor ? supervisorWorkCentreId : selectedWorkCentre;
    if (!wcId || !selectedDate) return;
    setHistoryLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection?work_centre_id=${wcId}&date=${selectedDate}`);
      const result = await response.json();
      if (result.success) setSavedRecords(result.data);
    } catch (error) {
      console.error('Error fetching saved records:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchProductionData = async () => {
    if (!selectedDate || !selectedWorkCentre) {
      toast.error('Please select date and work centre');
      return;
    }
    setLoading(true);
    try {
      const wcId = isSupervisor ? supervisorWorkCentreId : selectedWorkCentre;
      const response = await apiFetch(`${API_BASE_URL}/api/tv-dashboard/machine-centres/${wcId}?date=${selectedDate}`);
      const result = await response.json();
      if (result.success && result.data.length > 0) {
        setReworkData(result.data.map((row: any) => ({
          emp_id: row.machine_id,
          employee_name: '',
          machine_centre_name: row.machine_centre_name,
          total_output_pairs: row.total_output_pairs,
          target_pairs: row.target_pairs || 12,
          bins_completed: row.target_pairs > 0 ? Math.floor(row.total_output_pairs / row.target_pairs) : 0,
          rework_qty: 0,
          rejection_qty: 0,
          reason_category: '',
          reason: '',
        })));
        toast.success('Data loaded successfully');
      } else {
        setReworkData([]);
        toast.error('No production data found for selected date and work centre');
      }
      await fetchSavedRecords();
    } catch (error) {
      toast.error('Failed to load production data');
    } finally {
      setLoading(false);
    }
  };

  const updateReworkData = (index: number, field: keyof ReworkData, value: string | number) => {
    const updatedData = [...reworkData];
    const item = updatedData[index];
    if (field === 'rework_qty' || field === 'rejection_qty') {
      const numValue = Number(value);
      const otherField = field === 'rework_qty' ? 'rejection_qty' : 'rework_qty';
      const otherValue = item[otherField] as number;
      if (numValue + otherValue > item.total_output_pairs) {
        toast.error(`Total rework and rejection cannot exceed output pairs (${item.total_output_pairs})`);
        return;
      }
      updatedData[index] = { ...item, [field]: numValue };
    } else if (field === 'reason_category') {
      updatedData[index] = { ...item, reason_category: value as string, reason: '' };
    } else {
      updatedData[index] = { ...item, [field]: value };
    }
    setReworkData(updatedData);
  };

  const handleSave = async () => {
    const invalidRows = reworkData.filter(row =>
      (row.rework_qty > 0 || row.rejection_qty > 0) &&
      (!row.reason_category || !row.reason.trim())
    );
    if (invalidRows.length > 0) {
      toast.error('Please provide reason category and reason for all rows with rework/rejection quantities');
      return;
    }

    const wcId = isSupervisor ? supervisorWorkCentreId : selectedWorkCentre;
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_centre_id: wcId,
          production_date: selectedDate,
          rows: reworkData.map(row => ({
            machine_centre_name: row.machine_centre_name,
            total_output_pairs: row.total_output_pairs,
            bins_completed: Math.floor(row.total_output_pairs / row.target_pairs),
            rework_qty: row.rework_qty,
            rejection_qty: row.rejection_qty,
            reason_category: row.reason_category,
            reason: row.reason,
          })),
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Data saved successfully');
        await fetchSavedRecords();
      } else {
        toast.error(result.error || 'Failed to save');
      }
    } catch (error) {
      toast.error('Failed to save data');
    }
  };

  const formatDateTime = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleEditStart = (rec: SavedRecord) => {
    setEditingId(rec.id);
    setEditRow({ rework_qty: rec.rework_qty, rejection_qty: rec.rejection_qty, reason_category: rec.reason_category, reason: rec.reason });
  };

  const handleEditSave = async (rec: SavedRecord) => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection/${rec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRow),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Record updated');
        setEditingId(null);
        await fetchSavedRecords();
      } else {
        toast.error(result.error || 'Update failed');
      }
    } catch {
      toast.error('Failed to update record');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection/${deleteId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        toast.success('Record deleted');
        await fetchSavedRecords();
      } else {
        toast.error(result.error || 'Delete failed');
      }
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Rework / Rejection Tracker</h1>
        <p className="text-gray-600">Track and manage rework and rejection quantities for production</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Production Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="h-4 w-4 inline mr-1" />
              Work Centre
            </label>
            {isSupervisor ? (
              <input
                type="text"
                readOnly
                value={userInfo?.work_centre_name || supervisorWorkCentreId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
              />
            ) : (
              <select
                value={selectedWorkCentre}
                onChange={(e) => setSelectedWorkCentre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Work Centre</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>{wc.name}</option>
                ))}
              </select>
            )}
          </div>

        

          <div className="flex items-end">
            <button
              onClick={fetchProductionData}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Spinner */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600 text-lg">Loading data...</span>
        </div>
      )}

      {/* Input Table */}
      {!loading && reworkData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Production Data</h2>
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine Centre</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Output</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bins Completed</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rework Qty</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rejection Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reworkData.map((row, index) => (
                  <tr key={row.emp_id} className={`hover:bg-gray-50 ${row.rejection_qty > 10 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.machine_centre_name}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">{row.total_output_pairs}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">{Math.floor(row.total_output_pairs / row.target_pairs)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      <input type="number" min="0" max={row.total_output_pairs}
                        value={row.rework_qty === 0 ? '' : row.rework_qty}
                        onChange={(e) => updateReworkData(index, 'rework_qty', e.target.value === '' ? 0 : e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      <input type="number" min="0" max={row.total_output_pairs}
                        value={row.rejection_qty === 0 ? '' : row.rejection_qty}
                        onChange={(e) => updateReworkData(index, 'rejection_qty', e.target.value === '' ? 0 : e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <select value={row.reason_category}
                        onChange={(e) => updateReworkData(index, 'reason_category', e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {reasonCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <select value={row.reason}
                        onChange={(e) => updateReworkData(index, 'reason', e.target.value)}
                        disabled={!row.reason_category}
                        className="w-44 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Reason</option>
                        {(REASON_OPTIONS[row.reason_category] || []).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && reworkData.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center mb-6">
          <div className="text-gray-400 mb-4"><Cpu className="h-16 w-16 mx-auto" /></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">Select filters and click "Load Data" to view production information</p>
        </div>
      )}

      {/* Saved History Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Saved Records</h2>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading records...</span>
          </div>
        ) : savedRecords.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No saved records for this date and work centre</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine Centre</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Output</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bins</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rework</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rejection</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  {canEditDelete && (
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {savedRecords.map((rec) => {
                  const isEditing = editingId === rec.id;
                  return (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDateTime(rec.saved_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{rec.machine_centre_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{rec.total_output_pairs}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{rec.bins_completed}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {isEditing ? (
                          <input type="number" min="0" value={editRow.rework_qty ?? 0}
                            onChange={(e) => setEditRow(p => ({ ...p, rework_qty: Number(e.target.value) }))}
                            className="w-16 px-1 py-1 border border-blue-400 rounded text-center text-sm focus:outline-none" />
                        ) : (
                          <span className={`font-semibold ${rec.rework_qty > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>{rec.rework_qty}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        {isEditing ? (
                          <input type="number" min="0" value={editRow.rejection_qty ?? 0}
                            onChange={(e) => setEditRow(p => ({ ...p, rejection_qty: Number(e.target.value) }))}
                            className="w-16 px-1 py-1 border border-blue-400 rounded text-center text-sm focus:outline-none" />
                        ) : (
                          <span className={`font-semibold ${rec.rejection_qty > 0 ? 'text-red-600' : 'text-gray-500'}`}>{rec.rejection_qty}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {isEditing ? (
                          <select value={editRow.reason_category || ''}
                            onChange={(e) => setEditRow(p => ({ ...p, reason_category: e.target.value, reason: '' }))}
                            className="w-28 px-1 py-1 border border-blue-400 rounded text-sm focus:outline-none">
                            {reasonCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        ) : (
                          <span>{rec.reason_category || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {isEditing ? (
                          <select value={editRow.reason || ''}
                            onChange={(e) => setEditRow(p => ({ ...p, reason: e.target.value }))}
                            disabled={!editRow.reason_category}
                            className="w-40 px-1 py-1 border border-blue-400 rounded text-sm focus:outline-none">
                            <option value="">Select Reason</option>
                            {(REASON_OPTIONS[editRow.reason_category || ''] || []).map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span>{rec.reason || '—'}</span>
                        )}
                      </td>
                      {canEditDelete && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={() => handleEditSave(rec)} className="text-green-600 hover:text-green-800" title="Save">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700" title="Cancel">
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleEditStart(rec)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDelete(rec.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Totals:</td>
                  <td className="px-4 py-3 text-sm font-bold text-yellow-600 text-center">
                    {savedRecords.reduce((s, r) => s + r.rework_qty, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600 text-center">
                    {savedRecords.reduce((s, r) => s + r.rejection_qty, 0)}
                  </td>
                  <td colSpan={canEditDelete ? 3 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
