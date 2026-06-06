import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { FACTORY_HOURLY_SLOTS } from '../utils/manualEntrySlotUtils';
import type { LineReconciliation, ShiftChecklistItem, SlotHeatmapRow } from '../utils/manualEntryCoverageUtils';

const CELL_CLASS: Record<string, string> = {
  future: 'bg-slate-100 text-slate-400 ring-slate-200',
  missing: 'bg-red-100 text-red-800 ring-red-300',
  mes: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  manual: 'bg-amber-100 text-amber-900 ring-amber-300',
  overlap: 'bg-violet-100 text-violet-900 ring-violet-400',
};

const CELL_LABEL: Record<string, string> = {
  future: '—',
  missing: '·',
  mes: 'M',
  manual: 'A',
  overlap: '!',
};

export const ManualEntryReconciliationStrip: React.FC<{
  rows: LineReconciliation[];
  loading?: boolean;
}> = ({ rows, loading }) => {
  if (loading) {
    return (
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading reconciliation…
      </div>
    );
  }
  if (rows.length === 0) return null;

  const show = rows.length === 1 ? rows : rows;
  return (
    <div className="mb-3 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 px-3 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-teal-800 mb-2">Today reconciliation</p>
      <div className={`grid gap-2 ${show.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {show.map((row) => (
          <div
            key={row.work_centre_id}
            className="rounded-lg border border-teal-100 bg-white/90 px-3 py-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center"
          >
            {show.length > 1 && (
              <p className="col-span-2 sm:col-span-3 text-left text-xs font-bold text-teal-900 truncate">
                {row.line_name}
              </p>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">MES</p>
              <p className="text-lg font-black tabular-nums text-emerald-700">{row.mesTotal}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Manual</p>
              <p className="text-lg font-black tabular-nums text-amber-700">{row.manualTotal}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Combined</p>
              <p className="text-lg font-black tabular-nums text-slate-900">{row.combinedTotal}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Plan</p>
              <p className="text-lg font-black tabular-nums text-blue-700">{row.planTarget || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Gap</p>
              <p
                className={`text-lg font-black tabular-nums ${
                  row.planTarget > 0 && row.gap > 0 ? 'text-red-600' : row.gap < 0 ? 'text-emerald-600' : 'text-slate-700'
                }`}
              >
                {row.planTarget > 0 ? (row.gap > 0 ? `-${row.gap}` : row.gap < 0 ? `+${Math.abs(row.gap)}` : '0') : '—'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
              {row.planTarget > 0 && row.gap <= 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> On plan
                </span>
              ) : row.planTarget > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full ring-1 ring-red-200">
                  <AlertTriangle className="h-3.5 w-3.5" /> Behind
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ManualEntryShiftChecklist: React.FC<{
  items: ShiftChecklistItem[];
  onAction?: (item: ShiftChecklistItem) => void;
}> = ({ items, onAction }) => {
  if (items.length === 0) {
    return (
      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Shift checklist clear — no open gaps detected.
        </div>
      </div>
    );
  }

  const severityClass = {
    high: 'border-red-200 bg-red-50 text-red-950',
    medium: 'border-amber-200 bg-amber-50 text-amber-950',
    low: 'border-sky-200 bg-sky-50 text-sky-950',
  };

  return (
    <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5">
      <p className="text-sm font-bold text-indigo-950 mb-2">End-of-shift checklist</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border px-2.5 py-2 text-sm flex flex-wrap items-center justify-between gap-2 ${severityClass[item.severity]}`}
          >
            <div className="min-w-0">
              <span className="font-bold">{item.title}</span>
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-white/80 text-xs font-black tabular-nums ring-1 ring-black/10">
                {item.count}
              </span>
              <p className="text-xs opacity-80 mt-0.5">{item.detail}</p>
            </div>
            {item.actionLabel && onAction ? (
              <button
                type="button"
                onClick={() => onAction(item)}
                className="text-xs font-semibold shrink-0 px-2 py-1 rounded-md bg-white/90 hover:bg-white ring-1 ring-black/10"
              >
                {item.actionLabel}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ManualEntrySlotHeatmap: React.FC<{
  rows: SlotHeatmapRow[];
  loading?: boolean;
  onCellClick?: (row: SlotHeatmapRow, slotValue: string) => void;
  canEdit?: boolean;
  title?: string;
  hint?: string;
}> = ({ rows, loading, onCellClick, canEdit, title = 'Hourly slot coverage', hint }) => {
  const [open, setOpen] = React.useState(true);

  if (loading) {
    return (
      <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
        Building slot coverage heatmap…
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-200 text-left"
      >
        <span className="text-sm font-bold text-slate-900">{title}</span>
        <span className="flex items-center gap-3 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 ring-1 ring-emerald-300" /> MES</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 ring-1 ring-amber-300" /> Manual</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 ring-1 ring-red-300" /> Missing</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-violet-100 ring-1 ring-violet-400" /> Overlap</span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto p-2">
          <table className="min-w-full text-[10px] sm:text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left font-bold text-slate-600 px-1 py-1 sticky left-0 bg-white z-10 min-w-[120px]">
                  Machine
                </th>
                {FACTORY_HOURLY_SLOTS.map((slot) => (
                  <th key={slot.value} className="font-bold text-slate-600 px-0.5 py-1 text-center whitespace-nowrap">
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.work_centre_id}-${row.machine_id}`} className={row.logged_in ? '' : 'opacity-60'}>
                  <td className="text-left px-1 py-0.5 sticky left-0 bg-white z-10 font-medium text-slate-800 whitespace-nowrap">
                    <span className="font-mono">{row.machine_id}</span>
                    {row.machine_name ? (
                      <span className="block text-[9px] text-slate-500 truncate max-w-[140px]" title={row.machine_name}>
                        {row.machine_name}
                      </span>
                    ) : null}
                    {row.logged_in ? (
                      <span className="text-[8px] font-bold text-sky-700 uppercase">Live</span>
                    ) : null}
                  </td>
                  {FACTORY_HOURLY_SLOTS.map((slot) => {
                    const cell = row.cells[slot.value];
                    const clickable =
                      canEdit && cell.status === 'missing' && row.logged_in && onCellClick;
                    return (
                      <td key={slot.value} className="p-0 text-center">
                        <button
                          type="button"
                          disabled={!clickable}
                          title={
                            cell.status === 'future'
                              ? 'Not started yet'
                              : cell.status === 'missing'
                                ? 'Missing — click to add'
                                : cell.status === 'mes'
                                  ? `MES: ${cell.mesOutput} pairs`
                                  : cell.status === 'manual'
                                    ? `Manual: ${cell.manualOutput} pairs`
                                    : `Overlap MES ${cell.mesOutput} / Manual ${cell.manualOutput}`
                          }
                          onClick={() => clickable && onCellClick?.(row, slot.value)}
                          className={`w-full min-w-[2rem] h-7 rounded-md font-bold ring-1 transition-transform ${
                            CELL_CLASS[cell.status]
                          } ${clickable ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}
                        >
                          {CELL_LABEL[cell.status]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {hint ? (
            <p className="text-[10px] text-slate-500 mt-2 px-1">{hint}</p>
          ) : (
            <p className="text-[10px] text-slate-500 mt-2 px-1">
              Click a red missing cell (logged-in machines only) to open the entry form for that hour.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
