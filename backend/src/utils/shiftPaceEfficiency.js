/**
 * Shift pace efficiency — actual output vs expected pace (matches frontend shiftPaceUtils).
 * Efficiency % = round((actual / expected) * 100) where expected is prorated shift target to now.
 */

const FRIDAY_INDEX = 5;
const DEFAULT_LUNCH_START_MINUTES = 13 * 60 + 30;
const DEFAULT_LUNCH_END_MINUTES = 14 * 60;
const FRIDAY_LUNCH_START_MINUTES = 12 * 60 + 30;
const FRIDAY_LUNCH_END_MINUTES = 13 * 60;

const SHIFT_START_MINUTES = 9 * 60 + 5;
const SHIFT_END_MINUTES = 17 * 60 + 35;
const DEFAULT_PAIRS_PER_BIN = 6;

const productiveMinutesExcludingLunch = (day, rangeStartMs, rangeEndMs) => {
  if (rangeEndMs <= rangeStartMs) return 0;
  const rawMin = (rangeEndMs - rangeStartMs) / 60000;
  const isFriday = day.getDay() === FRIDAY_INDEX;
  const lunchS = isFriday ? FRIDAY_LUNCH_START_MINUTES : DEFAULT_LUNCH_START_MINUTES;
  const lunchE = isFriday ? FRIDAY_LUNCH_END_MINUTES : DEFAULT_LUNCH_END_MINUTES;
  const ls = new Date(day);
  ls.setHours(Math.floor(lunchS / 60), lunchS % 60, 0, 0);
  const le = new Date(day);
  le.setHours(Math.floor(lunchE / 60), lunchE % 60, 0, 0);
  const overlapStart = Math.max(rangeStartMs, ls.getTime());
  const overlapEnd = Math.min(rangeEndMs, le.getTime());
  const lunchOverlapMin = overlapEnd > overlapStart ? (overlapEnd - overlapStart) / 60000 : 0;
  return Math.max(0, rawMin - lunchOverlapMin);
};

const getProductiveElapsedMinutesInShift = (now, shiftStartMin, shiftEndMin) => {
  const shiftStart = new Date(now);
  shiftStart.setHours(Math.floor(shiftStartMin / 60), shiftStartMin % 60, 0, 0);
  const shiftEnd = new Date(now);
  shiftEnd.setHours(Math.floor(shiftEndMin / 60), shiftEndMin % 60, 0, 0);
  const t = Math.min(now.getTime(), shiftEnd.getTime());
  const startMs = shiftStart.getTime();
  if (t <= startMs) return 0;
  return productiveMinutesExcludingLunch(now, startMs, t);
};

const getProductiveShiftTotals = (now) => {
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
  return { totalProductiveMins, elapsedProductiveMins };
};

/** Local calendar date YYYY-MM-DD (avoids UTC drift from MySQL DATE → JS Date). */
function toLocalDateStr(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

/** Reference instant for pace on a production date (today = now, past = end of shift). */
function referenceNowForProdDate(prodDateStr, clockNow = new Date()) {
  const dayStr = toLocalDateStr(prodDateStr);
  const todayStr = toLocalDateStr(clockNow);
  if (!dayStr) return clockNow;
  if (dayStr < todayStr) {
    const d = new Date(clockNow);
    const [y, m, day] = dayStr.split('-').map(Number);
    d.setFullYear(y, m - 1, day);
    d.setHours(Math.floor(SHIFT_END_MINUTES / 60), SHIFT_END_MINUTES % 60, 0, 0);
    return d;
  }
  if (dayStr > todayStr) {
    const d = new Date(clockNow);
    const [y, m, day] = dayStr.split('-').map(Number);
    d.setFullYear(y, m - 1, day);
    d.setHours(Math.floor(SHIFT_START_MINUTES / 60), SHIFT_START_MINUTES % 60, 0, 0);
    return d;
  }
  return clockNow;
}

/**
 * Same pace snapshot as frontend buildMachinePaceSnapshot / TV dashboard cards.
 */
function buildPaceSnapshot(
  actualOutput,
  routingMinsPerBin,
  pairsPerBin = DEFAULT_PAIRS_PER_BIN,
  prodDateStr,
  clockNow = new Date()
) {
  const refNow = referenceNowForProdDate(prodDateStr, clockNow);
  const { totalProductiveMins, elapsedProductiveMins } = getProductiveShiftTotals(refNow);
  const actual = Math.round(Number(actualOutput) || 0);
  const minsPerBin = Number(routingMinsPerBin) || 0;
  if (minsPerBin <= 0 || totalProductiveMins <= 0) {
    return { actual, expected: 0, daily: 0, pacePct: 0 };
  }
  const daily = Math.round((totalProductiveMins / minsPerBin) * pairsPerBin);
  const elapsedMins = Math.max(0, elapsedProductiveMins);
  const expected =
    elapsedMins > 0 && daily > 0
      ? Math.round((daily * elapsedMins) / totalProductiveMins)
      : 0;
  const pacePct = expected > 0 ? Math.round((actual / expected) * 100) : 0;
  return { actual, expected, daily, pacePct };
}

/**
 * Pace efficiency %: actual output vs in-progress expected (matches TV Eff % circle).
 */
function computePaceEfficiencyPercent(
  actualOutput,
  routingMinsPerBin,
  pairsPerBin = DEFAULT_PAIRS_PER_BIN,
  prodDateStr,
  clockNow = new Date()
) {
  return buildPaceSnapshot(
    actualOutput,
    routingMinsPerBin,
    pairsPerBin,
    prodDateStr,
    clockNow
  ).pacePct;
}

function performanceGradeFromPaceEfficiency(pct) {
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Good';
  if (pct >= 60) return 'Average';
  return 'Below Target';
}

function routingMapKey(workCentreId, planDate, machineId) {
  return `${workCentreId}|${toLocalDateStr(planDate)}|${String(machineId ?? '').trim()}`;
}

module.exports = {
  buildPaceSnapshot,
  computePaceEfficiencyPercent,
  performanceGradeFromPaceEfficiency,
  routingMapKey,
  referenceNowForProdDate,
  toLocalDateStr,
  getProductiveShiftTotals,
};
