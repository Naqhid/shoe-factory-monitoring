import React from 'react';
import type { MachinePaceSnapshot } from '../utils/shiftPaceUtils';

interface TvMachinePacePanelProps {
  machines: MachinePaceSnapshot[];
}

const legendDot = (className: string) => (
  <span className={`inline-block h-2 w-2 rounded-sm shrink-0 ${className}`} aria-hidden />
);

const legendDivider = () => (
  <span className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
);

/** Legend for carousel header — same size as line title; colors match Pace / EOD columns. */
export const TvMachinePaceLegend: React.FC = () => (
  <div className="flex items-center gap-4 sm:gap-6 shrink-0 whitespace-nowrap font-bold leading-tight">
    <span
      className="inline-flex items-center gap-1.5 text-emerald-700"
      title="Pace column: actual / target at this time"
    >
      {legendDot('bg-emerald-600')}
      <span>Pace</span>
      <span className="font-semibold text-slate-500">act / tgt</span>
    </span>
    {legendDivider()}
    <span
      className="inline-flex items-center gap-1.5 text-blue-700"
      title="EOD column: projection / daily target"
    >
      {legendDot('bg-blue-600')}
      <span>EOD</span>
      <span className="font-semibold text-slate-500">proj / plan</span>
    </span>
    {legendDivider()}
    <span className="inline-flex items-center gap-1.5 text-slate-600" title="Efficiency shown in circle">
      <span className="font-semibold text-amber-900 bg-amber-200 px-2 py-0.5 rounded ring-1 ring-amber-300">Circle = Eff %</span>
    </span>
  </div>
);

/** Pace + EOD columns (header + values); third column is full-height efficiency circle. */
const CARD_METRICS_GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] w-full h-full min-h-0';

const columnHeaderClass =
  'text-[clamp(0.65rem,1.1vw,0.8rem)] font-extrabold uppercase text-center leading-none py-0.5 border-b border-slate-100';

const gridLayout = (count: number) => {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count <= 4) return { cols: 2, rows: Math.ceil(count / 2) };
  if (count <= 9) return { cols: 3, rows: Math.ceil(count / 3) };
  return { cols: 4, rows: Math.ceil(count / 4) };
};

const numClass = 'text-[clamp(0.65rem,1.65vw,1rem)] font-black leading-none';
const slashClass = 'text-[clamp(0.6rem,1.5vw,0.9rem)] font-black text-slate-800 leading-none';

const paceEfficiencyPct = (actual: number, expected: number): number | null => {
  if (expected <= 0) return null;
  return Math.round((actual / expected) * 100);
};

const paceEfficiencyCircleClass = (pct: number | null): string => {
  if (pct == null) return 'bg-slate-300 ring-slate-400/50';
  if (pct >= 100) return 'bg-emerald-500 ring-emerald-600/50';
  if (pct >= 70) return 'bg-amber-400 ring-amber-500/50';
  return 'bg-red-500 ring-red-600/50';
};

const PaceEfficiencyBadge: React.FC<{ snap: MachinePaceSnapshot }> = ({ snap }) => {
  const pct = paceEfficiencyPct(snap.actual, snap.expected);
  const label =
    pct != null
      ? `Pace efficiency ${pct}% (${snap.actual} / ${snap.expected})`
      : 'No pace target set';
  const pctLabel = pct != null ? `${pct}%` : '—';
  const textClass =
    pct != null && pct >= 100
      ? 'text-[clamp(0.55rem,1.35vw,0.75rem)]'
      : 'text-[clamp(0.62rem,1.55vw,0.88rem)]';

  return (
    <span
      className={`flex h-[clamp(2.35rem,6vw,3.5rem)] w-[clamp(2.35rem,6vw,3.5rem)] max-h-full max-w-full aspect-square items-center justify-center rounded-full ring-2 ring-white shadow-md font-black tabular-nums leading-none text-white ${paceEfficiencyCircleClass(pct)}`}
      title={label}
      aria-label={label}
    >
      <span className={textClass}>{pctLabel}</span>
    </span>
  );
};

