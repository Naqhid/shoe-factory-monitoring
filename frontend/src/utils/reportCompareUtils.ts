/** Period compare helpers for Hourly Production & Line Efficiency reports. */

export type ReportCompareMode = 'none' | 'yesterday' | 'last_week' | 'both';

export const COMPARE_METRICS = ['total_output', 'output_percent', 'efficiency_percent'] as const;
export type CompareMetricKey = (typeof COMPARE_METRICS)[number];

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const parts = String(dateKey).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dateKey;
  const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function rowDateKey(date: unknown): string {
  if (!date) return '';
  const s = String(date);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function hourlyCompareKey(row: { date?: unknown; work_centre_id?: unknown; line?: unknown }) {
  const wc = row.work_centre_id != null && row.work_centre_id !== '' ? String(row.work_centre_id) : String(row.line ?? '');
  return `${rowDateKey(row.date)}|${wc}`;
}

export function lineEffCompareKey(row: {
  date?: unknown;
  work_centre_id?: unknown;
  machine_id?: unknown;
}) {
  return `${rowDateKey(row.date)}|${row.work_centre_id ?? ''}|${row.machine_id ?? ''}`;
}

/** Index compare rows so they align to "current" period dates (shiftDaysForward = 1 for yesterday data). */
export function indexCompareRows<T extends { date?: unknown }>(
  rows: T[],
  keyFn: (row: T) => string,
  shiftDaysForward: number
): Map<string, T> {
  const map = new Map<string, T>();
  rows.forEach((row) => {
    const aligned = {
      ...row,
      date: addDaysToDateKey(rowDateKey(row.date), shiftDaysForward),
    };
    map.set(keyFn(aligned), row);
  });
  return map;
}

export function numCompare(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export type CompareDelta = {
  delta: number;
  pct: number | null;
  hasPrevious: boolean;
};

export function computeCompareDelta(current: unknown, previous: unknown): CompareDelta {
  const cur = numCompare(current);
  const prev = numCompare(previous);
  const hasPrevious = previous !== null && previous !== undefined && previous !== '';
  if (!hasPrevious) return { delta: 0, pct: null, hasPrevious: false };
  const delta = cur - prev;
  const pct =
    prev !== 0 ? Math.round((delta / prev) * 100) : cur > 0 ? 100 : prev < 0 ? -100 : 0;
  return { delta, pct, hasPrevious: true };
}

export function comparePeriodLabel(mode: 'yesterday' | 'last_week'): string {
  return mode === 'yesterday' ? 'yest' : 'last wk';
}

export function comparePeriodHeaderLabel(mode: 'yesterday' | 'last_week'): string {
  return mode === 'yesterday' ? 'Yesterday' : 'Last week';
}
