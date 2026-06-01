import React from 'react';
import { Bell, CheckCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { computeCycleNetLostMins } from '../utils/cycleLostMins';
import { CycleDurationInline, sumMinutes } from '../utils/formatCycleDuration';
import { LateCycleTiming, LateCycleTimingCard } from './LateCycleTimingCard';

function netLostSecs(c: LateCycleTiming) {
  return computeCycleNetLostMins(c.start_gap_mins, c.target_mins, c.actual_mins) * 60;
}

type Props = {
  open: boolean;
  loading: boolean;
  cycles: LateCycleTiming[];
  totalCycles: number;
  onClose: () => void;
  onRefresh: () => void;
};

export function LateCyclesTodayModal({
  open,
  loading,
  cycles,
  totalCycles,
  onClose,
  onRefresh,
}: Props) {
  if (!open) return null;

  const cyclesWithNetLost = cycles.filter((c) => netLostSecs(c) >= 1);
  const recoveredCycles = cycles.filter((c) => netLostSecs(c) < 1);
  const onTimeCount = Math.max(0, totalCycles - cycles.length);
  const totalLostMins = sumMinutes(cyclesWithNetLost.map((c) =>
    computeCycleNetLostMins(c.start_gap_mins, c.target_mins, c.actual_mins)
  ));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-3 bg-black/45"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="late-cycles-title"
    >
      <div
        className="bg-white w-full sm:max-w-sm sm:rounded-xl rounded-t-2xl shadow-xl flex flex-col max-h-[min(78dvh,640px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
          <div className="min-w-0">
            <h3 id="late-cycles-title" className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Late Cycles Today</span>
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Tap ? on any row for a full explanation</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 touch-manipulation"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 overscroll-contain px-2.5 py-2 space-y-2 min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : cycles.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">All cycles on time today</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 space-y-2 text-xs">
                <p className="font-semibold text-gray-800 tabular-nums">
                  {cycles.length} out of {totalCycles} had a timing issue
                </p>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 px-1 py-1.5">
                    <p className="text-[9px] font-bold uppercase text-emerald-700">On time</p>
                    <p className="text-sm font-black text-emerald-900 tabular-nums">{onTimeCount}</p>
                  </div>
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-1 py-1.5">
                    <p className="text-[9px] font-bold uppercase text-amber-800">Recovered</p>
                    <p className="text-sm font-black text-amber-900 tabular-nums">{recoveredCycles.length}</p>
                  </div>
                  <div className="rounded-md bg-red-50 border border-red-200 px-1 py-1.5">
                    <p className="text-[9px] font-bold uppercase text-red-700">Net lost</p>
                    <p className="text-sm font-black text-red-900 tabular-nums">{cyclesWithNetLost.length}</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 leading-snug">
                  <span className="font-medium text-emerald-700">On time</span> — no late start or late finish.
                  {' '}
                  <span className="font-medium text-amber-700">Recovered</span> — had a delay but finished early covered it (0 net).
                  {' '}
                  <span className="font-medium text-red-700">Net lost</span> — time still lost on the shift.
                </p>
                {cyclesWithNetLost.length > 0 && (
                  <p className="text-red-800 font-semibold flex flex-wrap items-baseline gap-x-1">
                    <span className="text-[10px] uppercase">Total lost</span>
                    <CycleDurationInline
                      minutes={totalLostMins}
                      minClass="text-red-900 font-bold"
                      secClass="text-red-500 font-semibold"
                    />
                  </p>
                )}
              </div>
              <div className="space-y-3">
                {cyclesWithNetLost.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-red-600 px-0.5">Net time lost</p>
                    {cyclesWithNetLost.map((c) => (
                      <LateCycleTimingCard key={c.id} cycle={c} />
                    ))}
                  </div>
                )}
                {recoveredCycles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-amber-700 px-0.5">Recovered (no net loss)</p>
                    {recoveredCycles.map((c) => (
                      <LateCycleTimingCard key={c.id} cycle={c} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 px-2.5 py-2 border-t border-gray-100 flex justify-end pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 touch-manipulation"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
