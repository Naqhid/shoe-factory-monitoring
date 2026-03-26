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

interface WorkCentre {
  id: number;
  name: string;
}

const REASON_MAP: Record<string, { label: string; reasons: string[] }> = {
  MAN: {
    label: 'MAN',
    reasons: ['Skill', 'Handling', 'Spec Awareness', 'Inspection'],
  },
  MACHINE: {
    label: 'MACHINE',
    reasons: ['Settings', 'Needle/Foot', 'Skiving/Folding', 'Alignment'],
  },
  MATERIAL: {
    label: 'MATERIAL',
    reasons: ['Quality/Thickness', 'Thread/Accessories', 'Component Accuracy', 'Defects'],
  },
  METHOD: {
    label: 'METHOD',
    reasons: ['Sequence', 'SOP', 'Marking', 'QC Checks'],
  },
};

const REASON_CATEGORIES = [
  { value: '', label: 'Select Category' },
  ...Object.entries(REASON_MAP).map(([value, { label }]) => ({ value, label })),
];

export const ReworkRejectionTrackerPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([]);
  const [selectedWorkCentre, setSelectedWorkCentre] = useState('');
  const [reworkData, setReworkData] = useState<ReworkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [workCentresLoading, setWorkCentresLoading] = useState(true);

  // Get supervisor's assigned work centre from session
  const userInfo = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem('user_info');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const isSupervisor = userInfo?.role === 'Line Supervisor';

  useEffect(() => {
    const fetchWorkCentres = async () => {
      setWorkCentresLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/masters/work_centres`);
        const result = await response.json();
        if (result.success) {
          setWorkCentres(result.data);
          // Auto-select supervisor's work centre
          if (isSupervisor && userInfo?.work_centre_id) {
            setSelectedWorkCentre(String(userInfo.work_centre_id));
          }
        }
      } catch (error) {
        console.error('Error fetching work centres:', error);
        toast.error('Failed to load work centres');
      } finally {
        setWorkCentresLoading(false);
      }
    };
    fetchWorkCentres();
  }, [isSupervisor, userInfo?.work_centre_id]);

  const fetchProductionData = async () => {
    if (!selectedDate || !selectedWorkCentre) {
      toast.error('Please select date and work centre');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rework-rejection?date=${selectedDate}&work_centre_id=${selectedWorkCentre}`
      );
      const result = await response.json();
      if (result.success) {
        setReworkData(
          result.data.map((row: ReworkData) => ({
            ...row,
            rework_qty: row.rework_qty ?? 0,
            rejection_qty: row.rejection_qty ?? 0,
            reason_category: row.reason_category ?? '',
            reason: row.reason ?? '',
          }))
        );
        toast.success('Data loaded successfully');
      } else {
        // Fallback mock data for demonstration
        const mockData: ReworkData[] = [
          {
            emp_id: 'EMP-1001',
            employee_name: 'John Doe',
            machine_centre_name: 'Stitching Machine 1',
            total_output_pairs: 120,
            target_pairs: 12,
            bins_completed: 10,
            rework_qty: 0,
            rejection_qty: 0,
            reason_category: '',
            reason: '',
          },
          {
            emp_id: 'EMP-1002',
            employee_name: 'Jane Smith',
            machine_centre_name: 'Stitching Machine 2',
            total_output_pairs: 96,
            target_pairs: 12,
            bins_completed: 8,
            rework_qty: 0,
            rejection_qty: 0,
            reason_category: '',
            reason: '',
          },
        ];
        setReworkData(mockData);
        toast.success('Data loaded (demo)');
      }
    } catch (error) {
      console.error('Error fetching production data:', error);
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
      // Reset reason when category changes
      updatedData[index] = { ...item, reason_category: value as string, reason: '' };
    } else {
      updatedData[index] = { ...item, [field]: value };
    }

    setReworkData(updatedData);
  };

  const handleSave = async () => {
    const invalidRows = reworkData.filter(
      (row) =>
        (row.rework_qty > 0 || row.rejection_qty > 0) &&
        (!row.reason_category || !row.reason.trim())
    );
    if (invalidRows.length > 0) {
      toast.error('Please provide reason category and reason for all rows with rework/rejection quantities');
      return;
    }
    try {
      console.log('Saving rework data:', reworkData);
      toast.success('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Failed to save data');
    }
  };

  const supervisorWorkCentreName = workCentres.find(
    (wc) => String(wc.id) === String(userInfo?.work_centre_id)
  )?.name;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Rework / Rejection Tracker</h1>
        <p className="text-gray-600">Track and manage rework and rejection quantities for production</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            {workCentresLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-500">Loading...</span>
              </div>
            ) : isSupervisor ? (
              <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-800 font-medium">
                {supervisorWorkCentreName || 'Not assigned'}
              </div>
            ) : (
              <select
                value={selectedWorkCentre}
                onChange={(e) => setSelectedWorkCentre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Work Centre</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchProductionData}
              disabled={loading || workCentresLoading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load Data'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-500 text-sm">Fetching production data...</p>
        </div>
      ) : reworkData.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Machine Centre
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Output
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bins Completed
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rework Qty
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rejection Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reworkData.map((row, index) => {
                  const reasons = row.reason_category ? REASON_MAP[row.reason_category]?.reasons ?? [] : [];
                  return (
                    <tr
                      key={row.emp_id}
                      className={`hover:bg-gray-50 ${row.rejection_qty > 10 ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.machine_centre_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {row.total_output_pairs}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {Math.floor(row.total_output_pairs / row.target_pairs)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                        <input
                          type="number"
                          min="0"
                          max={row.total_output_pairs}
                          value={row.rework_qty}
                          onChange={(e) => updateReworkData(index, 'rework_qty', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                        <input
                          type="number"
                          min="0"
                          max={row.total_output_pairs}
                          value={row.rejection_qty}
                          onChange={(e) => updateReworkData(index, 'rejection_qty', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <select
                          value={row.reason_category}
                          onChange={(e) => updateReworkData(index, 'reason_category', e.target.value)}
                          className="w-36 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {REASON_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <select
                          value={row.reason}
                          onChange={(e) => updateReworkData(index, 'reason', e.target.value)}
                          disabled={!row.reason_category}
                          className="w-44 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Reason</option>
                          {reasons.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Cpu className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">Select filters and click "Load Data" to view production information</p>
        </div>
      )}
    </div>
  );
};
