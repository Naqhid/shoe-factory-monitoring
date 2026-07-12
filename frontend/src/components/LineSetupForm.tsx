import React from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

interface MasterOption {
  id: number;
  code: string;
  name: string;
}

interface FormData {
  employee_id: string;
  machine_id: string;
  login_date_time: string;
  work_centre_id: string;
  machine_centre_id: string;
  smv_per_pair: string;
}

export const LineSetupForm: React.FC = () => {
  const [employees, setEmployees] = React.useState<MasterOption[]>([]);
  const [workCentres, setWorkCentres] = React.useState<MasterOption[]>([]);
  const [machineCentres, setMachineCentres] = React.useState<MasterOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [formData, setFormData] = React.useState<FormData>({
    employee_id: '',
    machine_id: '',
    login_date_time: new Date().toISOString().slice(0, 16),
    work_centre_id: '',
    machine_centre_id: '',
    smv_per_pair: '',
  });


  // Fetch data on mount
  React.useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/api/masters/employees`);
        const result = await response.json();
        if (result.success) {
          setEmployees(result.data);
        }
      } catch (error) {
        toast.error('Error loading employees');
        console.error(error);
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
        toast.error('Error loading work centres');
        console.error(error);
      }
    };

    const fetchMachineCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/api/masters/machine_centres`);
        const result = await response.json();
        if (result.success) {
          setMachineCentres(result.data);
        }
      } catch (error) {
        toast.error('Error loading machine centres');
        console.error(error);
      }
    };

    fetchEmployees();
    fetchWorkCentres();
    fetchMachineCentres();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_id || !formData.machine_id || !formData.login_date_time || !formData.work_centre_id || !formData.machine_centre_id || !formData.smv_per_pair) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        employee_id: parseInt(formData.employee_id),
        machine_id: formData.machine_id,
        login_date_time: formData.login_date_time,
        work_centre_id: parseInt(formData.work_centre_id),
        machine_centre_id: parseInt(formData.machine_centre_id),
        smv_per_pair: parseFloat(formData.smv_per_pair),
      };

      const response = await apiFetch(`${API_BASE}/api/line-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Line setup created successfully');
        // Reset form
        setFormData({
          employee_id: '',
          machine_id: '',
          login_date_time: new Date().toISOString().slice(0, 16),
          work_centre_id: '',
          machine_centre_id: '',
          smv_per_pair: '',
        });
      } else {
        if (response.status === 409) {
          toast.error(result.error || 'Active setup conflict: employee or machine is already active.');
        } else {
          toast.error(result.error || 'Failed to create line setup');
        }
      }
    } catch (error) {
      toast.error('Network error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Line Setup</h1>
      </header>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.code} - {employee.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Machine ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.machine_id}
                onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., US-01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Login Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.login_date_time}
                onChange={(e) => setFormData({ ...formData, login_date_time: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Centre <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.work_centre_id}
                onChange={(e) => setFormData({ ...formData, work_centre_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Work Centre</option>
                {workCentres.map((centre) => (
                  <option key={centre.id} value={centre.id}>
                    {centre.code} - {centre.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Machine Centre <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.machine_centre_id}
                onChange={(e) => setFormData({ ...formData, machine_centre_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Machine Centre</option>
                {machineCentres.map((centre) => (
                  <option key={centre.id} value={centre.id}>
                    {centre.code} - {centre.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMV per Pair <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.smv_per_pair}
                onChange={(e) => setFormData({ ...formData, smv_per_pair: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Line Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};