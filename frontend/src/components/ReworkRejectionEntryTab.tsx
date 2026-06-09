import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Cpu,
  Edit,
  Loader2,
  Package,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, apiFetch } from '../services/api';
import {
  M4_BADGE_CLASS,
  M4_CATEGORIES,
  M4_REASON_OPTIONS,
  formatReasonDisplayLabel,
} from '../utils/m4ReasonUtils';

interface SavedRecord {
  id: number;
  machine_centre_name: string;
  total_output_pairs: number;
  bins_completed: number;
  rework_qty: number;
  rejection_qty: number;
  reason_category: string;
  reason: string;
  saved_at: string;
  production_date: string;
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

interface Props {
  selectedDate: string;
  selectedWorkCentre: string;
  selectedMachineCentre: string;
  machineCentres: MachineCentre[];
  workCentres: WorkCentre[];
  isSupervisor: boolean;
  supervisorWorkCentreId: string;
  workCentreDisplayName: string;
  canEditRework: boolean;
  canDeleteRework: boolean;
}

const REWORK_CFG = {
  label: 'Rework / Rejection',
  headerGradient: 'from-blue-600 via-blue-600 to-indigo-600',
  addBtnClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
  tabAccent: 'text-blue-700',
  modalRing: 'ring-blue-100',
  focusRing: 'focus:ring-blue-500/40 focus:border-blue-400',
  sectionClass: 'border-blue-100/80 bg-blue-50/50',
  chipActive: 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300/80',
  chipIdle: 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50 hover:border-blue-300',
  suggestChip: 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-300',
};

const inputClass = (focusRing: string) =>
  `w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm transition-colors focus:outline-none focus:ring-2 ${focusRing} disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`;

const defaultFormState = () => ({
  machineId: '',
  totalOutput: 0,
  targetPairs: 12,
  reworkQty: 0,
  rejectionQty: 0,
  reasonCategory: '',
  reason: '',
  notes: '',
});

export const ReworkRejectionEntryTab: React.FC<Props> = ({
  selectedDate,
  selectedWorkCentre,
  selectedMachineCentre,
  machineCentres,
  isSupervisor,
  supervisorWorkCentreId,
  workCentreDisplayName,
  canEditRework,
  canDeleteRework,
}) => {
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultFormState);
  const [loadingOutput, setLoadingOutput] = useState(false);

  const wcId = isSupervisor ? supervisorWorkCentreId : selectedWorkCentre;
  const fieldCls = inputClass(REWORK_CFG.focusRing);

