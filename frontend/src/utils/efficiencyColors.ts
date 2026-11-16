import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

export interface ColorThreshold {
  min: number;
  color: string;
  label: string;
}

const DEFAULT_THRESHOLDS: ColorThreshold[] = [
  { min: 90, color: '#22c55e', label: 'Excellent' },
  { min: 80, color: '#eab308', label: 'Good' },
  { min: 70, color: '#f97316', label: 'Average' },
  { min: 0, color: '#ef4444', label: 'Low' },
];

let cachedThresholds: ColorThreshold[] | null = null;
let fetchPromise: Promise<ColorThreshold[]> | null = null;

export async function loadEfficiencyThresholds(): Promise<ColorThreshold[]> {
  if (cachedThresholds) return cachedThresholds;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/dashboard-settings`);
      const json = await res.json();
      if (json.success && json.data?.efficiency_colors?.thresholds) {
        cachedThresholds = json.data.efficiency_colors.thresholds;
        return cachedThresholds!;
      }
    } catch { /* use defaults */ }
    cachedThresholds = DEFAULT_THRESHOLDS;
    return cachedThresholds;
  })();
  return fetchPromise;
}

export function clearEfficiencyCache() {
  cachedThresholds = null;
  fetchPromise = null;
}

/**
 * Get the color for a given efficiency percentage.
 * Uses cached thresholds (call loadEfficiencyThresholds first).
 * Falls back to defaults if not loaded.
 */
export function getEfficiencyColor(pct: number): string {
  const thresholds = cachedThresholds || DEFAULT_THRESHOLDS;
  const sorted = [...thresholds].sort((a, b) => b.min - a.min);
  for (const t of sorted) {
    if (pct >= t.min) return t.color;
  }
  return sorted[sorted.length - 1]?.color || '#ef4444';
}

/**
 * Get Tailwind-compatible class names for efficiency.
 * Maps hex colors to closest Tailwind classes.
 */
export function getEfficiencyTailwindClass(pct: number): string {
  const color = getEfficiencyColor(pct);
  const map: Record<string, string> = {
    '#22c55e': 'text-green-500',
    '#16a34a': 'text-green-600',
    '#eab308': 'text-yellow-500',
    '#f97316': 'text-orange-500',
    '#ef4444': 'text-red-500',
    '#dc2626': 'text-red-600',
    '#3b82f6': 'text-blue-500',
    '#8b5cf6': 'text-purple-500',
    '#06b6d4': 'text-cyan-500',
    '#ec4899': 'text-pink-500',
  };
  return map[color] || 'text-gray-600';
}

export function getEfficiencyBgClass(pct: number): string {
  const color = getEfficiencyColor(pct);
  const map: Record<string, string> = {
    '#22c55e': 'bg-green-500',
    '#16a34a': 'bg-green-600',
    '#eab308': 'bg-yellow-500',
    '#f97316': 'bg-orange-500',
    '#ef4444': 'bg-red-500',
    '#dc2626': 'bg-red-600',
    '#3b82f6': 'bg-blue-500',
    '#8b5cf6': 'bg-purple-500',
    '#06b6d4': 'bg-cyan-500',
    '#ec4899': 'bg-pink-500',
  };
  return map[color] || 'bg-gray-500';
}
