import React from 'react';
import type { MachinePaceSnapshot } from '../utils/shiftPaceUtils';

export interface TvLinePlanSummary {
  lineName: string;
  /** Daily pairs target from production planning for this line. */
  dailyTarget: number;
  lineOutput: number;
  expectedNow?: number;
  projectedEod?: number;
}

interface TvMachinePacePanelProps {
  machines: MachinePaceSnapshot[];
  linePlan?: TvLinePlanSummary | null;
}

const legendDot = (className: string) => (
  <span className={`inline-block h-2 w-2 rounded-sm shrink-0 ${className}`} aria-hidden />
);

const legendDivider = () => (
  <span className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
);

/** Legend for carousel header — same size as line title; colors match Progress / EOD columns. */
export const TvMachinePaceLegend: React.FC = () => (
  <div className="flex items-center gap-4 sm:gap-6 shrink-0 whitespace-nowrap font-bold leading-tight">
    <span
      className="inline-flex items-center gap-1.5 text-emerald-700"
      title="In progress: actual pairs vs target for the shift so far"
    >
      {legendDot('bg-emerald-600')}
      <span>In progress</span>
      <span className="font-semibold text-slate-500">actual / target</span>
    </span>
    {legendDivider()}
    <span
      className="inline-flex items-center gap-1.5 text-blue-700"
      title="EOD column: projection / daily target"
    >
      {legendDot('bg-blue-600')}
      <span>EOD</span>
      <span className="font-semibold text-slate-500">projected / plan</span>
    </span>
    {legendDivider()}
    <span className="inline-flex items-center gap-1.5 text-slate-600" title="Efficiency shown in circle">
      <span className="font-semibold text-amber-900 bg-amber-200 px-2 py-0.5 rounded ring-1 ring-amber-300">Circle = Eff %</span>
    </span>
    {legendDivider()}
    <span
      className="inline-flex items-center gap-1.5 text-indigo-800"
      title="Indigo card in the grid: whole-line totals, not a single machine"
    >
      <span
        className="inline-block h-2.5 w-4 shrink-0 rounded-sm border-2 border-indigo-600 bg-indigo-100 ring-1 ring-indigo-400"
        aria-hidden
      />
      <span>Full line</span>
    </span>
  </div>
);

/** Progress + EOD columns (header + values); third column is full-height efficiency circle. */
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
  if (pct > 90) return 'bg-emerald-500 ring-emerald-600/50';
  if (pct >= 70) return 'bg-orange-400 ring-orange-500/50';
  if (pct >= 50) return 'bg-amber-400 ring-amber-500/50';
  return 'bg-red-500 ring-red-600/50';
};

