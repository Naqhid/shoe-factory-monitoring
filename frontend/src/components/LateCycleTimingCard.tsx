import React from 'react';
import { classifyLateCycleCategory, computeCycleNetGainMins, computeCycleNetLostMins } from '../utils/cycleLostMins';
import { CycleInfoTip } from './CycleInfoTip';
import { CycleDurationGainText, CycleDurationInline, CycleDurationLostText } from '../utils/formatCycleDuration';

export type LateCycleTiming = {
  id: number;
  cycle: number;
  start_time: string;
  finish_time: string | null;
  output_pairs?: number;
  target_mins: number;
  actual_mins: number;
  start_gap_mins: number;
  extra_mins: number;
  early_mins: number;
  lost_mins: number;
};

const TIPS = {
  whySection: (hasEarly: boolean) =>
    [
      'How we calculate lost time:',
      '',
      '• Late start — machine sat idle before START was pressed (from last FINISH, lunch excluded).',
      '• Late finish — the cycle took longer than the target time.',
      hasEarly ? '• Finished early — completed under the target time; this reduces lost time.' : null,
      '',
      hasEarly
        ? 'Net lost = late start + late finish − finished early'
        : 'Net lost = late start + late finish',
    ]
      .filter((line) => line !== null)
      .join('\n'),
  lateStart:
    'The operator waited before pressing START.\n\n' +
    'We measure from the last FINISH time (or shift start for the first cycle). Waiting time counts from the first second (lunch break excluded).\n\n' +
    'This waiting time is added to lost time (+).',
  lateFinish:
    'The operator pressed FINISH later than the target time.\n\n' +
    'Extra time = actual work time minus target time.\n\n' +
    'This is added to lost time (+).',
  finishedEarly:
    'The operator finished the cycle before the target time.\n\n' +
    'Time saved = target time minus actual work time.\n\n' +
    'This is subtracted from lost time (−).',
  netLost:
    'Total time lost on this cycle.\n\n' +
    'It combines late start and late finish, minus any time saved by finishing early.',
  netGain:
    'Time recovered on this cycle.\n\n' +
    'Net gain = finished early − late start − late finish\n\n' +
    'Delays were fully offset (or more) by finishing under target.',
  target:
    'How long this cycle should take according to routing (the standard target time).',
  actual:
    'How long the cycle really took — from pressing START until pressing FINISH.',
} as const;

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function BreakdownRow({
  label,
  tip,
  minutes,
  sign,
  tone,
}: {
  label: string;
  tip: string;
  minutes: number;
  sign: '+' | '−';
  tone: 'loss' | 'save';
}) {
  if (minutes <= 0.01) return null;
  const isSave = tone === 'save';
  const signCls = isSave ? 'text-emerald-700' : 'text-red-700';
  const valueMin = isSave ? 'text-emerald-800 font-bold' : 'text-red-800 font-bold';
  const valueSec = isSave ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold';

  return (
    <div className="py-1 border-b border-gray-100/80 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <CycleInfoTip
          text={tip}
          fullWidth
          label={<span className="text-[11px] font-medium text-gray-700 leading-tight">{label}</span>}
        />
        <span className={`inline-flex items-baseline gap-0.5 text-xs tabular-nums shrink-0 pt-0.5 ${signCls}`}>
          <span className="font-bold">{sign}</span>
          <CycleDurationInline minutes={minutes} minClass={valueMin} secClass={valueSec} />
        </span>
      </div>
    </div>
  );
}

