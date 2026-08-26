import { computeShiftTargetPairs, getProductiveShiftTotals } from '../utils/shiftPaceUtils';

export type CalcField =
  | 'normal_time_secs_pr'
  | 'std_time_secs_pr'
  | 'mins_6_prs_box'
  | 'pairs_per_hr'
  | 'pairs_per_day';

export interface RoutingLine {
  _rowId?: number;
  machine_centre_id: string;
  machine_name: string;
  process: string;
  observed_time: string;
  base_observed_time: string;
  rating_factor: string;
  normal_time_secs_pr: string;
  std_time_secs_pr: string;
  mins_6_prs_box: string;
  pairs_per_hr: string;
  pairs_per_day: string;
  manpower: string;
  _lockedCalcFields?: CalcField[];
}

export const CALC_FIELDS: CalcField[] = [
  'normal_time_secs_pr',
  'std_time_secs_pr',
  'mins_6_prs_box',
  'pairs_per_hr',
  'pairs_per_day',
];

export const calculateLineValues = (line: RoutingLine) => {
  const baseObserved = parseFloat(line.base_observed_time || line.observed_time) || 0;
  const ratingFactor = parseFloat(line.rating_factor) || 0;
  const manpower = Math.round((parseFloat(line.manpower) || 1) * 10) / 10;

  const effectiveObserved = baseObserved * manpower;
  const normalTimeSecs = (effectiveObserved * ratingFactor) / 100;
  const stdTimeSecs = normalTimeSecs * 1.15;
  const mins6Prs = Math.round(((stdTimeSecs * 6) / 60) * 10) / 10;
  const { totalProductiveMins } = getProductiveShiftTotals(new Date());
  const pairsPerDay = computeShiftTargetPairs(mins6Prs, 6, totalProductiveMins);
  const pairsPerHr =
    totalProductiveMins > 0 && pairsPerDay > 0
      ? Math.round((pairsPerDay / totalProductiveMins) * 60)
      : 0;

  return {
    observed_time: Math.round(effectiveObserved * 100) / 100,
    normal_time_secs_pr: Math.round(normalTimeSecs),
    std_time_secs_pr: Math.round(stdTimeSecs),
    mins_6_prs_box: mins6Prs,
    pairs_per_hr: pairsPerHr,
    pairs_per_day: pairsPerDay,
    manpower,
  };
};

export const calcToLineFields = (calc: ReturnType<typeof calculateLineValues>) => ({
  observed_time: String(calc.observed_time),
  normal_time_secs_pr: String(calc.normal_time_secs_pr),
  std_time_secs_pr: String(calc.std_time_secs_pr),
  mins_6_prs_box: calc.mins_6_prs_box.toFixed(1),
  pairs_per_hr: String(calc.pairs_per_hr),
  pairs_per_day: String(calc.pairs_per_day),
});

export const applyAutoCalc = (line: RoutingLine): RoutingLine => {
  const calc = calculateLineValues(line);
  const fields = calcToLineFields(calc);
  const lockedSet = new Set(line._lockedCalcFields || []);
  const next = { ...line };
  for (const key of CALC_FIELDS) {
    if (!lockedSet.has(key)) {
      next[key] = fields[key];
    }
  }
  return next;
};
