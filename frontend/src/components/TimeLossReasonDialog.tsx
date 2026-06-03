import React from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import {
  M4_CATEGORIES,
  M4_REASON_OPTIONS,
  buildM4DetailText,
  parseM4FromDetail,
} from '../utils/m4ReasonUtils';

export type TimeLossReasonDialogProps = {
  open: boolean;
  machineName: string;
  netLossLabel: string | null;
  initialReason: string;
  saving: boolean;
  onSave: (reason: string) => void;
  onClose: () => void;
};

const fieldCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400';

export function TimeLossReasonDialog({
  open,
  machineName,
  netLossLabel,
  initialReason,
  saving,
  onSave,
  onClose,
}: TimeLossReasonDialogProps) {
  const [reasonCategory, setReasonCategory] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    const parsed = parseM4FromDetail(initialReason);
    setReasonCategory(parsed.reasonCategory);
    setReason(parsed.reason);
    setNotes(parsed.notes);
  }, [open, initialReason]);

  if (!open) return null;

  const canSave = !!reasonCategory && !!reason.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-loss-reason-title"
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl ring-1 ring-blue-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="min-w-0">
              <h3 id="time-loss-reason-title" className="text-sm font-bold text-gray-900 truncate">
                Time loss reason
              </h3>
              <p className="text-xs text-gray-500 truncate">{machineName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 max-h-[min(75vh,520px)] overflow-y-auto space-y-3">
          {netLossLabel && (
            <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
              Today&apos;s net time loss: <span className="font-bold">{netLossLabel}</span>
            </p>
          )}

          <section className="rounded-xl border border-blue-100/80 bg-blue-50/50 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">M4 reason</h4>
            <p className="text-xs text-gray-500 mb-3">
              Pick a category, then choose a suggested reason or type your own.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason Category <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {M4_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setReasonCategory(cat);
                    setReason('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                    reasonCategory === cat
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300/80'
                      : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="time-loss-m4-reason-options"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!reasonCategory}
              placeholder={
                reasonCategory ? 'Select from list or type your own' : 'Choose a category above first'
              }
              className={fieldCls}
            />
            <datalist id="time-loss-m4-reason-options">
              {(M4_REASON_OPTIONS[reasonCategory] || []).map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            {reasonCategory && (M4_REASON_OPTIONS[reasonCategory] || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(M4_REASON_OPTIONS[reasonCategory] || []).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      reason === r
                        ? 'bg-blue-600 text-white ring-2 ring-blue-300/80'
                        : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mt-4 mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${fieldCls} resize-y min-h-[64px]`}
              placeholder="Optional notes (action taken, etc.)"
            />
          </section>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => onSave(buildM4DetailText(reasonCategory, reason, notes))}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
