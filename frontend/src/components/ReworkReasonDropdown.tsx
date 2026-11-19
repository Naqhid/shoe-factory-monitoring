import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Edit, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, apiFetch } from '../services/api';

interface Reason {
  id: number;
  name: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const BASE = `${API_BASE_URL}/api/rework-reasons`;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const ReworkReasonDropdown: React.FC<Props> = ({ value, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reason | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(BASE);
      const result = await res.json();
      if (result.success) setReasons(result.data || []);
      else toast.error(result.error || 'Failed to load reasons');
    } catch {
      toast.error('Failed to load reasons');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const request = async (url: string, method: string, body?: object) => {
    setBusy(true);
    try {
      const res = await apiFetch(url, {
        method,
        headers: JSON_HEADERS,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || 'Request failed');
        return false;
      }
      await load();
      return true;
    } catch {
      toast.error('Request failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addReason = async () => {
    const name = newName.trim();
    if (!name) return;
    if (await request(BASE, 'POST', { name })) {
      setNewName('');
      setAdding(false);
      onChange(name);
      toast.success('Reason added');
    }
  };

  const saveEdit = async (r: Reason) => {
    const name = editName.trim();
    if (!name) return;
    if (name !== r.name && !(await request(`${BASE}/${r.id}`, 'PUT', { name }))) return;
    if (value === r.name && name !== r.name) onChange(name);
    setEditingId(null);
  };

  const confirmDelete = async () => {
    const r = deleteTarget;
    if (!r) return;
    if (await request(`${BASE}/${r.id}`, 'DELETE')) {
      if (value === r.name) onChange('');
      toast.success('Reason deleted');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${className} flex items-center justify-between text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || 'Select reason'}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md">
          <ul className="max-h-48 overflow-y-auto overscroll-contain py-1" role="listbox">
            {value && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
                >
                  Clear selection
                </button>
              </li>
            )}
            {reasons.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">No reasons yet. Add one below.</li>
            )}
            {reasons.map((r, idx) => (
              <li key={r.id} className="flex items-center gap-1 px-2 hover:bg-blue-50">
                {editingId === r.id ? (
                  <>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveEdit(r);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 my-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button type="button" disabled={busy} onClick={() => saveEdit(r)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Save">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Cancel">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === r.name}
                      onClick={() => {
                        onChange(r.name);
                        setOpen(false);
                      }}
                      className={`flex-1 py-2 text-left text-sm ${value === r.name ? 'font-semibold text-blue-700' : 'text-gray-800'}`}
                    >
                      {idx + 1}. {r.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id);
                        setEditName(r.name);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                      title="Edit"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-100 p-2">
            {adding ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addReason();
                    if (e.key === 'Escape') setAdding(false);
                  }}
                  placeholder="New reason"
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button type="button" disabled={busy} onClick={addReason} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Add">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Cancel">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" /> Add new reason
              </button>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-reason-title"
        >
          <div className="w-full max-w-xs rounded-xl bg-white p-4 shadow-2xl">
            <h4 id="delete-reason-title" className="text-sm font-semibold text-gray-900">
              Delete reason?
            </h4>
            <p className="mt-1 text-sm text-gray-600 break-words">
              "{deleteTarget.name}" will be removed from the list.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