export function LateCycleTimingCard({ cycle }: { cycle: LateCycleTiming }) {
  const hasLate = cycle.start_gap_mins > 0.01;
  const hasExtra = cycle.extra_mins > 0.01;
  const hasEarly = cycle.early_mins > 0.01;
  const hasBreakdown = hasLate || hasExtra || hasEarly;
  const netLostMins = computeCycleNetLostMins(cycle.start_gap_mins, cycle.target_mins, cycle.actual_mins);
  const isNetGain = classifyLateCycleCategory(cycle) === 'net_gain';
  const netGainMins = isNetGain
    ? computeCycleNetGainMins(cycle.start_gap_mins, cycle.target_mins, cycle.actual_mins)
    : 0;

  const pairCount = Math.round(Number(cycle.output_pairs || 0));

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50/80 text-xs" onClick={(e) => e.stopPropagation()}>
      <header className="px-2.5 py-2 bg-white border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-800">Box {cycle.cycle}</p>
          <p className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] text-blue-700 font-mono tabular-nums mt-0.5">
            {formatClock(cycle.start_time)}
            {cycle.finish_time ? ` → ${formatClock(cycle.finish_time)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {isNetGain ? (
            <>
              <CycleInfoTip
                className="items-end"
                text={TIPS.netGain}
                label={<span className="text-[9px] font-semibold uppercase text-amber-700">Early</span>}
              />
              <div className="-mt-0.5">
                <CycleDurationGainText minutes={netGainMins} />
              </div>
            </>
          ) : (
            <>
              <CycleInfoTip
                className="items-end"
                text={TIPS.netLost}
                label={<span className="text-[9px] font-semibold uppercase text-gray-400">Late</span>}
              />
              <div className="-mt-0.5">
                <CycleDurationLostText minutes={netLostMins} />
              </div>
            </>
          )}
        </div>
      </header>

      {(hasBreakdown || pairCount > 0) && (
        <section className="relative px-2.5 py-1.5 bg-white border-b border-gray-100">
          {hasBreakdown ? (
            <>
              <CycleInfoTip
                text={TIPS.whySection(hasEarly)}
                label={<span className="text-[9px] font-bold uppercase text-gray-400">Why lost</span>}
              />
              <div className="mt-1">
                <BreakdownRow
                  label="Late start"
                  tip={TIPS.lateStart}
                  minutes={cycle.start_gap_mins}
                  sign="+"
                  tone="loss"
                />
                <BreakdownRow
                  label="Late finish"
                  tip={TIPS.lateFinish}
                  minutes={cycle.extra_mins}
                  sign="+"
                  tone="loss"
                />
                <BreakdownRow
                  label="Finished early"
                  tip={TIPS.finishedEarly}
                  minutes={cycle.early_mins}
                  sign="−"
                  tone="save"
                />
              </div>
            </>
          ) : (
            <div className="min-h-[3.25rem]" />
          )}
          {pairCount > 0 && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 inline-flex flex-col items-center rounded-lg bg-indigo-100 border-2 border-indigo-300 px-3 py-1.5 shadow-sm">
              <span className="text-xl leading-none font-black text-indigo-900 tabular-nums">{pairCount}</span>
              <span className="text-[10px] leading-none mt-0.5 font-extrabold uppercase tracking-wider text-indigo-700">
                pairs
              </span>
            </span>
          )}
        </section>
      )}

      <footer className="px-2.5 py-1.5 flex flex-wrap items-start gap-x-4 gap-y-1 text-[10px] text-gray-500 bg-blue-50/50 border-t border-blue-100">
        <CycleInfoTip
          text={TIPS.target}
          label={
            <span className="inline-flex items-center rounded-md bg-blue-100/80 border border-blue-200 px-1.5 py-0.5">
              <span className="text-blue-700 font-semibold mr-1">Target</span>
              <CycleDurationInline
                minutes={cycle.target_mins}
                minClass="text-blue-800 font-semibold"
                secClass="text-blue-600"
              />
            </span>
          }
        />
        <CycleInfoTip
          text={TIPS.actual}
          label={
            <span className="inline-flex items-center rounded-md bg-violet-100/80 border border-violet-200 px-1.5 py-0.5">
              <span className="text-violet-700 font-semibold mr-1">Actual</span>
              <CycleDurationInline
                minutes={cycle.actual_mins}
                minClass="text-gray-800 font-semibold"
                secClass="text-gray-600"
              />
            </span>
          }
        />
      </footer>
    </article>
  );
}
