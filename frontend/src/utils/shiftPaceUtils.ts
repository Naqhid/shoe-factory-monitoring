/** Shift pace helpers (9:00–17:30, lunch excluded) — shared by mobile and TV dashboards. */

const FRIDAY_INDEX = 5;
const DEFAULT_LUNCH_START_MINUTES = 13 * 60 + 30;
const DEFAULT_LUNCH_END_MINUTES = 14 * 60;
const FRIDAY_LUNCH_START_MINUTES = 12 * 60 + 30;
const FRIDAY_LUNCH_END_MINUTES = 13 * 60;

export const SHIFT_START_MINUTES = 9 * 60;
export const SHIFT_END_MINUTES = 17 * 60 + 30;
export const DEFAULT_PAIRS_PER_BIN = 6;

const getLunchBoundsMs = (d: Date) => {
  const isFriday = d.getDay() === FRIDAY_INDEX;
  const lunchS = isFriday ? FRIDAY_LUNCH_START_MINUTES : DEFAULT_LUNCH_START_MINUTES;
  const lunchE = isFriday ? FRIDAY_LUNCH_END_MINUTES : DEFAULT_LUNCH_END_MINUTES;
  const ls = new Date(d);
  ls.setHours(Math.floor(lunchS / 60), lunchS % 60, 0, 0);
  const le = new Date(d);
  le.setHours(Math.floor(lunchE / 60), lunchE % 60, 0, 0);
  return { lunchStartMs: ls.getTime(), lunchEndMs: le.getTime() };
};

const productiveMinutesExcludingLunch = (day: Date, rangeStartMs: number, rangeEndMs: number) => {
  if (rangeEndMs <= rangeStartMs) return 0;
  const rawMin = (rangeEndMs - rangeStartMs) / 60000;
  const { lunchStartMs, lunchEndMs } = getLunchBoundsMs(day);
  const overlapStart = Math.max(rangeStartMs, lunchStartMs);
  const overlapEnd = Math.min(rangeEndMs, lunchEndMs);
  const lunchOverlapMin = overlapEnd > overlapStart ? (overlapEnd - overlapStart) / 60000 : 0;
  return Math.max(0, rawMin - lunchOverlapMin);
};

const getProductiveElapsedMinutesInShift = (now: Date, shiftStartMin: number, shiftEndMin: number) => {
  const shiftStart = new Date(now);
  shiftStart.setHours(Math.floor(shiftStartMin / 60), shiftStartMin % 60, 0, 0);
  const shiftEnd = new Date(now);
  shiftEnd.setHours(Math.floor(shiftEndMin / 60), shiftEndMin % 60, 0, 0);
  const t = Math.min(now.getTime(), shiftEnd.getTime());
  const startMs = shiftStart.getTime();
  if (t <= startMs) return 0;
  return productiveMinutesExcludingLunch(now, startMs, t);
};

export const getProductiveShiftTotals = (now: Date) => {
  const shiftStart = new Date(now);
  shiftStart.setHours(Math.floor(SHIFT_START_MINUTES / 60), SHIFT_START_MINUTES % 60, 0, 0);
  const shiftEnd = new Date(now);
  shiftEnd.setHours(Math.floor(SHIFT_END_MINUTES / 60), SHIFT_END_MINUTES % 60, 0, 0);
  const totalProductiveMins = productiveMinutesExcludingLunch(
    now,
    shiftStart.getTime(),
    shiftEnd.getTime()
  );
  const elapsedProductiveMins = getProductiveElapsedMinutesInShift(
    now,
    SHIFT_START_MINUTES,
    SHIFT_END_MINUTES
  );
  const remainingProductiveMins = Math.max(0, totalProductiveMins - elapsedProductiveMins);
  const elapsedPct =
    totalProductiveMins > 0
      ? Math.round((elapsedProductiveMins / totalProductiveMins) * 100)
      : 0;
  return {
    totalProductiveMins,
    elapsedProductiveMins,
    remainingProductiveMins,
    elapsedPct,
  };
};

export const computeShiftTargetPairs = (
  targetMinsPerBin: number,
  pairsPerBin: number,
  totalProductiveMins: number
) => {
  if (targetMinsPerBin <= 0 || pairsPerBin <= 0 || totalProductiveMins <= 0) return 0;
  return Math.round((totalProductiveMins / targetMinsPerBin) * pairsPerBin);
};

export interface MachinePaceSnapshot {
  machineId: string;
  machineName: string;
  actual: number;
  expected: number;
  daily: number;
  projectedEod: number;
  shortBy: number;
  remainingMins: number;
  onTrack: boolean;
  hasRouting: boolean;
}

export function buildMachinePaceSnapshot(
  machineId: string,
  machineName: string,
  actualOutput: number,
  targetMinsPerBin: number,
  now: Date,
  pairsPerBin = DEFAULT_PAIRS_PER_BIN
): MachinePaceSnapshot {
  const actual = Math.round(Number(actualOutput) || 0);
  const minsPerBin = Number(targetMinsPerBin) || 0;
  const { totalProductiveMins, remainingProductiveMins, elapsedProductiveMins } =
    getProductiveShiftTotals(now);

  if (minsPerBin <= 0 || totalProductiveMins <= 0) {
    return {
      machineId,
      machineName,
      actual,
      expected: 0,
      daily: 0,
      projectedEod: 0,
      shortBy: 0,
      remainingMins: Math.round(remainingProductiveMins),
      onTrack: true,
      hasRouting: false,
    };
  }

  const daily = computeShiftTargetPairs(minsPerBin, pairsPerBin, totalProductiveMins);
  const elapsedMins = Math.max(0, elapsedProductiveMins);
  const expected =
    elapsedMins > 0 && daily > 0
      ? Math.round((daily * elapsedMins) / totalProductiveMins)
      : 0;
  const projectedEod =
    elapsedMins > 0 ? Math.round((actual / elapsedMins) * totalProductiveMins) : 0;
  const onTrack = projectedEod >= daily;
  const shortBy = onTrack ? 0 : Math.max(0, daily - projectedEod);

  return {
    machineId,
    machineName,
    actual,
    expected,
    daily,
    projectedEod,
    shortBy,
    remainingMins: Math.round(remainingProductiveMins),
    onTrack,
    hasRouting: daily > 0,
  };
}
