import { computeCycleNetLostMins } from './cycleLostMins';
import { minutesToDurationParts } from './formatCycleDuration';
import { SHIFT_START_MINUTES, SHIFT_END_MINUTES } from './shiftPaceUtils';

const LATE_CYCLE_GRACE_MINS = 0;

export type ProdQuickFilter =
  | 'all'
  | 'in_progress'
  | 'late'
  | 'suspicious'
  | 'no_output'
  | 'operator_changed';

export type ProdAnomalyCode =
  | 'eff_low'
  | 'eff_high'
  | 'duration_short'
  | 'duration_long'
  | 'zero_output'
  | 'missing_finish'
  | 'invalid_times';

export interface ProdCycleMetrics {
  durationMins: number | null;
  efficiencyPct: number | null;
  startGapMins: number;
  inactiveMins: number;
  extraMins: number;
  netLostMins: number;
  anomalies: ProdAnomalyCode[];
  isLate: boolean;
  isSuspicious: boolean;
  cycleNumber: number;
  operatorChanged: boolean;
  /** First cycle on this machine today — gap since shift start is not cycle loss. */
  isFirstCycle: boolean;
}

/** Human-readable duration, e.g. "1m 6s", "4h 14m". */
export function formatReadableDuration(mins: number): string {
  if (!Number.isFinite(mins) || mins * 60 < 1) return '0s';
  const { wholeMinutes, seconds } = minutesToDurationParts(mins);
  if (wholeMinutes >= 60) {
    const hours = Math.floor(wholeMinutes / 60);
    const remMin = wholeMinutes % 60;
    if (remMin === 0 && seconds === 0) return `${hours}h`;
    if (seconds === 0) return `${hours}h ${remMin}m`;
    return `${hours}h ${remMin}m ${seconds}s`;
  }
  if (wholeMinutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${wholeMinutes}m`;
  return `${wholeMinutes}m ${seconds}s`;
}

const ANOMALY_LABELS: Record<ProdAnomalyCode, string> = {
  eff_low: 'Low eff',
  eff_high: 'High eff',
  duration_short: 'Very short',
  duration_long: 'Slow cycle',
  zero_output: 'No output',
  missing_finish: 'No finish',
  invalid_times: 'Bad times',
};

export const PROD_QUICK_FILTERS: Array<{ id: ProdQuickFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'late', label: 'Late cycles' },
  { id: 'suspicious', label: 'Suspicious' },
  { id: 'no_output', label: 'No output' },
  { id: 'operator_changed', label: 'Op. changed' },
];

const overlapMinutes = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return (end - start) / 60000;
};

/** Idle gap before START; lunch excluded, no start grace (matches backend time loss). */
export function computeCycleInactiveMins(baselineTs: Date | null, startTs: Date | null): number {
  if (!baselineTs || !startTs) return 0;
  if (!Number.isFinite(startTs.getTime()) || !Number.isFinite(baselineTs.getTime())) return 0;

  const shiftStart = new Date(startTs);
  shiftStart.setHours(Math.floor(SHIFT_START_MINUTES / 60), SHIFT_START_MINUTES % 60, 0, 0);
  const shiftEnd = new Date(startTs);
  shiftEnd.setHours(Math.floor(SHIFT_END_MINUTES / 60), SHIFT_END_MINUTES % 60, 0, 0);

  const isFriday = startTs.getDay() === 5;
  const lunchStartMin = isFriday ? 12 * 60 + 30 : 13 * 60 + 30;
  const lunchEndMin = isFriday ? 13 * 60 : 14 * 60;
  const lunchStart = new Date(startTs);
  lunchStart.setHours(Math.floor(lunchStartMin / 60), lunchStartMin % 60, 0, 0);
  const lunchEnd = new Date(startTs);
  lunchEnd.setHours(Math.floor(lunchEndMin / 60), lunchEndMin % 60, 0, 0);

  const effectiveStart = new Date(Math.max(baselineTs.getTime(), shiftStart.getTime()));
  const effectiveEnd = new Date(Math.min(startTs.getTime(), shiftEnd.getTime()));
  if (effectiveEnd <= effectiveStart) return 0;

  const rawGapMins = (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000;
  const lunchOverlapMins = overlapMinutes(effectiveStart, effectiveEnd, lunchStart, lunchEnd);
  const gapExcludingLunch = Math.max(0, rawGapMins - lunchOverlapMins);

  return Math.max(0, gapExcludingLunch - LATE_CYCLE_GRACE_MINS);
}

export function capEfficiencyPct(raw: number | null): number | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  return Math.min(999, Math.max(0, Math.round(raw)));
}

export function getAnomalyLabel(code: ProdAnomalyCode): string {
  return ANOMALY_LABELS[code];
}

export function isProdCycleActive(status: number): boolean {
  return status === 0 || status === 1;
}

export function calcProdDurationMins(
  start: string,
  finish: string,
  status: number,
  now = new Date()
): number | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = isProdCycleActive(status)
    ? now.getTime()
    : finish
      ? new Date(finish).getTime()
      : NaN;
  if (Number.isNaN(endMs)) return null;
  const mins = Math.round(((endMs - startMs) / 60000) * 10) / 10;
  return Number.isFinite(mins) && mins >= 0 ? mins : null;
}

export function calcProdEfficiency(
  targetMins: number,
  start: string,
  finish: string,
  status = 2,
  now = new Date()
): number | null {
  const actual = calcProdDurationMins(start, finish, status, now);
  if (!actual || actual === 0 || !targetMins) return null;
  return capEfficiencyPct(Math.round((targetMins / actual) * 100));
}

function shiftStartForDate(startTs: Date): Date {
  const shiftStart = new Date(startTs);
  shiftStart.setHours(Math.floor(SHIFT_START_MINUTES / 60), SHIFT_START_MINUTES % 60, 0, 0);
  return shiftStart;
}

function detectAnomalies(input: {
  status: number;
  durationMins: number | null;
  efficiencyPct: number | null;
  rawEfficiencyPct: number | null;
  outputPairs: number;
  start: string;
  finish: string;
}): ProdAnomalyCode[] {
  const codes: ProdAnomalyCode[] = [];
  const active = isProdCycleActive(input.status);

  if (!input.start) codes.push('invalid_times');
  if (!active) {
    if (!input.finish) codes.push('missing_finish');
    if (input.start && input.finish) {
      const startMs = new Date(input.start).getTime();
      const finishMs = new Date(input.finish).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(finishMs) && finishMs < startMs) {
        codes.push('invalid_times');
      }
    }
    if (Number(input.outputPairs) <= 0) codes.push('zero_output');
  }

  if (input.durationMins !== null && !active && input.durationMins < 0.5) {
    codes.push('duration_short');
  }

  if (!active && input.rawEfficiencyPct !== null) {
    if (input.rawEfficiencyPct < 50) codes.push('eff_low');
    if (input.rawEfficiencyPct > 150) codes.push('eff_high');
  }

  return codes;
}

export interface ProdCycleContext {
  prevFinishTime: string | null;
  cycleNumber: number;
  operatorChanged: boolean;
}

export function analyzeProdCycle(
  row: {
    id?: number;
    button_status?: number;
    start_time?: string;
    finish_time?: string;
    target_mins?: number;
    output_pairs?: number;
  },
  ctx: ProdCycleContext,
  now = new Date()
): ProdCycleMetrics {
  const status = Number(row.button_status ?? 0);
  const targetMins = Number(row.target_mins || 0);
  const start = String(row.start_time || '');
  const finish = String(row.finish_time || '');
  const durationMins = calcProdDurationMins(start, finish, status, now);

  let rawEff: number | null = null;
  if (!isProdCycleActive(status) && durationMins && durationMins > 0 && targetMins > 0) {
    rawEff = Math.round((targetMins / durationMins) * 100);
  }
  const efficiencyPct = rawEff !== null ? capEfficiencyPct(rawEff) : null;

  const isFirstCycle = !ctx.prevFinishTime;
  const startTs = start ? new Date(start) : null;
  const baselineTs = ctx.prevFinishTime
    ? new Date(ctx.prevFinishTime)
    : startTs
      ? shiftStartForDate(startTs)
      : null;
  const startGapMins =
    baselineTs && startTs && Number.isFinite(baselineTs.getTime()) && Number.isFinite(startTs.getTime())
      ? Math.max(0, Math.round(((startTs.getTime() - baselineTs.getTime()) / 60000) * 10) / 10)
      : 0;
  const inactiveMins =
    startTs && !isFirstCycle ? computeCycleInactiveMins(baselineTs, startTs) : 0;
  const actualMins = durationMins ?? 0;
  const extraMins = Math.max(0, Math.round((actualMins - targetMins) * 10) / 10);
  const netLostMins = isProdCycleActive(status)
    ? 0
    : isFirstCycle
      ? extraMins
      : Math.round(computeCycleNetLostMins(inactiveMins, targetMins, actualMins) * 10) / 10;

  const anomalies = detectAnomalies({
    status,
    durationMins,
    efficiencyPct,
    rawEfficiencyPct: rawEff,
    outputPairs: Number(row.output_pairs || 0),
    start,
    finish,
  });

  if (!isProdCycleActive(status) && targetMins > 0 && durationMins !== null && durationMins > targetMins * 3) {
    anomalies.push('duration_long');
  }

  const isLate = !isProdCycleActive(status) && (netLostMins >= 1 || (!isFirstCycle && inactiveMins >= 1));
  const isSuspicious = anomalies.length > 0;

  return {
    durationMins,
    efficiencyPct,
    startGapMins,
    inactiveMins: Math.round(inactiveMins * 10) / 10,
    extraMins,
    netLostMins,
    anomalies,
    isLate,
    isSuspicious,
    cycleNumber: ctx.cycleNumber,
    operatorChanged: ctx.operatorChanged,
    isFirstCycle,
  };
}

/** Build per-row context: cycle #, prev finish, operator-changed flag. */
export function buildProdCycleContextMap(rows: any[]): Map<number, ProdCycleContext> {
  const sorted = [...rows].sort((a, b) => {
    const ma = String(a.machine_id).localeCompare(String(b.machine_id), undefined, { numeric: true });
    if (ma !== 0) return ma;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  const map = new Map<number, ProdCycleContext>();
  const machineState = new Map<string, { prevFinish: string | null; cycleNum: number; prevEmp: string | null }>();

  sorted.forEach((row) => {
    const mid = String(row.machine_id);
    const state = machineState.get(mid) ?? { prevFinish: null, cycleNum: 0, prevEmp: null };
    state.cycleNum += 1;
    const emp = String(row.emp_id || '');
    const operatorChanged = state.prevEmp !== null && emp !== state.prevEmp;
    map.set(Number(row.id), {
      prevFinishTime: state.prevFinish,
      cycleNumber: state.cycleNum,
      operatorChanged,
    });
    if (Number(row.button_status) === 2 && row.finish_time) {
      state.prevFinish = String(row.finish_time);
    }
    state.prevEmp = emp;
    machineState.set(mid, state);
  });

  return map;
}

export function matchesProdQuickFilter(
  filter: ProdQuickFilter,
  row: { button_status?: number; output_pairs?: number },
  metrics: ProdCycleMetrics
): boolean {
  if (filter === 'all') return true;
  const status = Number(row.button_status ?? 0);
  if (filter === 'in_progress') return isProdCycleActive(status);
  if (filter === 'late') return metrics.isLate;
  if (filter === 'suspicious') return metrics.isSuspicious;
  if (filter === 'no_output') return !isProdCycleActive(status) && Number(row.output_pairs || 0) <= 0;
  if (filter === 'operator_changed') return metrics.operatorChanged;
  return true;
}

export function formatLossBreakdown(metrics: ProdCycleMetrics, isActive = false): string {
  if (isActive) return 'Running';
  if (metrics.isFirstCycle) {
    if (metrics.extraMins >= 1) {
      return `Slow finish · ${formatReadableDuration(metrics.extraMins)}`;
    }
    return 'First cycle · on time';
  }
  if (metrics.netLostMins < 1 && metrics.inactiveMins < 0.01 && metrics.extraMins < 0.01) {
    return 'On time';
  }
  if (metrics.inactiveMins >= 1 && metrics.extraMins >= 1) {
    return `${formatReadableDuration(metrics.netLostMins)} lost · late start + slow`;
  }
  if (metrics.inactiveMins >= 1) {
    return `Late start · ${formatReadableDuration(metrics.inactiveMins)}`;
  }
  if (metrics.extraMins >= 1) {
    return `Slow finish · ${formatReadableDuration(metrics.extraMins)}`;
  }
  if (metrics.netLostMins >= 1) {
    return `${formatReadableDuration(metrics.netLostMins)} lost`;
  }
  return 'On time';
}

/** Optional subtitle for first cycle — shift idle before production began. */
export function formatFirstCycleShiftNote(metrics: ProdCycleMetrics): string | null {
  if (!metrics.isFirstCycle || metrics.startGapMins < 5) return null;
  return `${formatReadableDuration(metrics.startGapMins)} after shift start`;
}
