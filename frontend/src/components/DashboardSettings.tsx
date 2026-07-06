import React from 'react';
import { Save, Sliders, RotateCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { clearEfficiencyCache } from '../utils/efficiencyColors';

interface ColorThreshold {
  min: number;
  color: string;
  label: string;
}

interface EfficiencyColorConfig {
  thresholds: ColorThreshold[];
}

const DEFAULT_THRESHOLDS: ColorThreshold[] = [
  { min: 90, color: '#22c55e', label: 'Excellent (Green)' },
  { min: 80, color: '#eab308', label: 'Good (Yellow)' },
  { min: 70, color: '#f97316', label: 'Average (Orange)' },
  { min: 0, color: '#ef4444', label: 'Low (Red)' },
];

const COLOR_PRESETS = [
  { value: '#22c55e', label: 'Green' },
  { value: '#16a34a', label: 'Dark Green' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#dc2626', label: 'Dark Red' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#ec4899', label: 'Pink' },
];

export const DashboardSettings: React.FC = () => {
  const [thresholds, setThresholds] = React.useState<ColorThreshold[]>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/dashboard-settings`);
      const json = await res.json();
      if (json.success && json.data?.efficiency_colors?.thresholds) {
        setThresholds(json.data.efficiency_colors.thresholds);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate: thresholds should be sorted descending by min
    const sorted = [...thresholds].sort((a, b) => b.min - a.min);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].min <= sorted[i + 1].min) {
        toast.error('Each threshold must have a unique minimum value');
        return;
      }
    }
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/dashboard-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ efficiency_colors: { thresholds: sorted } }),
      });
      const json = await res.json();
      if (json.success) {
        setThresholds(sorted);
        clearEfficiencyCache();
        toast.success('Color settings saved');
      } else {
        toast.error(json.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    toast.success('Reset to defaults (save to apply)');
  };

  const updateThreshold = (index: number, field: keyof ColorThreshold, value: string | number) => {
    setThresholds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addThreshold = () => {
    setThresholds((prev) => [...prev, { min: 0, color: '#3b82f6', label: 'New' }]);
  };

  const removeThreshold = (index: number) => {
    if (thresholds.length <= 2) {
      toast.error('Need at least 2 thresholds');
      return;
    }
    setThresholds((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shrink-0">
            <Sliders className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Dashboard Settings</h1>
            <p className="text-xs sm:text-sm text-gray-500">Configure efficiency color thresholds</p>
          </div>
        </div>
      </div>

      {/* Efficiency Color Thresholds */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">Efficiency Color Thresholds</h2>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
            Define which color to show based on efficiency percentage.
          </p>
        </div>

        <div className="p-3 sm:p-5 space-y-4">
          {/* Preview */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">Preview</p>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
              {[...thresholds].sort((a, b) => b.min - a.min).map((t, i) => {
                const nextMin = i < thresholds.length - 1
                  ? [...thresholds].sort((a, b) => b.min - a.min)[i + 1]?.min
                  : null;
                const rangeLabel = nextMin != null
                  ? `${t.min}%+`
                  : `< ${[...thresholds].sort((a, b) => b.min - a.min)[i - 1]?.min || 100}%`;
                return (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
                    <div className="h-8 w-8 rounded-full shadow-inner flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: t.color }}>
                      {t.min}%
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{t.label}</p>
                      <p className="text-[10px] text-gray-400">≥ {t.min}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Threshold rows */}
          <div className="space-y-3">
            {thresholds.map((threshold, index) => (
              <div key={index} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full border-2 border-white shadow shrink-0" style={{ backgroundColor: threshold.color }} />
                  <select
                    value={threshold.color}
                    onChange={(e) => updateThreshold(index, 'color', e.target.value)}
                    className="flex-1 sm:flex-none border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  >
                    {COLOR_PRESETS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">≥</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={threshold.min}
                    onChange={(e) => updateThreshold(index, 'min', Number(e.target.value))}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
                  />
                  <label className="text-xs text-gray-500">%</label>
                  <input
                    type="text"
                    value={threshold.label}
                    onChange={(e) => updateThreshold(index, 'label', e.target.value)}
                    placeholder="Label"
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeThreshold(index)}
                    className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-xs font-medium shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addThreshold}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add threshold
          </button>
        </div>

        {/* Footer actions */}
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 w-full sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
};
