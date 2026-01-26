import React from 'react';
import { Save, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface MasterOption {
  id: number;
  code: string;
  name: string;
}

interface FormData {
  plan_date: string;
  style_id: string;
  customer_id: string;
  group_id: string;
  leather_id: string;
  color_id: string;
  work_centre_id: string;
  total_target_per_day: string;
  target_pairs_per_day: string;
  man_hours_minutes: string;
  smv_per_pair: string;
  target_per_day?: string;
}

export const ProductionPlanningForm: React.FC = () => {
  const [styles, setStyles] = React.useState<MasterOption[]>([]);
  const [workCentres, setWorkCentres] = React.useState<MasterOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [bulkMode, setBulkMode] = React.useState(false);
  const [bulkData, setBulkData] = React.useState<any[]>([]);

  const [formData, setFormData] = React.useState<FormData>({
    plan_date: new Date().toISOString().split('T')[0],
    style_id: '',
    customer_id: '',
    group_id: '',
    leather_id: '',
    color_id: '',
    work_centre_id: '',
    total_target_per_day: '',
    target_pairs_per_day: '',
    man_hours_minutes: '',
    smv_per_pair: '',
    target_per_day: '',
  });

  const [readOnlyFields, setReadOnlyFields] = React.useState({
    customer_name: '',
    group_name: '',
    leather_name: '',
    color_name: '',
  });

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

  // Fetch styles and work centres on mount
  React.useEffect(() => {
    const fetchStyles = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/masters/styles`);
        const result = await response.json();
        if (result.success) {
          setStyles(result.data);
        }
      } catch (error) {
        toast.error('Error loading styles');
        console.error(error);
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
        toast.error('Error loading work centres');
        console.error(error);
      }
    };

    fetchStyles();
    fetchWorkCentres();
  }, []);

  // Auto-populate when style is selected
  const handleStyleChange = async (styleId: string) => {
    setFormData({ ...formData, style_id: styleId });

    if (!styleId) {
      setReadOnlyFields({
        customer_name: '',
        group_name: '',
        leather_name: '',
        color_name: '',
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/production-routing/style/${styleId}`);
      const result = await response.json();

      if (result.success && result.data) {
        const routing = result.data;
        setFormData({
          ...formData,
          style_id: styleId,
          customer_id: routing.customer_id,
          group_id: routing.group_id,
          leather_id: routing.leather_id,
          color_id: routing.color_id,
          target_per_day: routing.target_per_day || '',
          smv_per_pair: routing.tot_smv || '',
        });

        setReadOnlyFields({
          customer_name: routing.customer_name || '',
          group_name: routing.group_name || '',
          leather_name: routing.leather_name || '',
          color_name: routing.color_name || '',
        });
      } else {
        toast.error('No routing found for this style. Please fill manually.');
      }
    } catch (error) {
      toast.error('Error fetching routing data');
      console.error(error);
    }
  };

  // Calculate target per hour
  const targetPerHour = formData.target_per_day ? (parseFloat(formData.target_per_day) / 8).toFixed(2) : '0.00';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index]?.trim();
        });
        return obj;
      }).filter(row => row.plan_date && row.style_code && row.work_centre_id && row.total_target_per_day && row.target_pairs_per_day && row.man_hours_minutes && row.smv_per_pair);

      setBulkData(data);
      setBulkMode(true);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (bulkData.length === 0) return;

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of bulkData) {
      try {
        // Find IDs from codes
        const style = styles.find(s => s.code === row.style_code);
        if (!style) {
          errorCount++;
          continue;
        }

        const payload = {
          plan_date: row.plan_date,
          style_id: style.id,
          customer_id: null, // Will be set from routing
          group_id: null,
          leather_id: null,
          color_id: null,
          work_centre_id: parseInt(row.work_centre_id),
          total_target_per_day: parseInt(row.total_target_per_day),
          target_pairs_per_day: parseInt(row.target_pairs_per_day),
          man_hours_minutes: parseInt(row.man_hours_minutes),
          smv_per_pair: parseFloat(row.smv_per_pair || '0'),
        };

        // Get routing data
        const routingResponse = await fetch(`${API_BASE}/api/production-routing/style/${style.id}`);
        const routingResult = await routingResponse.json();
        if (routingResult.success && routingResult.data) {
          payload.customer_id = routingResult.data.customer_id;
          payload.group_id = routingResult.data.group_id;
          payload.leather_id = routingResult.data.leather_id;
          payload.color_id = routingResult.data.color_id;
        }

        const response = await fetch(`${API_BASE}/api/production-planning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setLoading(false);
    toast.success(`Bulk upload completed: ${successCount} success, ${errorCount} errors`);
    setBulkMode(false);
    setBulkData([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.style_id || !formData.customer_id || !formData.work_centre_id || !formData.total_target_per_day || !formData.target_pairs_per_day || !formData.man_hours_minutes || !formData.smv_per_pair) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        plan_date: formData.plan_date,
        style_id: parseInt(formData.style_id),
        customer_id: parseInt(formData.customer_id),
        group_id: parseInt(formData.group_id) || null,
        leather_id: parseInt(formData.leather_id) || null,
        color_id: parseInt(formData.color_id) || null,
        work_centre_id: parseInt(formData.work_centre_id),
        total_target_per_day: parseInt(formData.total_target_per_day),
        target_pairs_per_day: parseInt(formData.target_pairs_per_day),
        man_hours_minutes: parseInt(formData.man_hours_minutes),
        smv_per_pair: parseFloat(formData.smv_per_pair),
      };

      const response = await fetch(`${API_BASE}/api/production-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Production plan created successfully');
        // Reset form
        setFormData({
          plan_date: new Date().toISOString().split('T')[0],
          style_id: '',
          customer_id: '',
          group_id: '',
          leather_id: '',
          color_id: '',
          work_centre_id: '',
          total_target_per_day: '',
          target_pairs_per_day: '',
          man_hours_minutes: '',
          smv_per_pair: '',
          target_per_day: '',
        });
        setReadOnlyFields({
          customer_name: '',
          group_name: '',
          leather_name: '',
          color_name: '',
        });
      } else {
        toast.error(result.error || 'Failed to create plan');
      }
    } catch (error) {
      toast.error('Network error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Production Planning</h1>
      </header>

      {/* Bulk Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Bulk Upload</h2>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <span className="text-sm text-gray-600">
            Upload CSV with columns: plan_date, style_code, work_centre_id, total_target_per_day, target_pairs_per_day, man_hours_minutes, smv_per_pair
          </span>
        </div>
        {bulkData.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-700 mb-2">Preview: {bulkData.length} records</p>
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {loading ? 'Uploading...' : 'Upload Plans'}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Plan Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.plan_date}
                onChange={(e) => setFormData({ ...formData, plan_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.style_id}
                onChange={(e) => handleStyleChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Style</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <input
                type="text"
                value={readOnlyFields.customer_name}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                placeholder="Auto-populated from routing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
              <input
                type="text"
                value={readOnlyFields.group_name}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                placeholder="Auto-populated from routing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leather</label>
              <input
                type="text"
                value={readOnlyFields.leather_name}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                placeholder="Auto-populated from routing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={readOnlyFields.color_name}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                placeholder="Auto-populated from routing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Created On</label>
              <input
                type="date"
                value={new Date().toISOString().split('T')[0]}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Work Centre Assignment */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Work Centre Assignment</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                Total Target per Day <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.total_target_per_day}
                onChange={(e) => setFormData({ ...formData, total_target_per_day: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Pairs per Day <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.target_pairs_per_day}
                onChange={(e) => setFormData({ ...formData, target_pairs_per_day: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Man Hours (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.man_hours_minutes}
                onChange={(e) => setFormData({ ...formData, man_hours_minutes: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMV per Pair <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.smv_per_pair}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                placeholder="Auto-populated from routing"
                required
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Customer, Group, Leather, and Color are auto-populated from the latest Production Routing for the selected Style.
              If no routing exists, you'll need to create one first in the Production Routing form.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      </form>
    </div>
  );
};
