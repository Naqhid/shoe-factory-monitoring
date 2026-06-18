'use strict';

const { getProductiveShiftTotals } = require('./shiftPaceEfficiency');

const PAIRS_PER_BIN = 6;

function computeRoutingLineDerived(line = {}) {
  const observedTime = Number(line.observed_time) || 0;
  const ratingFactor = Number(line.rating_factor) || 0;

  const normalTimeSecs = (observedTime * ratingFactor) / 100;
  const stdTimeSecs = normalTimeSecs * 1.15;
  const mins6Prs = Math.round(((stdTimeSecs * PAIRS_PER_BIN) / 60) * 10) / 10;

  const { totalProductiveMins } = getProductiveShiftTotals(new Date());
  const pairsPerDay =
    mins6Prs > 0 && totalProductiveMins > 0
      ? Math.round((totalProductiveMins / mins6Prs) * PAIRS_PER_BIN)
      : 0;
  const pairsPerHr =
    totalProductiveMins > 0 && pairsPerDay > 0
      ? Math.round((pairsPerDay / totalProductiveMins) * 60)
      : 0;

  return {
    normal_time_secs_pr: Math.round(normalTimeSecs),
    std_time_secs_pr: Math.round(stdTimeSecs),
    mins_6_prs_box: mins6Prs,
    pairs_per_hr: pairsPerHr,
    pairs_per_day: pairsPerDay,
  };
}

function pickFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveRoutingLineDerived(line = {}) {
  const auto = computeRoutingLineDerived(line);
  return {
    normal_time_secs_pr: pickFiniteNumber(line.normal_time_secs_pr, auto.normal_time_secs_pr),
    std_time_secs_pr: pickFiniteNumber(line.std_time_secs_pr, auto.std_time_secs_pr),
    mins_6_prs_box: pickFiniteNumber(line.mins_6_prs_box, auto.mins_6_prs_box),
    pairs_per_hr: pickFiniteNumber(line.pairs_per_hr, auto.pairs_per_hr),
    pairs_per_day: pickFiniteNumber(line.pairs_per_day, auto.pairs_per_day),
  };
}

module.exports = {
  computeRoutingLineDerived,
  resolveRoutingLineDerived,
};
