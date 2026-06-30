import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Cpu,
  Edit,
  Loader2,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, apiFetch } from '../services/api';
import { formatTimeHHMM } from '../utils/dateTimeFormat';

export interface StoppageEntry {
  id: number;
  prod_date: string;
  work_centre_id: number;
  work_centre_name?: string;
  machine_id: string;
  machine_name?: string;
  emp_id: string;
  employee_name?: string;
  start_time: string;
  finish_time: string | null;
  button_status?: number;
  idle_start_time?: string | null;
  stoppage_reason?: string;
  created_at: string;
}

interface MachineCentre {
  id: number;
  name: string;
  machine_id: string;
}

interface WorkCentre {
  id: number;
  name: string;
}

type EntryKind = 'bottleneck' | 'breakdown';

import {
  M4_BADGE_CLASS,
  M4_CATEGORIES,
  M4_REASON_OPTIONS,
  buildM4DetailText,
  parseM4FromDetail,
} from '../utils/m4ReasonUtils';

const REASON_OPTIONS = M4_REASON_OPTIONS;

const CONFIG: Record<
  EntryKind,
  {
    label: string;
    apiType: string;
    prefix: string;
    detailLabel: string;
    placeholder: string;
    addBtnClass: string;
    tabAccent: string;
    headerGradient: string;
    modalRing: string;
    focusRing: string;
    sectionClass: string;
    chipActive: string;
    chipIdle: string;
    suggestChip: string;
  }
> = {
  bottleneck: {
    label: 'Bottleneck',
    apiType: 'bottleneck',
    prefix: 'BOTTLENECK',
    detailLabel: 'M4 Analysis',
    placeholder: 'Optional notes (root cause, action taken, etc.)',
    addBtnClass: 'bg-red-600 hover:bg-red-700 shadow-red-200',
    tabAccent: 'text-red-600',
    headerGradient: 'from-red-600 via-red-600 to-orange-600',
    modalRing: 'ring-red-100',
    focusRing: 'focus:ring-red-500/40 focus:border-red-400',
    sectionClass: 'border-red-100/80 bg-red-50/50',
    chipActive: 'bg-red-600 text-white shadow-md ring-2 ring-red-300/80',
    chipIdle: 'bg-white text-red-900 border-red-200 hover:bg-red-50 hover:border-red-300',
    suggestChip: 'bg-white text-red-800 border-red-200 hover:bg-red-50 hover:border-red-300',
  },
  breakdown: {
    label: 'Breakdown',
    apiType: 'breakdown',
    prefix: 'BREAKDOWN',
    detailLabel: 'M4 analysis',
    placeholder: 'Optional notes (action taken, parts replaced, etc.)',
    addBtnClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
    tabAccent: 'text-amber-700',
    headerGradient: 'from-amber-500 via-amber-600 to-orange-600',
    modalRing: 'ring-amber-100',
    focusRing: 'focus:ring-amber-500/40 focus:border-amber-400',
    sectionClass: 'border-amber-100/80 bg-amber-50/50',
    chipActive: 'bg-amber-600 text-white shadow-md ring-2 ring-amber-300/80',
    chipIdle: 'bg-white text-amber-950 border-amber-200 hover:bg-amber-50 hover:border-amber-300',
    suggestChip: 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50 hover:border-amber-300',
  },
};

const inputClass = (focusRing: string) =>
  `w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm transition-colors focus:outline-none focus:ring-2 ${focusRing} disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`;

interface Props {
  entryKind: EntryKind;
  selectedDate: string;
  selectedWorkCentre: string;
  selectedMachineCentre: string;
  machineCentres: MachineCentre[];
  workCentres: WorkCentre[];
  isSupervisor: boolean;
  supervisorWorkCentreId: string;
  userInfo: Record<string, unknown>;
  workCentreDisplayName: string;
}

const getNowTimeString = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const defaultFormState = () => ({
  machineId: '',
  empId: '',
  startTime: getNowTimeString(),
  finishTime: '',
  reasonCategory: '',
  reason: '',
  notes: '',
});

const isEntryInProgress = (entry: StoppageEntry) =>
  Number(entry.button_status) === 1 || !entry.finish_time;

const stripStoppagePrefix = (detail?: string | null, prefix?: string) => {
  if (!detail) return '';
  let text = String(detail);
  if (prefix) {
    const re = new RegExp(`^${prefix}:`, 'i');
    text = text.replace(re, '');
  }
  return text.replace(/\s*\[Approved By:[^\]]+\]\s*$/i, '').trim();
};

