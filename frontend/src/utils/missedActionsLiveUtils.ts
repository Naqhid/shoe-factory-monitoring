import { minutesToDurationParts } from './formatCycleDuration';
import { DEFAULT_PAIRS_PER_BIN, getProductiveShiftTotals } from './shiftPaceUtils';

export type MissedActionLike = {
  issue_key: string;
  machine_id?: string;
  machine_name?: string;
  work_centre_id?: number | null;
  work_centre_name?: string;
  action_type: 'START_PENDING' | 'FINISH_PENDING';
  overdue_mins: number;
  target_mins?: number;
};

export function formatOverdueLabel(mins: number): string {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  if (m < 60) return `${m}m overdue`;
  const { wholeMinutes, seconds } = minutesToDurationParts(m);
  const hours = Math.floor(wholeMinutes / 60);
  const rem = wholeMinutes % 60;
  if (hours > 0 && rem === 0 && seconds === 0) return `${hours}h overdue`;
  if (hours > 0) return `${hours}h ${rem}m overdue`;
  return `${wholeMinutes}m overdue`;
}

/** Higher = fix sooner. Weights live overdue with machine time-loss impact. */
export function getFixFirstScore(
  item: MissedActionLike,
  machineLossMins: number
): number {
  const overdue = Math.max(0, Number(item.overdue_mins) || 0);
  const loss = Math.max(overdue, Number(machineLossMins) || 0);
  const finishBoost = item.action_type === 'FINISH_PENDING' ? 1.15 : 1;
  return Math.round(loss * finishBoost * (1 + overdue / 120));
}

export function estimateRecoveryPairs(item: MissedActionLike, now = new Date()): number | null {
  const targetMins = Number(item.target_mins || 0);
  if (targetMins <= 0) return null;
  const { remainingProductiveMins } = getProductiveShiftTotals(now);
  if (remainingProductiveMins <= 0) return 0;
  if (item.action_type === 'FINISH_PENDING') {
    return Math.max(0, Math.floor(DEFAULT_PAIRS_PER_BIN / 2));
  }
  const cyclesLeft = Math.floor(remainingProductiveMins / targetMins);
  return Math.max(0, cyclesLeft * DEFAULT_PAIRS_PER_BIN);
}

export function formatRecoveryHint(item: MissedActionLike, now = new Date()): string | null {
  const pairs = estimateRecoveryPairs(item, now);
  if (pairs == null) return null;
  if (pairs <= 0) return 'Shift window nearly closed — act immediately';
  if (item.action_type === 'FINISH_PENDING') {
    return `Finish now — ~${pairs} pairs still on the table today`;
  }
  return `~${pairs} pairs still possible today if started now`;
}

export function formatTimeLossLabel(mins: number): string {
  const { wholeMinutes, seconds } = minutesToDurationParts(mins);
  if (wholeMinutes >= 60) {
    const h = Math.floor(wholeMinutes / 60);
    const m = wholeMinutes % 60;
    return m > 0 || seconds > 0 ? `${h}h ${m}m lost` : `${h}h lost`;
  }
  if (wholeMinutes === 0) return `${seconds}s lost`;
  if (seconds === 0) return `${wholeMinutes}m lost`;
  return `${wholeMinutes}m ${seconds}s lost`;
}
