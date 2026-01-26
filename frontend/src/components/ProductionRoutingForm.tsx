import React from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface MasterOption {
  id: number;
  code: string;
  name: string;
}

interface RoutingLine {
  id?: number;
  machine_centre_id: string;
  observed_time: string;
  rating_factor: string;
  manpower: string;
  // Calculated fields
  normal_time_secs_pr?: number;
  std_time_secs_pr?: number;
  mins_12_prs_box?: number;
  pairs_per_hr?: number;
  pairs_per_day?: number;
}

interface HeaderData {
  customer_id: string;
  group_id: string;
  leather_id: string;
  style_id: string;
  color_id: string;
  created_on: string;
  category: string;
  target_per_day: string;
  tot_smv: string;
}

export const ProductionRoutingForm: React.FC = () => {
  const [customers, setCustomers] = React.useState<MasterOption[]>([]);
  const [groups, setGroups] = React.useState<MasterOption[]>([]);
  const [leathers, setLeathers] = React.useState<MasterOption[]>([]);
  const [styles, setStyles] = React.useState<MasterOption[]>([]);
  const [colors, setColors] = React.useState<MasterOption[]>([]);
  const [workCentres, setWorkCentres] = React.useState<MasterOption[]>([]);
  const [machineCentres, setMachineCentres] = React.useState<MasterOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [headerData, setHeaderData] = React.useState<HeaderData>({
    customer_id: '',
    group_id: '',
    leather_id: '',
    style_id: '',
    color_id: '',
    created_on: new Date().toISOString().split('T')[0],
    category: '',
    target_per_day: '',
    tot_smv: '',
  });

  const [lines, setLines] = React.useState<RoutingLine[]>([{
    machine_centre_id: '',
    observed_time: '',
    rating_factor: '',
    manpower: '',
  }]);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

  // Fetch all master data
  React.useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [custRes, grpRes, lthRes, stylRes, colRes, wcRes, mcRes] = await Promise.all([
          fetch(`${API_BASE}/api/masters/customers`),
          fetch(`${API_BASE}/api/masters/groups_master`),
          fetch(`${API_BASE}/api/masters/leather`),
          fetch(`${API_BASE}/api/masters/styles`),
          fetch(`${API_BASE}/api/masters/colors`),
          fetch(`${API_BASE}/api/masters/work_centres`),
          fetch(`${API_BASE}/api/masters/machine_centres`),
        ]);

        const [cust, grp, lth, styl, col, wc, mc] = await Promise.all([
          custRes.json(),
          grpRes.json(),
          lthRes.json(),
          stylRes.json(),
          colRes.json(),
          wcRes.json(),
          mcRes.json(),
        ]);

        if (cust.success) setCustomers(cust.data);
        if (grp.success) setGroups(grp.data);
        if (lth.success) setLeathers(lth.data);
        if (styl.success) setStyles(styl.data);
        if (col.success) setColors(col.data);
        if (wc.success) setWorkCentres(wc.data);
        if (mc.success) setMachineCentres(mc.data);
      } catch (error) {
        toast.error('Error loading master data');
        console.error(error);
      }
    };

    fetchMasters();
  }, []);

  // Calculate target per hour
  const targetPerHour = headerData.target_per_day ? (parseFloat(headerData.target_per_day) / 8).toFixed(2) : '0.00';

  // Calculate line values
  const calculateLineValues = (line: RoutingLine) => {
    const observedTime = parseFloat(line.observed_time) || 0;
    const ratingFactor = parseFloat(line.rating_factor) || 0;
    const targetPerDay = parseFloat(headerData.target_per_day) || 0;

    const normalTimeSecs = (observedTime * ratingFactor) / 100;
    const stdTimeSecs = normalTimeSecs * 1.15;
    const mins12Prs = (stdTimeSecs * 12) / 60;
    const pairsPerHr = targetPerDay / 8;
    const pairsPerDay = pairsPerHr * 8;

    return {
      normal_time_secs_pr: normalTimeSecs,
      std_time_secs_pr: stdTimeSecs,
      mins_12_prs_box: mins12Prs,
      pairs_per_hr: pairsPerHr,
      pairs_per_day: pairsPerDay,
    };
  };

  const addLine = () => {
    setLines([...lines, {
      machine_centre_id: '',
      observed_time: '',
      rating_factor: '',
      manpower: '',
    }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    } else {
      toast.error('At least one line item is required');
    }
  };

  const updateLine = (index: number, field: keyof RoutingLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!headerData.customer_id || !headerData.style_id || !headerData.target_per_day) {
      toast.error('Please fill all required header fields');
      return;
    }

    const incompleteLine = lines.find(line => 
      !line.machine_centre_id || !line.observed_time || 
      !line.rating_factor || !line.manpower
    );

    if (incompleteLine) {
      toast.error('Please fill all line item fields');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        header: headerData,
        lines: lines.map(line => ({
          machine_centre_id: parseInt(line.machine_centre_id),
          observed_time: parseFloat(line.observed_time),
          rating_factor: parseFloat(line.rating_factor),
          manpower: parseFloat(line.manpower),
        })),
      };

      const response = await fetch(`${API_BASE}/api/production-routing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Production routing created successfully');
        // Reset form
        setHeaderData({
          customer_id: '',
          group_id: '',
          leather_id: '',
          style_id: '',
          color_id: '',
          created_on: new Date().toISOString().split('T')[0],
          category: '',
          target_per_day: '',
          tot_smv: '',
        });
        setLines([{
          machine_centre_id: '',
          observed_time: '',
          rating_factor: '',
          manpower: '',
        }]);
      } else {
        toast.error(result.error || 'Failed to create routing');
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
        <h1 className="text-2xl font-bold text-gray-900">Production Routing</h1>
      </header>

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Header Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={headerData.customer_id}
                onChange={(e) => setHeaderData({ ...headerData, customer_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group <span className="text-red-500">*</span>
              </label>
              <select
                value={headerData.group_id}
                onChange={(e) => setHeaderData({ ...headerData, group_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leather <span className="text-red-500">*</span>
              </label>
              <select
                value={headerData.leather_id}
                onChange={(e) => setHeaderData({ ...headerData, leather_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Leather</option>
                {leathers.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style <span className="text-red-500">*</span>
              </label>
              <select
                value={headerData.style_id}
                onChange={(e) => setHeaderData({ ...headerData, style_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Style</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color <span className="text-red-500">*</span>
              </label>
              <select
                value={headerData.color_id}
                onChange={(e) => setHeaderData({ ...headerData, color_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Color</option>
                {colors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Created On <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={headerData.created_on}
                onChange={(e) => setHeaderData({ ...headerData, created_on: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={headerData.category}
                onChange={(e) => setHeaderData({ ...headerData, category: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target per Day <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={headerData.target_per_day}
                onChange={(e) => setHeaderData({ ...headerData, target_per_day: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target per Hour
              </label>
              <input
                type="text"
                value={targetPerHour}
                readOnly
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total SMV <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={headerData.tot_smv}
                onChange={(e) => setHeaderData({ ...headerData, tot_smv: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Line Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Machine Centre</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Observed Time</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating Factor %</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Normal Time (s/pr)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Std Time (s/pr)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mins 12 prs/box</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pairs/hr</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pairs/day</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Manpower</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lines.map((line, index) => {
                  const calculated = calculateLineValues(line);
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <select
                          value={line.machine_centre_id}
                          onChange={(e) => updateLine(index, 'machine_centre_id', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          required
                        >
                          <option value="">Select</option>
                          {machineCentres.map((mc) => (
                            <option key={mc.id} value={mc.id}>{mc.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.observed_time}
                          onChange={(e) => updateLine(index, 'observed_time', e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.rating_factor}
                          onChange={(e) => updateLine(index, 'rating_factor', e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          required
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {calculated.normal_time_secs_pr.toFixed(4)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {calculated.std_time_secs_pr.toFixed(4)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {calculated.mins_12_prs_box.toFixed(4)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {calculated.pairs_per_hr.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {calculated.pairs_per_day.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.manpower}
                          onChange={(e) => updateLine(index, 'manpower', e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            {loading ? 'Saving...' : 'Save Routing'}
          </button>
        </div>
      </form>
    </div>
  );
};