export const StoppageEntryTab: React.FC<Props> = ({
  entryKind,
  selectedDate,
  selectedWorkCentre,
  selectedMachineCentre,
  machineCentres,
  workCentres,
  isSupervisor,
  supervisorWorkCentreId,
  userInfo,
  workCentreDisplayName,
}) => {
  const cfg = CONFIG[entryKind];
  const [entries, setEntries] = useState<StoppageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultFormState);
  const [auditReason, setAuditReason] = useState('');

  const wcId = isSupervisor ? supervisorWorkCentreId : selectedWorkCentre;

  const fetchEntries = async () => {
    if (!wcId || !selectedDate) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        date: selectedDate,
        work_centre_id: String(wcId),
        type: cfg.apiType,
        limit: '200',
      });
      if (selectedMachineCentre) {
        const machine = machineCentres.find((mc) => mc.name === selectedMachineCentre);
        if (machine?.machine_id) query.set('machine_id', machine.machine_id);
      }
      const response = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry?${query.toString()}`);
      const result = await response.json();
      if (result.success) {
        setEntries(result.data || []);
      } else {
        toast.error(result.message || `Failed to load ${cfg.label.toLowerCase()} entries`);
      }
    } catch (error) {
      console.error(`Error fetching ${cfg.label} entries:`, error);
      toast.error(`Failed to load ${cfg.label.toLowerCase()} entries`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wcId && selectedDate) {
      fetchEntries();
    }
  }, [entryKind, wcId, selectedDate, selectedMachineCentre, machineCentres]);

  const resetForm = () => {
    setEditId(null);
    setForm(defaultFormState());
    setAuditReason('');
  };

  const openModal = (entry?: StoppageEntry) => {
    if (entry) {
      const parsed = parseM4FromDetail(stripStoppagePrefix(entry.stoppage_reason, cfg.prefix));
      setEditId(entry.id);
      setForm({
        machineId: entry.machine_id,
        empId: entry.emp_id,
        startTime: formatTimeHHMM(entry.start_time) || formatTimeHHMM(entry.idle_start_time),
        finishTime: formatTimeHHMM(entry.finish_time),
        reasonCategory: parsed.reasonCategory,
        reason: parsed.reason,
        notes: parsed.notes,
      });
      setAuditReason('');
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const applyFinishTimeNow = () => {
    setForm((prev) => ({ ...prev, finishTime: getNowTimeString() }));
  };

  const saveEntry = async () => {
    if (!wcId || !selectedDate) {
      toast.error('Please select date and work centre');
      return;
    }
    const { machineId, empId, startTime, finishTime, reasonCategory, reason, notes } = form;
    if (!machineId) {
      toast.error('Please select a machine');
      return;
    }
    if (!empId.trim()) {
      toast.error('Please enter the operator code');
      return;
    }
    if (!startTime) {
      toast.error('Please select start time');
      return;
    }
    if (finishTime && finishTime <= startTime) {
      toast.error('Finish time must be after start time');
      return;
    }
    if (!reasonCategory || !reason.trim()) {
      toast.error('Please select M4 reason category and reason');
      return;
    }
    if (editId && !auditReason.trim()) {
      toast.error('Please enter an audit reason for edits');
      return;
    }

    const payload: Record<string, unknown> = {
      prod_date: selectedDate,
      work_centre_id: Number(wcId),
      machine_id: machineId,
      emp_id: empId.trim(),
      start_time: `${selectedDate}T${startTime}:00`,
      target_mins: 0,
      output_pairs: 0,
      stoppage_reason: buildM4DetailText(reasonCategory, reason.trim(), notes),
      entry_type: cfg.apiType,
      approved_by: userInfo?.username || userInfo?.name || userInfo?.email || userInfo?.id || null,
    };
    if (finishTime.trim()) {
      payload.finish_time = `${selectedDate}T${finishTime}:00`;
    } else {
      payload.finish_time = null;
    }
    if (editId) {
      payload.audit_reason = auditReason.trim();
    }

    setSaving(true);
    try {
      const url = editId
        ? `${API_BASE_URL}/api/mobile-production/manual-entry/${editId}`
        : `${API_BASE_URL}/api/mobile-production/manual-entry`;
      const response = await apiFetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.message || `Failed to save ${cfg.label.toLowerCase()} entry`);
        return;
      }
      toast.success(editId ? `${cfg.label} entry updated` : `${cfg.label} entry created`);
      setModalOpen(false);
      resetForm();
      await fetchEntries();
    } catch (error) {
      console.error(`Error saving ${cfg.label} entry:`, error);
      toast.error(`Failed to save ${cfg.label.toLowerCase()} entry`);
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entry: StoppageEntry) => {
    const reason = window.prompt(`Enter delete reason for this ${cfg.label.toLowerCase()} entry`);
    if (!reason || !reason.trim()) {
      toast.error('Delete reason is required');
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/${entry.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_reason: reason.trim() }),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.message || `Failed to delete ${cfg.label.toLowerCase()} entry`);
        return;
      }
      toast.success(`${cfg.label} entry deleted`);
      await fetchEntries();
    } catch (error) {
      console.error(`Error deleting ${cfg.label} entry:`, error);
      toast.error(`Failed to delete ${cfg.label.toLowerCase()} entry`);
    } finally {
      setSaving(false);
    }
  };

  const ModalIcon = entryKind === 'breakdown' ? Wrench : AlertTriangle;
  const fieldCls = inputClass(cfg.focusRing);

  return (
    <>
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${cfg.headerGradient} text-white shadow-md`}
          >
            <ModalIcon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className={`text-lg font-semibold text-gray-900 ${cfg.tabAccent}`}>{cfg.label}</h2>
            <p className="text-sm text-gray-600 max-w-xl">
              Add, edit, and remove {cfg.label.toLowerCase()} events for the selected work centre and date. Shown on the TV dashboard.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          className={`text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition-all hover:shadow-lg ${cfg.addBtnClass}`}
        >
          Add {cfg.label} Entry
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{cfg.label} Entries</h3>
            <p className="text-sm text-gray-600">
              Showing entries for {workCentreDisplayName || 'no work centre selected'} on {(() => { const [y, m, d] = selectedDate.split('-'); return `${m}/${d}/${y}`; })()}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchEntries}
            className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading {cfg.label.toLowerCase()} entries...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No {cfg.label.toLowerCase()} entries found for this date and work centre
          </div>
        ) : (
          <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Finish</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(entry.prod_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {entry.machine_id} {entry.machine_name ? `- ${entry.machine_name}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.emp_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatTimeHHMM(entry.start_time) || formatTimeHHMM(entry.idle_start_time) || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEntryInProgress(entry) ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                          In progress
                        </span>
                      ) : (
                        <span className="text-gray-900">{formatTimeHHMM(entry.finish_time)}</span>
                      )}
                    </td>
                    {(() => {
                      const parsed = parseM4FromDetail(stripStoppagePrefix(entry.stoppage_reason, cfg.prefix));
                      return (
                        <>
                          <td className="px-4 py-3 text-sm">
                            {parsed.reasonCategory ? (
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ring-1 ${
                                  M4_BADGE_CLASS[parsed.reasonCategory] || 'bg-gray-100 text-gray-700 ring-gray-200'
                                }`}
                              >
                                {parsed.reasonCategory}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{parsed.reason || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{parsed.notes || '—'}</td>
                        </>
                      );
                    })()}
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openModal(entry)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2 p-2">
            {entries.map((entry) => {
              const parsed = parseM4FromDetail(stripStoppagePrefix(entry.stoppage_reason, cfg.prefix));
              const startTime = formatTimeHHMM(entry.start_time) || formatTimeHHMM(entry.idle_start_time) || '—';
              const inProgress = isEntryInProgress(entry);
              return (
                <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-900">{entry.machine_id}</span>
                        {entry.machine_name && <span className="text-[11px] text-gray-600">{entry.machine_name}</span>}
                        {inProgress && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-amber-200">
                            In progress
                          </span>
                        )}
                        {parsed.reasonCategory && (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ring-1 ${M4_BADGE_CLASS[parsed.reasonCategory] || 'bg-gray-100 text-gray-700 ring-gray-200'}`}>
                            {parsed.reasonCategory}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(entry.prod_date).toLocaleDateString('en-GB')} · {startTime}{inProgress ? '' : ` → ${formatTimeHHMM(entry.finish_time)}`} · Emp: {entry.emp_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => openModal(entry)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => deleteEntry(entry)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {(parsed.reason || parsed.notes) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-700">
                      {parsed.reason && <p><span className="font-semibold text-gray-500">Reason:</span> {parsed.reason}</p>}
                      {parsed.notes && <p className="mt-0.5 text-gray-500">{parsed.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stoppage-modal-title"
        >
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden ring-1 ${cfg.modalRing} flex flex-col max-h-[92vh]`}
          >
            <div className={`bg-gradient-to-r ${cfg.headerGradient} px-5 py-4 sm:px-6 text-white flex items-start justify-between gap-3`}>
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <ModalIcon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 id="stoppage-modal-title" className="text-lg sm:text-xl font-bold truncate">
                    {editId ? `Edit ${cfg.label} Entry` : `New ${cfg.label} Entry`}
                  </h2>
                  <p className="text-sm text-white/90 mt-0.5">
                    M4 analysis · MAN · MACHINE · MATERIAL · METHOD
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="shrink-0 rounded-full p-1.5 text-white/90 hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 sm:px-6 space-y-5">
              <section className={`rounded-xl border p-4 ${cfg.sectionClass}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Machine &amp; operator</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Cpu className="h-4 w-4 text-gray-400" aria-hidden />
                      Machine Centre <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.machineId}
                      onChange={(e) => setForm((prev) => ({ ...prev, machineId: e.target.value }))}
                      className={fieldCls}
                    >
                      <option value="">Select Machine</option>
                      {machineCentres.map((mc) => (
                        <option key={mc.id} value={mc.machine_id}>
                          {mc.machine_id} - {mc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <User className="h-4 w-4 text-gray-400" aria-hidden />
                      Operator Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.empId}
                      onChange={(e) => setForm((prev) => ({ ...prev, empId: e.target.value }))}
                      className={fieldCls}
                      placeholder="Enter operator code"
                    />
                  </div>
                </div>
              </section>

              <section className={`rounded-xl border p-4 ${cfg.sectionClass}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Timing</h3>
                <p className="text-xs text-gray-500 mb-3">
                  {editId
                    ? 'Start time is when the event began. Add finish time when the machine is back up.'
                    : 'Start time defaults to now. Leave finish empty until the breakdown or bottleneck is resolved.'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Clock className="h-4 w-4 text-gray-400" aria-hidden />
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Clock className="h-4 w-4 text-gray-400" aria-hidden />
                        Finish Time
                        {!editId && (
                          <span className="text-gray-400 font-normal text-xs">(optional)</span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={applyFinishTimeNow}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-50"
                      >
                        Set to now
                      </button>
                    </div>
                    <input
                      type="time"
                      value={form.finishTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, finishTime: e.target.value }))}
                      className={fieldCls}
                      placeholder="Leave empty while in progress"
                    />
                    {!form.finishTime && (
                      <p className="text-xs text-amber-700 mt-1 font-medium">In progress — shown on TV until finish is set</p>
                    )}
                  </div>
                </div>
              </section>

              <section className={`rounded-xl border p-4 ${cfg.sectionClass}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">M4 reason</h3>
                <p className="text-xs text-gray-500 mb-3">Pick a category, then choose a suggested reason or type your own.</p>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason Category <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {M4_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, reasonCategory: cat, reason: '' }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                        form.reasonCategory === cat ? cfg.chipActive : cfg.chipIdle
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
                  list={`stoppage-reason-options-${entryKind}`}
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  disabled={!form.reasonCategory}
                  placeholder={form.reasonCategory ? 'Select from list or type your own' : 'Choose a category above first'}
                  className={fieldCls}
                />
                <datalist id={`stoppage-reason-options-${entryKind}`}>
                  {(REASON_OPTIONS[form.reasonCategory] || []).map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                {form.reasonCategory && (REASON_OPTIONS[form.reasonCategory] || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(REASON_OPTIONS[form.reasonCategory] || []).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, reason: r }))}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          form.reason === r ? cfg.chipActive : cfg.suggestChip
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}

                <label className="block text-sm font-medium text-gray-700 mt-4 mb-1.5">
                  {cfg.detailLabel} notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={`${fieldCls} resize-y min-h-[80px]`}
                  placeholder={cfg.placeholder}
                />
              </section>

              {editId && (
                <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                  <label className="block text-sm font-medium text-amber-900 mb-1.5">
                    Edit audit reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    className={`${fieldCls} border-amber-200 focus:ring-amber-500/40 focus:border-amber-400`}
                    placeholder="Why are you editing this entry?"
                  />
                </section>
              )}
            </div>

            <div className="flex flex-wrap gap-3 justify-end px-5 py-4 sm:px-6 border-t border-gray-100 bg-gray-50/80">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEntry}
                disabled={saving}
                className={`px-5 py-2.5 rounded-lg text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg ${cfg.addBtnClass}`}
              >
                {saving ? 'Saving...' : editId ? 'Update Entry' : 'Create Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