const PaceEfficiencyBadge: React.FC<{ snap: MachinePaceSnapshot }> = ({ snap }) => {
  const pct = paceEfficiencyPct(snap.actual, snap.expected);
  const label =
    pct != null
      ? `In progress ${pct}% (${snap.actual} / ${snap.expected} target so far)`
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

const PaceEodEffMetrics: React.FC<{
  snap: MachinePaceSnapshot;
  routing?: boolean;
  paceRouting?: boolean;
  eodRouting?: boolean;
}> = ({ snap, routing = true, paceRouting, eodRouting }) => {
  const showPaceRatio = paceRouting ?? routing;
  const showEodRatio = eodRouting ?? routing;
  const paceBehind = snap.actual < snap.expected;
  const eodBehind = snap.daily > 0 && snap.projectedEod < snap.daily;

  return (
    <div className={CARD_METRICS_GRID}>
      <div className="grid grid-rows-[auto_1fr] min-h-0 border-r border-slate-300">
        <span className={`${columnHeaderClass} text-emerald-700`}>In progress</span>
        <div className="flex items-center justify-center min-h-0 px-0.5 tabular-nums">
          {showPaceRatio ? (
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
          {showEodRatio ? (
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

const fullLineCardShellClass =
  'h-full min-h-0 grid grid-rows-[auto_1fr] gap-0.5 rounded-lg border-[3px] border-indigo-600 bg-gradient-to-br from-indigo-200 via-blue-100 to-violet-100 p-0.5 overflow-hidden shadow-[0_4px_16px_rgba(67,56,202,0.28)] ring-2 ring-indigo-300/80';

const fullLineMetricsPanelClass =
  'min-h-0 rounded-md border border-indigo-300/70 bg-white/90 overflow-hidden shadow-inner';

const fullLineCardTitle = (lineName: string): string => {
  const name = String(lineName || '').trim() || 'Line';
  return /^full\b/i.test(name) ? name : `Full ${name}`;
};

const FullLineCardHeader: React.FC<{ lineName: string }> = ({ lineName }) => {
  const title = fullLineCardTitle(lineName);

  return (
    <div className="rounded-md bg-gradient-to-r from-indigo-800 to-indigo-600 px-1 py-1 text-center shadow-sm">
      <p
        className="text-[clamp(0.62rem,1.2vw,0.82rem)] font-black uppercase tracking-[0.08em] text-white leading-snug line-clamp-2 px-0.5"
        title={`${title} — whole line totals`}
      >
        {title}
      </p>
    </div>
  );
};

const linePlanToPaceSnap = (plan: TvLinePlanSummary): MachinePaceSnapshot => {
  const daily = Math.round(Number(plan.dailyTarget) || 0);
  const actual = Math.round(Number(plan.lineOutput) || 0);
  const expected = Math.round(Number(plan.expectedNow) || 0);
  const projectedEod = Math.round(Number(plan.projectedEod) || 0);

  return {
    machineId: '__line__',
    machineName: plan.lineName,
    actual,
    expected,
    daily,
    projectedEod,
    shortBy: daily > 0 && projectedEod < daily ? daily - projectedEod : 0,
    remainingMins: 0,
    onTrack: daily > 0 && projectedEod >= daily,
    hasRouting: daily > 0,
  };
};

const LinePlanningCard: React.FC<{ plan: TvLinePlanSummary }> = ({ plan }) => {
  const snap = linePlanToPaceSnap(plan);

  if (snap.daily <= 0) {
    return (
      <div className={fullLineCardShellClass}>
        <FullLineCardHeader lineName={plan.lineName} />
        <div className={`${fullLineMetricsPanelClass} flex-1 flex items-center justify-center text-center px-1`}>
          <p className="text-[clamp(0.7rem,1.4vw,0.85rem)] font-bold text-indigo-700/80 leading-snug">
            No plan set for today
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={fullLineCardShellClass} title={`${plan.lineName} — daily plan ${snap.daily} pairs`}>
      <FullLineCardHeader lineName={plan.lineName} />
      <div className={fullLineMetricsPanelClass}>
        <PaceEodEffMetrics
          snap={snap}
          paceRouting={snap.expected > 0}
          eodRouting={snap.daily > 0}
        />
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

type GridTile =
  | { kind: 'machine'; snap: MachinePaceSnapshot }
  | { kind: 'line-plan'; plan: TvLinePlanSummary };

export const TvMachinePacePanel: React.FC<TvMachinePacePanelProps> = ({ machines, linePlan }) => {
  const sorted = [...machines].sort((a, b) =>
    String(a.machineId).localeCompare(String(b.machineId), undefined, { numeric: true })
  );

  const tiles: GridTile[] = sorted.map((snap) => ({ kind: 'machine', snap }));
  if (linePlan) {
    const insertAt = Math.floor((tiles.length + 1) / 2);
    tiles.splice(insertAt, 0, { kind: 'line-plan', plan: linePlan });
  }

  const { cols, rows } = gridLayout(tiles.length);

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden px-1.5 py-0.5">
      <div className="flex-1 min-h-0 overflow-hidden">
        {tiles.length === 0 ? (
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
            {tiles.map((tile, idx) =>
              tile.kind === 'line-plan' ? (
                <LinePlanningCard key={`line-plan-${idx}`} plan={tile.plan} />
              ) : (
                <MachinePaceCard key={tile.snap.machineId} snap={tile.snap} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