const machineTitleClass =
  'text-[clamp(0.75rem,1.5vw,0.9rem)] font-bold text-slate-900 text-center leading-snug line-clamp-2 px-0.5 mb-3';

const PaceEodEffMetrics: React.FC<{ snap: MachinePaceSnapshot; routing?: boolean }> = ({
  snap,
  routing = true,
}) => {
  const paceBehind = snap.actual < snap.expected;
  const eodBehind = snap.daily > 0 && snap.projectedEod < snap.daily;

  return (
    <div className={CARD_METRICS_GRID}>
      <div className="grid grid-rows-[auto_1fr] min-h-0 border-r border-slate-300">
        <span className={`${columnHeaderClass} text-emerald-700`}>Pace</span>
        <div className="flex items-center justify-center min-h-0 px-0.5 tabular-nums">
          {routing ? (
            <div className="flex items-baseline justify-center gap-0.5 min-w-0">
              <span className={`${numClass} ${paceBehind ? 'text-red-700' : 'text-emerald-700'}`}>{snap.actual}</span>
              <span className={slashClass}>/</span>
              <span className={`${numClass} text-slate-900`}>{snap.expected}</span>
            </div>
          ) : (
            <span className="text-lg font-black text-slate-700">{snap.actual}</span>
          )}
        </div>
      </div>
      <div className="grid grid-rows-[auto_1fr] min-h-0 border-r border-slate-300">
        <span className={`${columnHeaderClass} text-blue-700`}>EOD</span>
        <div className="flex items-center justify-center min-h-0 px-0.5 tabular-nums">
          {routing ? (
            <div className="flex items-baseline justify-center gap-0.5 min-w-0">
              <span className={`${numClass} ${eodBehind ? 'text-red-700' : 'text-blue-700'}`}>{snap.projectedEod}</span>
              <span className={slashClass}>/</span>
              <span className={`${numClass} text-indigo-900`}>{snap.daily > 0 ? snap.daily : '—'}</span>
            </div>
          ) : (
            <span className="text-sm font-bold text-slate-400">—</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center min-h-0 px-1 self-stretch">
        <PaceEfficiencyBadge snap={snap} />
      </div>
    </div>
  );
};

const MachinePaceCard: React.FC<{ snap: MachinePaceSnapshot }> = ({ snap }) => {
  const onTrack = snap.onTrack && snap.hasRouting;

  if (!snap.hasRouting) {
    return (
      <div className="h-full min-h-0 grid grid-rows-[auto_1fr] gap-0 rounded-md border border-dashed border-slate-300 bg-slate-50/90 px-1 py-1 overflow-hidden">
        <p className={`${machineTitleClass} text-slate-800`} title={snap.machineName}>
          {snap.machineName}
        </p>
        <PaceEodEffMetrics snap={snap} routing={false} />
      </div>
    );
  }

  return (
    <div
      className={`h-full min-h-0 grid grid-rows-[auto_1fr] gap-0 rounded-md border bg-white px-1 py-1 overflow-hidden shadow-sm ${
        onTrack ? 'border-emerald-300 border-l-[3px] border-l-emerald-500' : 'border-red-200 border-l-[3px] border-l-red-500'
      }`}
    >
      <p className={machineTitleClass} title={`${snap.machineName} (${snap.machineId})`}>
        {snap.machineName}
      </p>
      <PaceEodEffMetrics snap={snap} />
    </div>
  );
};

export const TvMachinePacePanel: React.FC<TvMachinePacePanelProps> = ({ machines }) => {
  const sorted = [...machines].sort((a, b) =>
    String(a.machineId).localeCompare(String(b.machineId), undefined, { numeric: true })
  );
  const { cols, rows } = gridLayout(sorted.length);

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden px-1.5 py-0.5">
      <div className="flex-1 min-h-0 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500 font-medium">
            No machines on this line.
          </div>
        ) : (
          <div
            className="h-full grid gap-1 min-h-0"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {sorted.map((snap) => (
              <MachinePaceCard key={snap.machineId} snap={snap} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
