/**
 * Net minutes lost on one cycle: late-start gap minus under-target savings, plus over-target time.
 * Example: 2m late + 1m under target => 1m lost; 6m late + 6.5m under target => 0m lost.
 */
export function computeCycleNetLostMins(
  inactiveMins: number,
  targetMins: number,
  actualMins: number
): number {
  const late = Math.max(0, Number(inactiveMins) || 0);
  const target = Math.max(0, Number(targetMins) || 0);
  const actual = Math.max(0, Number(actualMins) || 0);
  const earlySave = Math.max(0, target - actual);
  const slowExtra = Math.max(0, actual - target);
  return Math.max(0, late - earlySave) + slowExtra;
}

export type LateCycleCategory = 'net_loss' | 'on_time' | 'net_gain';

export function classifyLateCycleCategory(input: {
  start_gap_mins: number;
  extra_mins: number;
  target_mins: number;
  actual_mins: number;
}): LateCycleCategory {
  const hasIssue =
    Number(input.start_gap_mins || 0) > 0.01 || Number(input.extra_mins || 0) > 0.01;
  if (!hasIssue) return 'on_time';
  const netSecs = computeCycleNetLostMins(
    input.start_gap_mins,
    input.target_mins,
    input.actual_mins
  ) * 60;
  if (netSecs >= 1) return 'net_loss';
  return 'net_gain';
}
