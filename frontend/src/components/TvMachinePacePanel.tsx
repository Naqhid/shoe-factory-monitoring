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
  
  </div>
);

const COLUMN_HEADERS = [
  { label: 'Pace', className: 'text-emerald-700' },
  { label: 'EOD', className: 'text-blue-700' },
] as const;

const gridLayout = (count: number) => {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count <= 4) return { cols: 2, rows: Math.ceil(count / 2) };
  if (count <= 9) return { cols: 3, rows: Math.ceil(count / 3) };
  return { cols: 4, rows: Math.ceil(count / 4) };
};

const numClass = 'text-[clamp(0.8rem,2vw,1.15rem)] font-black leading-none';

const machineTitleClass =
  'text-[clamp(0.75rem,1.5vw,0.9rem)] font-bold text-slate-900 text-center leading-snug line-clamp-2 px-0.5 mb-3';

const PaceNumbers: React.FC<{ snap: MachinePaceSnapshot }> = ({ snap }) => {
  const paceBehind = snap.actual < snap.expected;
  const eodBehind = snap.daily > 0 && snap.projectedEod < snap.daily;

  return (
  <div className="grid grid-cols-2 w-full h-full items-center gap-px tabular-nums">
    <div className="flex items-baseline justify-center gap-px min-w-0">
      <span className={`${numClass} ${paceBehind ? 'text-red-700' : 'text-emerald-700'}`}>{snap.actual}</span>
      <span className="text-[10px] font-semibold text-slate-400">/</span>
      <span className={`${numClass} text-slate-900`}>{snap.expected}</span>
    </div>
    <div className="flex items-baseline justify-center gap-px min-w-0">
      <span className={`${numClass} ${eodBehind ? 'text-red-700' : 'text-blue-700'}`}>{snap.projectedEod}</span>
      <span className="text-[10px] font-semibold text-blue-400">/</span>
      <span className={`${numClass} text-indigo-900`}>{snap.daily > 0 ? snap.daily : '—'}</span>
    </div>
  </div>
  );
};

const MachinePaceCard: React.FC<{ snap: MachinePaceSnapshot }> = ({ snap }) => {
  const onTrack = snap.onTrack && snap.hasRouting;

  if (!snap.hasRouting) {
    return (
      <div className="h-full min-h-0 grid grid-rows-[auto_1fr] gap-0.5 rounded-md border border-dashed border-slate-300 bg-slate-50/90 px-1 py-1 overflow-hidden">
        <p className={`${machineTitleClass} text-slate-800`} title={snap.machineName}>
          {snap.machineName}
        </p>
        <div className="flex items-center justify-center min-h-0">
          <span className="text-lg font-black text-slate-700 tabular-nums">{snap.actual}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full min-h-0 grid grid-rows-[auto_auto_1fr] gap-0 rounded-md border bg-white px-1 py-1 overflow-hidden shadow-sm ${
        onTrack ? 'border-emerald-300 border-l-[3px] border-l-emerald-500' : 'border-red-200 border-l-[3px] border-l-red-500'
      }`}
    >
      <p className={machineTitleClass} title={`${snap.machineName} (${snap.machineId})`}>
        {snap.machineName}
      </p>
      <div className="grid grid-cols-2 gap-px text-[clamp(0.65rem,1.1vw,0.8rem)] font-extrabold uppercase text-center leading-none py-0.5 border-b border-slate-100">
        {COLUMN_HEADERS.map((h) => (
          <span key={h.label} className={h.className}>
            {h.label}
          </span>
        ))}
      </div>
      <div className="min-h-0 overflow-hidden flex items-center">
        <PaceNumbers snap={snap} />
      </div>
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
