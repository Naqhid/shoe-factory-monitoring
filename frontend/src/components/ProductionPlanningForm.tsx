import React from 'react';
import { Save, Upload, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE } from '../services/api';

interface MasterOption {
  id: number;
  code: string;
  name: string;
}

interface LineItem {
  style_id: string;
  customer_id: string;
  group_id: string;
  leather_id: string;
  color_id: string;
  customer_name: string;
  group_name: string;
  leather_name: string;
  color_name: string;
  work_centre_id: string;
  total_target_per_day: string;
  target_pairs_per_tray: string;
  tray_count: string;
  man_hours_minutes: string;
  smv_per_pair: string;
}

const emptyLine = (): LineItem => ({
  style_id: '',
  customer_id: '',
  group_id: '',
  leather_id: '',
  color_id: '',
  customer_name: '',
  group_name: '',
  leather_name: '',
  color_name: '',
  work_centre_id: '',
  total_target_per_day: '',
  target_pairs_per_tray: '',
  tray_count: '',
  man_hours_minutes: '',
  smv_per_pair: '',
});

export const ProductionPlanningForm: React.FC = () => {
  const [styles, setStyles] = React.useState<MasterOption[]>([]);
  const [workCentres, setWorkCentres] = React.useState<MasterOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [bulkMode, setBulkMode] = React.useState(false);
  const [bulkData, setBulkData] = React.useState<any[]>([]);

  const [planDate, setPlanDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = React.useState<LineItem[]>([emptyLine()]);


  // Fetch styles and work centres on mount
  React.useEffect(() => {
    const fetchStyles = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/masters/styles`);
        const result = await response.json();
        if (result.success) setStyles(result.data);
      } catch (error) {
        toast.error('Error loading styles');
        console.error(error);
      }
    };
    const fetchWorkCentres = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/masters/work_centres`);
        const result = await response.json();
        if (result.success) setWorkCentres(result.data);
      } catch (error) {
        toast.error('Error loading work centres');
        console.error(error);
      }
    };
    fetchStyles();
    fetchWorkCentres();
  }, []);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, updates: Partial<LineItem>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...updates } : l)));
  };

  const handleStyleChange = async (idx: number, styleId: string) => {
    updateLine(idx, {
      style_id: styleId,
      customer_id: '',
      group_id: '',
      leather_id: '',
      color_id: '',
      customer_name: '',
      group_name: '',
      leather_name: '',
      color_name: '',
      smv_per_pair: '',
    });
    if (!styleId) return;

    try {
      const res = await fetch(`${API_BASE}/api/production-routing/style/${styleId}`);
      const result = await res.json();
      if (result.success && result.data) {
        const r = result.data;
        updateLine(idx, {
          style_id: styleId,
          customer_id: String(r.customer_id ?? ''),
          group_id: String(r.group_id ?? ''),
          leather_id: String(r.leather_id ?? ''),
          color_id: String(r.color_id ?? ''),
          customer_name: r.customer_name || '',
          group_name: r.group_name || '',
          leather_name: r.leather_name || '',
          color_name: r.color_name || '',
          smv_per_pair: String(r.tot_smv ?? ''),
        });
      } else {
        toast.error(`No routing found for this style.`);
      }
    } catch (e) {
      toast.error('Error fetching routing');
      console.error(e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = (ev.target?.result as string) || '';
      const rows = csv.split('\n');
      const headers = rows[0].split(',').map((h) => h.trim());
      const data = rows.slice(1)
        .map((row) => {
          const v = row.split(',');
          const o: any = {};
          headers.forEach((h, i) => { o[h] = v[i]?.trim(); });
          return o;
        })
        .filter((r) => r.plan_date && r.style_code && r.work_centre_id && r.total_target_per_day && r.target_pairs_per_tray && r.man_hours_minutes && r.smv_per_pair);
      setBulkData(data);
      setBulkMode(true);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (bulkData.length === 0) return;
    setLoading(true);
    let ok = 0, err = 0;
    for (const row of bulkData) {
      try {
        const style = styles.find((s) => s.code === row.style_code);
        if (!style) { err++; continue; }
        const payload: any = {
          plan_date: row.plan_date,
          style_id: style.id,
          customer_id: null,
          group_id: null,
          leather_id: null,
          color_id: null,
          work_centre_id: parseInt(row.work_centre_id),
          total_target_per_day: parseInt(row.total_target_per_day),
          target_pairs_per_tray: parseInt(row.target_pairs_per_tray),
          tray_count: parseInt(row.tray_count || '0'),
          man_hours_minutes: parseInt(row.man_hours_minutes),
          smv_per_pair: parseFloat(row.smv_per_pair || '0'),
        };
        const rr = await fetch(`${API_BASE}/api/production-routing/style/${style.id}`);
        const rj = await rr.json();
        if (rj.success && rj.data) {
          payload.customer_id = rj.data.customer_id;
          payload.group_id = rj.data.group_id;
          payload.leather_id = rj.data.leather_id;
          payload.color_id = rj.data.color_id;
        }
        const res = await fetch(`${API_BASE}/api/production-planning`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await res.json();
        if (j.success) ok++; else err++;
      } catch { err++; }
    }
    setLoading(false);
    toast.success(`Bulk: ${ok} ok, ${err} errors`);
    setBulkMode(false);
    setBulkData([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toSave = lines.filter(
      (l) =>
        l.style_id && l.customer_id && l.work_centre_id && l.total_target_per_day &&
        l.target_pairs_per_tray && l.man_hours_minutes && l.smv_per_pair
    );
    if (toSave.length === 0) {
      toast.error('Add at least one line with Style, Work Centre, targets, and SMV. Customer/Group/Leather/Color come from routing when Style is selected.');
      return;
    }

    setLoading(true);
    let ok = 0, err = 0;
    for (const l of toSave) {
      try {
        const payload = {
          plan_date: planDate,
          style_id: parseInt(l.style_id),
          customer_id: parseInt(l.customer_id),
          group_id: l.group_id ? parseInt(l.group_id) : null,
          leather_id: l.leather_id ? parseInt(l.leather_id) : null,
          color_id: l.color_id ? parseInt(l.color_id) : null,
          work_centre_id: parseInt(l.work_centre_id),
          total_target_per_day: parseInt(l.total_target_per_day),
          target_pairs_per_tray: parseInt(l.target_pairs_per_tray),
          tray_count: parseInt(l.tray_count || '0'),
          man_hours_minutes: parseInt(l.man_hours_minutes),
          smv_per_pair: parseFloat(l.smv_per_pair),
        };
        const res = await fetch(`${API_BASE}/api/production-planning`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await res.json();
        if (j.success) ok++; else { err++; toast.error(j.error || 'Failed to save line'); }
      } catch (e) {
        err++;
        toast.error('Network error');
      }
    }
    setLoading(false);
    if (ok) {
      toast.success(`Saved ${ok} line(s)${err ? `, ${err} failed` : ''}.`);
      setLines([emptyLine()]);
    }
  };

  return (
    <div className="p-6">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Production Planning</h1>
      </header>

      {/* Bulk Upload */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Bulk Upload</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <input type="file" accept=".csv" onChange={handleFileUpload} className="border border-gray-300 rounded-md px-3 py-2" />
          <span className="text-sm text-gray-600">CSV: plan_date, style_code, work_centre_id, total_target_per_day, target_pairs_per_tray, man_hours_minutes, smv_per_pair</span>
        </div>
        {bulkData.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-700">{bulkData.length} rows</span>
            <button type="button" onClick={handleBulkSubmit} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
              <Upload className="h-4 w-4" />{loading ? 'Uploading...' : 'Upload Plans'}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Header: Plan Date only */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Plan</h2>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Line items: Customer, Style, Leather, Color, Group + Work Centre, targets, SMV */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Line Items</h2>
            <button type="button" onClick={addLine} className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium">
              <Plus className="h-4 w-4" /> Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Customer</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Style</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Leather</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Color</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Group</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Total Target</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Pairs/Tray</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Tray Count</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Man Hrs (min)</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">SMV</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1 px-2">
                      <input readOnly value={line.customer_name} className="w-full min-w-[100px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                    </td>
                    <td className="py-1 px-2">
                      <select
                        value={line.style_id}
                        onChange={(e) => handleStyleChange(idx, e.target.value)}
                        className="w-full min-w-[120px] border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Style</option>
                        {styles.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2">
                      <input readOnly value={line.leather_name} className="w-full min-w-[90px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                    </td>
                    <td className="py-1 px-2">
                      <input readOnly value={line.color_name} className="w-full min-w-[80px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                    </td>
                    <td className="py-1 px-2">
                      <input readOnly value={line.group_name} className="w-full min-w-[90px] border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                    </td>
                    <td className="py-1 px-2">
                      <select
                        value={line.work_centre_id}
                        onChange={(e) => updateLine(idx, { work_centre_id: e.target.value })}
                        className="w-full min-w-[120px] border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Work Centre</option>
                        {workCentres.map((c) => (
                          <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2">
                      <input type="number" value={line.total_target_per_day} onChange={(e) => updateLine(idx, { total_target_per_day: e.target.value })} className="w-20 border border-gray-300 rounded px-2 py-1" />
                    </td>
                    <td className="py-1 px-2">
                      <input type="number" value={line.target_pairs_per_tray} onChange={(e) => updateLine(idx, { target_pairs_per_tray: e.target.value })} className="w-20 border border-gray-300 rounded px-2 py-1" />
                    </td>
                    <td className="py-1 px-2">
                      <input type="number" value={line.tray_count} onChange={(e) => updateLine(idx, { tray_count: e.target.value })} className="w-20 border border-gray-300 rounded px-2 py-1" />
                    </td>
                    <td className="py-1 px-2">
                      <input type="number" value={line.man_hours_minutes} onChange={(e) => updateLine(idx, { man_hours_minutes: e.target.value })} className="w-24 border border-gray-300 rounded px-2 py-1" />
                    </td>
                    <td className="py-1 px-2">
                      <input readOnly value={line.smv_per_pair} className="w-16 border border-gray-200 rounded px-2 py-1 bg-gray-50" placeholder="From routing" />
                    </td>
                    <td className="py-1 px-1">
                      <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 1} className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-40" title="Remove line">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-gray-600">Customer, Group, Leather, and Color are filled from Production Routing when you select a Style.</p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
            <Save className="h-4 w-4" />{loading ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      </form>
    </div>
  );
};
