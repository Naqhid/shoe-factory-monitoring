import React from 'react';
import toast from 'react-hot-toast';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';

interface LockInfo {
  locked_by_name?: string;
  locked_at?: string;
  notes?: string | null;
}

interface ProductionDayLockPanelProps {
  date: string;
  workCentreId: number | string | null | undefined;
  workCentreName?: string;
  compact?: boolean;
  onLockChange?: (locked: boolean) => void;
}

function canLockRole(role: string): boolean {
  const r = role.toLowerCase();
  return r === 'admin' || r === 'line supervisor' || r === 'supervisor';
}

function canUnlockRole(role: string): boolean {
  return role.toLowerCase() === 'admin';
}

export const ProductionDayLockPanel: React.FC<ProductionDayLockPanelProps> = ({
  date,
  workCentreId,
  workCentreName,
  compact = false,
  onLockChange,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [locked, setLocked] = React.useState(false);
  const [lockInfo, setLockInfo] = React.useState<LockInfo | null>(null);
  const [confirmLock, setConfirmLock] = React.useState(false);
  const [confirmUnlock, setConfirmUnlock] = React.useState(false);
  const [lockNotes, setLockNotes] = React.useState('');

  const user = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user_info') || 'null');
    } catch {
      return null;
    }
  }, []);
  const role = String(user?.role || '');
  const mayLock = canLockRole(role);
  const mayUnlock = canUnlockRole(role);

  const wcId = workCentreId != null && String(workCentreId).trim() !== '' ? Number(workCentreId) : null;
  const dateKey = String(date || '').split('T')[0];

  const refreshStatus = React.useCallback(async () => {
    if (!wcId || !dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      setLocked(false);
      setLockInfo(null);
      onLockChange?.(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(
        `${API_BASE_URL}/api/production-lock?date=${encodeURIComponent(dateKey)}&work_centre_id=${wcId}`
      );
      const result = await res.json();
      if (result.success) {
        const isLocked = Boolean(result.locked);
        setLocked(isLocked);
        setLockInfo(isLocked ? (result.data as LockInfo) : null);
        onLockChange?.(isLocked);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [wcId, dateKey, onLockChange]);

  React.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleLock = async () => {
    if (!wcId || !dateKey) return;
    setActing(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/production-lock/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateKey,
          work_centre_id: wcId,
          notes: lockNotes.trim() || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Production locked for ${dateKey}`);
        setConfirmLock(false);
        setLockNotes('');
        await refreshStatus();
      } else {
        toast.error(result.error || 'Failed to lock day');
      }
    } catch {
      toast.error('Failed to lock day');
    } finally {
      setActing(false);
    }
  };

  const handleUnlock = async () => {
    if (!wcId || !dateKey) return;
    setActing(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/production-lock/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey, work_centre_id: wcId }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Production unlocked for ${dateKey}`);
        setConfirmUnlock(false);
        await refreshStatus();
      } else {
        toast.error(result.error || 'Failed to unlock day');
      }
    } catch {
      toast.error('Failed to unlock day');
    } finally {
      setActing(false);
    }
  };

  if (!wcId || !dateKey) {
    return compact ? null : (
      <p className="text-xs text-gray-500">Select a line and single date to lock or unlock production.</p>
    );
  }

  const lineLabel = workCentreName || `Line ${wcId}`;
  const lockedAtLabel = lockInfo?.locked_at
    ? new Date(lockInfo.locked_at).toLocaleString()
    : null;

  return (
    <>
      <ConfirmDialog
        isOpen={confirmLock}
        title="Lock production day?"
        message={`After locking, no one can add or edit mobile production, manual entries, WIP, or rework for ${lineLabel} on ${dateKey}. Continue?`}
        confirmText={acting ? 'Locking…' : 'Lock day'}
        onConfirm={handleLock}
        onCancel={() => {
          if (!acting) setConfirmLock(false);
        }}
      />
      <ConfirmDialog
        isOpen={confirmUnlock}
        title="Unlock production day?"
        message={`Unlocking allows edits again for ${lineLabel} on ${dateKey}. Only use this for approved corrections.`}
        confirmText={acting ? 'Unlocking…' : 'Unlock day'}
        onConfirm={handleUnlock}
        onCancel={() => {
          if (!acting) setConfirmUnlock(false);
        }}
      />

      <div
        className={
          compact
            ? `rounded-xl border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
                locked ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
              }`
            : `rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                locked ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
              }`
        }
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500 shrink-0" />
            ) : locked ? (
              <Lock className="h-4 w-4 text-amber-700 shrink-0" />
            ) : (
              <Unlock className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <p className={`text-sm font-bold ${locked ? 'text-amber-900' : 'text-slate-800'}`}>
              {locked ? 'Day locked — edits blocked' : 'Day open — edits allowed'}
            </p>
          </div>
          <p className="text-xs text-slate-600 mt-1 truncate">
            {lineLabel} · {dateKey}
            {locked && lockInfo?.locked_by_name ? ` · Locked by ${lockInfo.locked_by_name}` : ''}
            {locked && lockedAtLabel ? ` · ${lockedAtLabel}` : ''}
          </p>
          {locked && lockInfo?.notes ? (
            <p className="text-xs text-amber-800 mt-1">Note: {lockInfo.notes}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!locked && mayLock && !compact && (
            <input
              type="text"
              value={lockNotes}
              onChange={(e) => setLockNotes(e.target.value)}
              placeholder="Optional note (e.g. EOD sign-off)"
              className="h-9 min-w-[180px] flex-1 border border-slate-300 rounded-lg px-2 text-sm bg-white"
              maxLength={255}
            />
          )}
          {!locked && mayLock ? (
            <button
              type="button"
              onClick={() => setConfirmLock(true)}
              disabled={acting || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              Lock day
            </button>
          ) : null}
          {locked && mayUnlock ? (
            <button
              type="button"
              onClick={() => setConfirmUnlock(true)}
              disabled={acting || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Unlock className="h-4 w-4" />
              Unlock (Admin)
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
};
