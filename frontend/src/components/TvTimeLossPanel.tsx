import React from 'react';
import { minutesToDurationParts } from '../utils/formatCycleDuration';

export type TvTimeLossRow = {
  machine_id: string | number;
  machine_name?: string;
  net_mins: number;
};

type TvTimeLossPanelProps = {
  lineName: string;
  rows: TvTimeLossRow[];
  netTotalMins: number;
  netTotalLabel: 'gain' | 'loss' | 'neutral';
};

const MARQUEE_MIN_ROWS = 5;
const SECONDS_PER_ROW = 3.8;

function TimeLossRowCard({ row, className = '' }: { row: TvTimeLossRow; className?: string }) {
  const net = Number(row.net_mins || 0);
  const parts = minutesToDurationParts(Math.abs(net));
  const isGain = net > 0;
  const tone = isGain
    ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
    : 'text-red-700 bg-red-50 border border-red-200';
  const status = isGain ? 'gain' : 'loss';

  return (
    <div
      className={`rounded-lg px-2.5 py-2 flex items-center justify-between shadow-sm shrink-0 ${
        isGain ? 'border border-emerald-200 bg-emerald-50/80' : 'border border-red-200 bg-white'
      } ${className}`}
    >
      <span
        className={`text-base sm:text-lg xl:text-xl font-bold truncate pr-2 text-left rounded-md px-2 py-0.5 min-w-0 ${
          isGain
            ? 'text-emerald-900 bg-emerald-100 border border-emerald-300'
            : 'text-slate-900 bg-amber-50/70 border border-amber-100'
        }`}
      >
        {row.machine_name || `Machine ${row.machine_id}`}
      </span>
      <span className={`text-base sm:text-lg xl:text-xl font-black tabular-nums shrink-0 px-2 py-0.5 rounded-md whitespace-nowrap ${tone}`}>
        {parts.wholeMinutes}m {parts.seconds}s {status}
      </span>
    </div>
  );
}

export function TvTimeLossPanel({ lineName, rows, netTotalMins, netTotalLabel }: TvTimeLossPanelProps) {
  const netTotalParts = minutesToDurationParts(Math.abs(netTotalMins));
  const useMarquee = rows.length >= MARQUEE_MIN_ROWS;
  const marqueeDurationSec = Math.max(18, Math.round(rows.length * SECONDS_PER_ROW));

  return (
    <div className="h-full min-h-0 flex flex-col text-center">
      <div className="mb-2 flex items-center justify-center gap-2 text-center flex-wrap shrink-0">
        <p className="text-sm sm:text-base font-bold text-blue-700 tracking-wide">{lineName}</p>
        <span className="text-slate-300">|</span>
        <p className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wide">Time loss</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-sm text-gray-400">No time loss data today</p>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {useMarquee ? (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div
                  className="motion-safe:animate-tv-time-loss-scroll motion-reduce:animate-none"
                  style={{ animationDuration: `${marqueeDurationSec}s` }}
                >
                  {[0, 1].map((copy) => (
                    <div key={copy} className="flex flex-col gap-2">
                      {rows.map((row) => (
                        <TimeLossRowCard
                          key={`${copy}-${row.machine_id}-${row.machine_name}`}
                          row={row}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-white via-white/80 to-transparent"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white via-white/80 to-transparent"
                  aria-hidden
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-hidden">
                {rows.map((row) => (
                  <TimeLossRowCard key={`${row.machine_id}-${row.machine_name}`} row={row} />
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 mt-2 rounded-xl border-2 border-red-400 bg-gradient-to-r from-red-100 via-red-50 to-red-100 px-3 py-2.5 flex items-center justify-between shadow-md ring-1 ring-red-200">
            <span className="text-lg sm:text-xl xl:text-2xl font-extrabold text-red-900 uppercase tracking-wide">
              Total
            </span>
            <span
              className={`text-lg sm:text-xl xl:text-2xl font-black tabular-nums bg-white/90 px-2.5 py-1 rounded-lg whitespace-nowrap ${
                netTotalLabel === 'gain'
                  ? 'text-emerald-800'
                  : netTotalLabel === 'loss'
                    ? 'text-red-800'
                    : 'text-gray-700'
              }`}
            >
              {netTotalParts.wholeMinutes}m {netTotalParts.seconds}s {netTotalLabel}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