  const fetchSavedRecords = async () => {
    if (!wcId || !selectedDate) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        work_centre_id: String(wcId),
        date: selectedDate,
      });
      if (selectedMachineCentre) query.set('machine_centre_name', selectedMachineCentre);
      const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection?${query.toString()}`);
      const result = await response.json();
      if (result.success) {
        setSavedRecords(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load rework/rejection entries');
      }
    } catch (error) {
      console.error('Error fetching rework/rejection:', error);
      toast.error('Failed to load rework/rejection entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wcId && selectedDate) {
      fetchSavedRecords();
    }
  }, [wcId, selectedDate, selectedMachineCentre]);

  const loadMachineOutput = async (machineId: string) => {
    if (!wcId || !selectedDate || !machineId) return;
    setLoadingOutput(true);
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/tv-dashboard/machine-centres/${wcId}?date=${selectedDate}`
      );
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const machine = machineCentres.find((mc) => mc.machine_id === machineId);
        const row = result.data.find(
          (r: { machine_centre_name?: string; machine_id?: string }) =>
            r.machine_centre_name === machine?.name ||
            String(r.machine_id) === String(machineId)
        );
        if (row) {
          const target = Number(row.target_pairs || 12);
          const output = Number(row.total_output_pairs || 0);
          setForm((prev) => ({
            ...prev,
            totalOutput: output,
            targetPairs: target,
          }));
        } else {
          setForm((prev) => ({ ...prev, totalOutput: 0, targetPairs: 12 }));
          toast.error('No production output found for this machine today');
        }
      }
    } catch {
      toast.error('Failed to load machine output');
    } finally {
      setLoadingOutput(false);
    }
  };

  useEffect(() => {
    if (form.machineId && modalOpen) {
      void loadMachineOutput(form.machineId);
    }
  }, [form.machineId, modalOpen, wcId, selectedDate]);

  const resetForm = () => {
    setEditId(null);
    setForm(defaultFormState());
  };

  const openModal = (rec?: SavedRecord) => {
    if (rec) {
      const machine = machineCentres.find((mc) => mc.name === rec.machine_centre_name);
      setEditId(rec.id);
      setForm({
        machineId: machine?.machine_id || '',
        totalOutput: Number(rec.total_output_pairs || 0),
        targetPairs: 12,
        reworkQty: Number(rec.rework_qty || 0),
        rejectionQty: Number(rec.rejection_qty || 0),
        reasonCategory: rec.reason_category || '',
        reason: rec.reason || '',
        notes: '',
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const binsCompleted = (output: number, target: number) =>
    target > 0 ? Math.floor(output / target) : 0;

  const recordToRow = (rec: SavedRecord) => ({
    machine_centre_name: rec.machine_centre_name,
    total_output_pairs: rec.total_output_pairs,
    bins_completed: rec.bins_completed,
    rework_qty: rec.rework_qty,
    rejection_qty: rec.rejection_qty,
    reason_category: rec.reason_category,
    reason: rec.reason,
  });

  const saveEntry = async () => {
    if (!wcId || !selectedDate) {
      toast.error('Please select date and work centre');
      return;
    }
    const machine = machineCentres.find((mc) => mc.machine_id === form.machineId);
    if (!machine) {
      toast.error('Please select a machine');
      return;
    }
    const reworkQty = Number(form.reworkQty || 0);
    const rejectionQty = Number(form.rejectionQty || 0);
    const totalOutput = Number(form.totalOutput || 0);
    if (reworkQty + rejectionQty > totalOutput) {
      toast.error(`Rework + rejection cannot exceed total output (${totalOutput})`);
      return;
    }
    if ((reworkQty > 0 || rejectionQty > 0) && (!form.reasonCategory || !form.reason.trim())) {
      toast.error('Please select reason category and reason when entering rework or rejection');
      return;
    }
    const reasonText = form.notes.trim()
      ? `${form.reason.trim()} — ${form.notes.trim()}`
      : form.reason.trim();

    const rowPayload = {
      machine_centre_name: machine.name,
      total_output_pairs: totalOutput,
      bins_completed: binsCompleted(totalOutput, form.targetPairs),
      rework_qty: reworkQty,
      rejection_qty: rejectionQty,
      reason_category: form.reasonCategory || null,
      reason: reasonText || null,
    };

    setSaving(true);
    try {
      if (editId) {
        const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rework_qty: reworkQty,
            rejection_qty: rejectionQty,
            reason_category: form.reasonCategory,
            reason: reasonText,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          toast.error(result.error || 'Failed to update entry');
          return;
        }
        toast.success('Rework / rejection entry updated');
      } else {
        const duplicate = savedRecords.find((r) => r.machine_centre_name === machine.name);
        const mergedRows = duplicate
          ? savedRecords.map((r) =>
              r.machine_centre_name === machine.name ? { ...recordToRow(r), ...rowPayload } : recordToRow(r)
            )
          : [...savedRecords.map(recordToRow), rowPayload];

        const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_centre_id: Number(wcId),
            production_date: selectedDate,
            rows: mergedRows,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          toast.error(result.error || 'Failed to save entry');
          return;
        }
        toast.success('Rework / rejection entry saved');
      }
      setModalOpen(false);
      resetForm();
      await fetchSavedRecords();
    } catch (error) {
      console.error('Error saving rework/rejection:', error);
      toast.error('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (rec: SavedRecord) => {
    if (!window.confirm(`Delete rework/rejection entry for ${rec.machine_centre_name}?`)) return;
    setSaving(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/rework-rejection/${rec.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error || 'Failed to delete entry');
        return;
      }
      toast.success('Entry deleted');
      await fetchSavedRecords();
    } catch {
      toast.error('Failed to delete entry');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (dt: string) => {
    const d = new Date(dt);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${REWORK_CFG.headerGradient} text-white shadow-md`}
          >
            <ClipboardList className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className={`text-lg font-semibold text-gray-900 ${REWORK_CFG.tabAccent}`}>
              {REWORK_CFG.label}
            </h2>
            <p className="text-sm text-gray-600 max-w-xl">
              Add rework and rejection quantities per machine for the selected work centre and date.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          disabled={!wcId}
          className={`text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${REWORK_CFG.addBtnClass}`}
        >
          Add Rework / Rejection Entry
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Saved Entries</h3>
            <p className="text-sm text-gray-600">
              Showing entries for {workCentreDisplayName || 'no work centre selected'} on {selectedDate}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSavedRecords}
            className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading entries...</span>
          </div>
        ) : savedRecords.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No rework / rejection entries for this date and work centre
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saved</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Output</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bins</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rework</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rejection</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {savedRecords.map((rec) => (
                  <tr key={rec.id} className={`hover:bg-gray-50 ${rec.rejection_qty > 10 ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(rec.saved_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{rec.machine_centre_name}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{rec.total_output_pairs}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{rec.bins_completed}</td>
                    <td className="px-4 py-3 text-sm text-center font-semibold text-yellow-600">
                      {rec.rework_qty}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-semibold text-red-600">
                      {rec.rejection_qty}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {rec.reason_category ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ring-1 ${
                            M4_BADGE_CLASS[rec.reason_category] || 'bg-gray-100 text-gray-700 ring-gray-200'
                          }`}
                        >
                          {rec.reason_category}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {rec.reason ? formatReasonDisplayLabel(rec.reason) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        {(canEditRework || canDeleteRework) && (
                          <>
                            {canEditRework && (
                            <button
                              type="button"
                              onClick={() => openModal(rec)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            )}
                            {canDeleteRework && (
                            <button
                              type="button"
                              onClick={() => deleteEntry(rec)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                    Totals:
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-yellow-600 text-center">
                    {savedRecords.reduce((s, r) => s + r.rework_qty, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600 text-center">
                    {savedRecords.reduce((s, r) => s + r.rejection_qty, 0)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rework-modal-title"
        >
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden ring-1 ${REWORK_CFG.modalRing} flex flex-col max-h-[92vh]`}
          >
            <div
              className={`bg-gradient-to-r ${REWORK_CFG.headerGradient} px-5 py-4 sm:px-6 text-white flex items-start justify-between gap-3`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <ClipboardList className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 id="rework-modal-title" className="text-lg sm:text-xl font-bold truncate">
                    {editId ? 'Edit Rework / Rejection Entry' : 'New Rework / Rejection Entry'}
                  </h2>
                  <p className="text-sm text-white/90 mt-0.5">MAN · MACHINE · MATERIAL · METHOD</p>
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
              <section className={`rounded-xl border p-4 ${REWORK_CFG.sectionClass}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Machine &amp; production
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Cpu className="h-4 w-4 text-gray-400" aria-hidden />
                      Machine Centre <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.machineId}
                      onChange={(e) => setForm((prev) => ({ ...prev, machineId: e.target.value }))}
                      disabled={!!editId}
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
                      <Package className="h-4 w-4 text-gray-400" aria-hidden />
                      Total output (pairs)
                      {loadingOutput && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 ml-1" />
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.totalOutput}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, totalOutput: Number(e.target.value) || 0 }))
                      }
                      className={fieldCls}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Bins completed: {binsCompleted(form.totalOutput, form.targetPairs)}
                    </p>
                  </div>
                </div>
              </section>

              <section className={`rounded-xl border p-4 ${REWORK_CFG.sectionClass}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Quantities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Rework qty</label>
                    <input
                      type="number"
                      min="0"
                      max={form.totalOutput}
                      value={form.reworkQty === 0 ? '' : form.reworkQty}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          reworkQty: e.target.value === '' ? 0 : Number(e.target.value),
                        }))
                      }
                      placeholder="0"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection qty</label>
                    <input
                      type="number"
                      min="0"
                      max={form.totalOutput}
                      value={form.rejectionQty === 0 ? '' : form.rejectionQty}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          rejectionQty: e.target.value === '' ? 0 : Number(e.target.value),
                        }))
                      }
                      placeholder="0"
                      className={fieldCls}
                    />
                  </div>
                </div>
              </section>

              <section className={`rounded-xl border p-4 ${REWORK_CFG.sectionClass}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">M4 reason</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Required when rework or rejection is greater than zero.
                </p>

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
                        form.reasonCategory === cat ? REWORK_CFG.chipActive : REWORK_CFG.chipIdle
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
                  list="rework-reason-options"
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  disabled={!form.reasonCategory}
                  placeholder={
                    form.reasonCategory ? 'Select from list or type your own' : 'Choose a category above first'
                  }
                  className={fieldCls}
                />
                <datalist id="rework-reason-options">
                  {(M4_REASON_OPTIONS[form.reasonCategory] || []).map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                {form.reasonCategory && (M4_REASON_OPTIONS[form.reasonCategory] || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(M4_REASON_OPTIONS[form.reasonCategory] || []).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, reason: r }))}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          form.reason === r ? REWORK_CFG.chipActive : REWORK_CFG.suggestChip
                        }`}
                      >
                        {formatReasonDisplayLabel(r)}
                      </button>
                    ))}
                  </div>
                )}

                <label className="block text-sm font-medium text-gray-700 mt-4 mb-1.5">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={`${fieldCls} resize-y min-h-[60px]`}
                  placeholder="Optional detail (action taken, defect type, etc.)"
                />
              </section>
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
                className={`px-5 py-2.5 rounded-lg text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg ${REWORK_CFG.addBtnClass}`}
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
