import React from 'react';
import { Bell, CheckCircle, Loader2, RefreshCw, X } from 'lucide-react';
import {
  classifyLateCycleCategory,
  computeCycleNetGainMins,
  computeCycleNetLostMins,
  LateCycleCategory,
} from '../utils/cycleLostMins';
import { CycleDurationInline, minutesToDurationParts, sumMinutes } from '../utils/formatCycleDuration';
import { LateCycleTiming, LateCycleTimingCard } from './LateCycleTimingCard';

const FILTER_OPTIONS: { value: LateCycleCategory; label: string }[] = [
  { value: 'net_loss', label: 'Late' },
  { value: 'on_time', label: 'On time' },
  { value: 'net_gain', label: 'Early' },
];

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
  const [filter, setFilter] = React.useState<LateCycleCategory>('net_loss');

  React.useEffect(() => {
    if (open) setFilter('net_loss');
  }, [open]);

  const byCategory = React.useMemo(() => {
    const net_loss: LateCycleTiming[] = [];
    const on_time: LateCycleTiming[] = [];
    const net_gain: LateCycleTiming[] = [];
    cycles.forEach((c) => {
      const cat = classifyLateCycleCategory(c);
      if (cat === 'net_loss') net_loss.push(c);
      else if (cat === 'on_time') on_time.push(c);
      else net_gain.push(c);
    });
    return { net_loss, on_time, net_gain };
  }, [cycles]);

  const visibleCycles = byCategory[filter];
  const modalTitle =
    filter === 'net_gain'
      ? 'Early Boxes Today'
      : filter === 'on_time'
        ? 'On-time Boxes Today'
        : 'Late Boxes Today';
  const totalLostMins = sumMinutes(
    byCategory.net_loss.map((c) =>
      computeCycleNetLostMins(c.start_gap_mins, c.target_mins, c.actual_mins)
    )
  );
  const totalEarlyMins = sumMinutes(
    byCategory.net_gain.map((c) =>
      computeCycleNetGainMins(c.start_gap_mins, c.target_mins, c.actual_mins)
    )
  );
  const netDeltaMins = totalEarlyMins - totalLostMins;
  const hasNetDelta = Math.abs(netDeltaMins) * 60 >= 1;
  const isNetGain = netDeltaMins > 0;
  const netDeltaParts = minutesToDurationParts(Math.abs(netDeltaMins));

  const emptyMessage =
    filter === 'net_loss'
      ? 'No late boxes today.'
      : filter === 'net_gain'
        ? 'No early boxes today.'
        : 'No fully on-time boxes today.';

  if (!open) return null;

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
              <span className="truncate">{modalTitle}</span>
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

        <div className="overflow-y-auto overflow-x-hidden flex-1 overscroll-contain px-2.5 py-2 space-y-2 min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : totalCycles === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No boxes recorded today</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 space-y-2 text-xs">
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 px-1 py-1.5">
                    <p className="text-[9px] font-bold uppercase text-emerald-700">On time</p>
                    <p className="text-sm font-black text-emerald-900 tabular-nums">{byCategory.on_time.length}</p>
                  </div>
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-1 py-1.5">
                    <p className="text-[9px] font-bold uppercase text-amber-800">Early</p>
                    <p className="text-sm font-black text-amber-900 tabular-nums">{byCategory.net_gain.length}</p>
                  </div>
                  <div className="rounded-md bg-red-50 border border-red-200 px-1 py-1.5">
                    <p className="text-[9px] font-bold uppercase text-red-700">Late</p>
                    <p className="text-sm font-black text-red-900 tabular-nums">{byCategory.net_loss.length}</p>
                  </div>
                  <div
                    className={`rounded-md px-1 py-1.5 border ${
                      !hasNetDelta
                        ? 'bg-gray-50 border-gray-200'
                        : isNetGain
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <p
                      className={`text-[9px] font-bold uppercase ${
                        !hasNetDelta
                          ? 'text-gray-700'
                          : isNetGain
                            ? 'text-emerald-700'
                            : 'text-red-700'
                      }`}
                    >
                      {!hasNetDelta ? 'Neutral' : isNetGain ? 'Gain' : 'Loss'}
                    </p>
                    <p
                      className={`text-[10px] font-black tabular-nums ${
                        !hasNetDelta
                          ? 'text-gray-800'
                          : isNetGain
                            ? 'text-emerald-900'
                            : 'text-red-900'
                      }`}
                    >
                      {!hasNetDelta ? '0m' : `${netDeltaParts.wholeMinutes}m ${netDeltaParts.seconds}s`}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 tabular-nums">
                  {visibleCycles.length} shown · {totalCycles} boxes today
                </p>
                {filter === 'net_loss' && byCategory.net_loss.length > 0 && (
                  <p className="text-red-800 font-semibold flex flex-wrap items-baseline gap-x-1">
                    <span className="text-[10px] uppercase">Total late</span>
                    <CycleDurationInline
                      minutes={totalLostMins}
                      minClass="text-red-900 font-bold"
                      secClass="text-red-500 font-semibold"
                    />
                  </p>
                )}
                {filter === 'net_gain' && byCategory.net_gain.length > 0 && (
                  <p className="text-amber-800 font-semibold flex flex-wrap items-baseline gap-x-1">
                    <span className="text-[10px] uppercase">Total early</span>
                    <CycleDurationInline
                      minutes={totalEarlyMins}
                      minClass="text-amber-900 font-bold"
                      secClass="text-amber-600 font-semibold"
                    />
                  </p>
                )}
              </div>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase text-gray-500">Show</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as LateCycleCategory)}
                  className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-semibold text-gray-800 touch-manipulation"
                >
                  {FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({byCategory[opt.value].length})
                    </option>
                  ))}
                </select>
              </label>

              {visibleCycles.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-4">{emptyMessage}</p>
              ) : (
                <div className="space-y-2 pb-1">
                  {visibleCycles.map((c) => (
                    <LateCycleTimingCard key={c.id} cycle={c} />
                  ))}
                </div>
              )}
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
