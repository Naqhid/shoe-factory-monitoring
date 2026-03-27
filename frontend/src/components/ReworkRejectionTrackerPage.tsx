import React, { useState, useEffect } from 'react';
import { Save, Calendar, Building, Cpu, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../services/api';

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
  const userInfo = JSON.parse(sessionStorage.getItem('user_info') || '{}');
  const isSupervisor = userInfo?.role === 'Line Supervisor';
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
        const response = await fetch(`${API_BASE_URL}/api/masters/work_centres`);
        const result = await response.json();
        if (result.success) setWorkCentres(result.data);
      } catch (error) {
        console.error('Error fetching work centres:', error);
      }
    };
    fetchWorkCentres();
  }, []);

  useEffect(() => {
    if (isSupervisor && supervisorWorkCentreId) {
      fetchProductionData();
      fetchSavedRecords();
    }
  }, [workCentres]);

  useEffect(() => {
    const fetchMachineCentres = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/masters/machine_centres`);
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
      const response = await fetch(`${API_BASE_URL}/api/rework-rejection?work_centre_id=${wcId}&date=${selectedDate}`);
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
      const mockData: ReworkData[] = [
        { emp_id: 'EMP-1001', employee_name: 'John Doe', machine_centre_name: 'Stitching Machine 1', total_output_pairs: 120, target_pairs: 12, bins_completed: 10, rework_qty: 0, rejection_qty: 0, reason_category: '', reason: '' },
        { emp_id: 'EMP-1002', employee_name: 'Jane Smith', machine_centre_name: 'Stitching Machine 2', total_output_pairs: 96, target_pairs: 12, bins_completed: 8, rework_qty: 0, rejection_qty: 0, reason_category: '', reason: '' },
        { emp_id: 'EMP-1003', employee_name: 'Mike Johnson', machine_centre_name: 'Cutting Machine 1', total_output_pairs: 144, target_pairs: 12, bins_completed: 12, rework_qty: 0, rejection_qty: 0, reason_category: '', reason: '' },
      ];
      setReworkData(mockData);
      toast.success('Data loaded successfully');
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
      const response = await fetch(`${API_BASE_URL}/api/rework-rejection`, {
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Cpu className="h-4 w-4 inline mr-1" />
              Machine Centre
            </label>
            <select
              value={selectedMachineCentre}
              onChange={(e) => setSelectedMachineCentre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Machine Centres</option>
              {machineCentres.map((mc) => (
                <option key={mc.id} value={mc.id}>{mc.name}</option>
              ))}
            </select>
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
                      <input type="number" min="0" max={row.total_output_pairs} value={row.rework_qty}
                        onChange={(e) => updateReworkData(index, 'rework_qty', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                      <input type="number" min="0" max={row.total_output_pairs} value={row.rejection_qty}
                        onChange={(e) => updateReworkData(index, 'rejection_qty', e.target.value)}
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {savedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDateTime(rec.saved_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{rec.machine_centre_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{rec.total_output_pairs}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{rec.bins_completed}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span className={`font-semibold ${rec.rework_qty > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>{rec.rework_qty}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span className={`font-semibold ${rec.rejection_qty > 0 ? 'text-red-600' : 'text-gray-500'}`}>{rec.rejection_qty}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{rec.reason_category || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{rec.reason || '—'}</td>
                  </tr>
                ))}
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
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
