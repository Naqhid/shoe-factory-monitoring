import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const REASONS = [
  { label: 'Machine Breakdown', icon: '🔧' },
  { label: 'Material Shortage', icon: '📦' },
  { label: 'Power Cut', icon: '⚡' },
  { label: 'Maintenance', icon: '🛠️' },
  { label: 'Quality Issue', icon: '🔍' },
  { label: 'Operator Break', icon: '☕' },
  { label: 'Changeover', icon: '🔄' },
  { label: 'Other', icon: '📝' },
];

interface Props {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const StoppageReasonModal: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const [selected, setSelected] = React.useState('');
  const [custom, setCustom] = React.useState('');

  const finalReason = selected === 'Other' ? custom.trim() : selected;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span className="font-semibold text-gray-800">Why are you stopping?</span>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reason grid */}
        <div className="p-4 grid grid-cols-2 gap-2">
          {REASONS.map(({ label, icon }) => (
            <button
              key={label}
              onClick={() => setSelected(label)}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                selected === label
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-left leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {/* Custom input when Other selected */}
        {selected === 'Other' && (
          <div className="px-4 pb-2">
            <input
              type="text"
              placeholder="Describe the reason..."
              value={custom}
              onChange={e => setCustom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => finalReason && onConfirm(finalReason)}
            disabled={!finalReason}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Stop Production
          </button>
        </div>
      </div>
    </div>
  );
};
