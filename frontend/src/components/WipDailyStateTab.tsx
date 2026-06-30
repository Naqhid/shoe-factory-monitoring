import React from 'react';
import { AlertCircle, CheckCircle2, Edit, Loader2, PackageOpen, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, apiFetch } from '../services/api';
import { formatWip } from '../utils/wipUtils';

interface WorkCentre {
  id: number;
  name: string;
}

export interface WipDailyStateRow {
  id: number;
  work_centre_id: number;
  work_centre_name?: string | null;
  state_date: string;
  opening_wip: number;
  today_input: number;
  current_wip: number;
  closing_wip: number;
  is_closed: boolean;
  created_at?: string;
  updated_at?: string;
}

interface OnboardingLine {
  work_centre_id: number;
  work_centre_name: string;
  input_machine_id: string | null;
  eol_machine_id: string | null;
  machines_configured: boolean;
}

interface WipDailyStateTabProps {
  workCentres: WorkCentre[];
  canEdit: boolean;
}

const getTodayLocalDate = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const emptyForm = () => ({
  work_centre_id: '',
  state_date: getTodayLocalDate(),
  opening_wip: '0',
  today_input: '0',
  current_wip: '0',
  closing_wip: '0',
  is_closed: false,
});

export const WipDailyStateTab: React.FC<WipDailyStateTabProps> = ({ workCentres, canEdit }) => {
  const [rows, setRows] = React.useState<WipDailyStateRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [lineFilter, setLineFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteCandidate, setDeleteCandidate] = React.useState<WipDailyStateRow | null>(null);

  const [onboardingDate, setOnboardingDate] = React.useState(getTodayLocalDate());
  const [linesNeedingSetup, setLinesNeedingSetup] = React.useState<OnboardingLine[]>([]);
  const [onboardingLoading, setOnboardingLoading] = React.useState(false);
  const [onboardLineId, setOnboardLineId] = React.useState('');
  const [onboardOpeningWip, setOnboardOpeningWip] = React.useState('0');
  const [onboarding, setOnboarding] = React.useState(false);

  const loadOnboarding = React.useCallback(async () => {
    setOnboardingLoading(true);
    try {
      const params = new URLSearchParams({ date: onboardingDate });
      const res = await apiFetch(`${API_BASE_URL}/api/wip-daily-state/onboarding?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        return;
      }
      const lines: OnboardingLine[] = json.data?.lines_needing_setup || [];
      setLinesNeedingSetup(lines);
      setOnboardLineId((current) => {
        if (current && lines.some((l) => String(l.work_centre_id) === current)) {
          return current;
        }
        if (!lines.length) return '';
        const ready = lines.find((l) => l.machines_configured);
        return String((ready || lines[0]).work_centre_id);
      });
    } catch (error) {
      console.error('Failed to load WIP onboarding status:', error);
    } finally {
      setOnboardingLoading(false);
    }
  }, [onboardingDate]);

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sort_order: 'desc',
      });
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      if (lineFilter) params.set('work_centre_id', lineFilter);

      const res = await apiFetch(`${API_BASE_URL}/api/wip-daily-state?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Failed to load WIP records');
        return;
      }
      setRows(json.data || []);
      setTotal(json.pagination?.total ?? 0);
      setTotalPages(json.pagination?.totalPages ?? 1);
    } catch (error) {
      console.error('Failed to load WIP records:', error);
      toast.error('Failed to load WIP records');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, fromDate, toDate, lineFilter]);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  React.useEffect(() => {
    loadOnboarding();
  }, [loadOnboarding]);

  const selectedOnboardLine = linesNeedingSetup.find((l) => String(l.work_centre_id) === onboardLineId);

  const handleOnboard = async () => {
    if (!onboardLineId) {
      toast.error('Select a line to onboard');
      return;
    }
    if (selectedOnboardLine && !selectedOnboardLine.machines_configured) {
      toast.error('Set Input and EOL machines on the work centre in Master Data first');
      return;
    }
    setOnboarding(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/wip-daily-state/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_centre_id: Number(onboardLineId),
          state_date: onboardingDate,
          opening_wip: Number(onboardOpeningWip) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Failed to start WIP tracking');
        return;
      }
      toast.success(json.message || 'WIP tracking started');
      setOnboardOpeningWip('0');
      await Promise.all([loadOnboarding(), loadRows()]);
    } catch (error) {
      console.error('WIP onboard failed:', error);
      toast.error('Failed to start WIP tracking');
    } finally {
      setOnboarding(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (row: WipDailyStateRow) => {
    setEditingId(row.id);
    setForm({
      work_centre_id: String(row.work_centre_id),
      state_date: row.state_date,
      opening_wip: String(row.opening_wip),
      today_input: String(row.today_input),
      current_wip: String(row.current_wip),
      closing_wip: String(row.closing_wip),
      is_closed: row.is_closed,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.work_centre_id || !form.state_date) {
      toast.error('Line and date are required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        work_centre_id: Number(form.work_centre_id),
        state_date: form.state_date,
        opening_wip: Number(form.opening_wip) || 0,
        today_input: Number(form.today_input) || 0,
        current_wip: Number(form.current_wip) || 0,
        closing_wip: Number(form.closing_wip) || 0,
        is_closed: form.is_closed,
      };
      const url = editingId
        ? `${API_BASE_URL}/api/wip-daily-state/${editingId}`
        : `${API_BASE_URL}/api/wip-daily-state`;
      const res = await apiFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || json.error || 'Failed to save WIP record');
        return;
      }
      toast.success(editingId ? 'WIP record updated' : 'WIP record created');
      setShowForm(false);
      setEditingId(null);
      await loadRows();
    } catch (error) {
      console.error('WIP save failed:', error);
      toast.error('Failed to save WIP record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: WipDailyStateRow) => {
    setSaving(true);
    try {
      const params = new URLSearchParams({
        state_date: row.state_date,
        work_centre_id: String(row.work_centre_id),
      });
      const res = await apiFetch(`${API_BASE_URL}/api/wip-daily-state/${row.id}?${params.toString()}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || json.error || 'Failed to delete WIP record');
        return;
      }
      toast.success('WIP record deleted');
      setDeleteCandidate(null);
      await loadRows();
    } catch (error) {
      console.error('WIP delete failed:', error);
      toast.error('Failed to delete WIP record');
    } finally {
      setSaving(false);
    }
  };

  const computedFromFormula = Math.max(
    0,
    Math.round((Number(form.opening_wip) || 0) + (Number(form.today_input) || 0) - (Number(form.current_wip) || 0))
  );

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className={`rounded-xl border p-4 ${
          linesNeedingSetup.length > 0
            ? 'border-amber-200 bg-amber-50'
            : 'border-green-200 bg-green-50'
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                {linesNeedingSetup.length > 0 ? (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                New line WIP setup
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                {linesNeedingSetup.length > 0
                  ? `${linesNeedingSetup.length} active line${linesNeedingSetup.length === 1 ? '' : 's'} have no WIP row for the selected date. Seed opening WIP here instead of manual SQL.`
                  : `All active lines have WIP seeded for ${onboardingDate}.`}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Setup date</label>
              <input
                type="date"
                value={onboardingDate}
                onChange={(e) => setOnboardingDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
              />
            </div>
          </div>

          {onboardingLoading ? (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking lines...
            </div>
          ) : linesNeedingSetup.length > 0 ? (
            <>
              <ul className="text-xs text-gray-700 space-y-1 mb-4">
                {linesNeedingSetup.map((line) => (
                  <li key={line.work_centre_id} className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{line.work_centre_name}</span>
                    {line.machines_configured ? (
                      <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        Input {line.input_machine_id} · EOL {line.eol_machine_id}
                      </span>
                    ) : (
                      <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                        Set Input &amp; EOL machines in Work Centres master
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
                  <select
                    value={onboardLineId}
                    onChange={(e) => setOnboardLineId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select line</option>
                    {linesNeedingSetup.map((line) => (
                      <option key={line.work_centre_id} value={line.work_centre_id}>
                        {line.work_centre_name}
                        {!line.machines_configured ? ' (needs machines)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Opening WIP</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={onboardOpeningWip}
                    onChange={(e) => setOnboardOpeningWip(e.target.value)}
                    className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleOnboard}
                  disabled={onboarding || !onboardLineId || !selectedOnboardLine?.machines_configured}
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {onboarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="h-4 w-4" />}
                  Start WIP tracking
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Creates the first WIP row for this line. Current WIP then updates live from production (opening + input − output).
              </p>
            </>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
          <select
            value={lineFilter}
            onChange={(e) => { setLineFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="">All Lines</option>
            {workCentres.map((wc) => (
              <option key={wc.id} value={wc.id}>{wc.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={loadRows}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add WIP Record
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <PackageOpen className="inline h-3.5 w-3.5 mr-1 text-amber-600" />
        WIP formula: <span className="font-semibold">Current WIP = Opening WIP + Input − Output</span>.
        Input is summed from the line input machine (e.g. 01 Quarter Zig Zag Stitching). Dashboard auto-updates from production; use this tab to seed or correct rows.
        Future dates are hidden here. Checking Day closed at end of shift carries closing WIP to the next day only when closing WIP is greater than zero.
      </p>

      <div className="hidden sm:block overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Line</th>
              <th className="px-3 py-2 text-right font-semibold">Opening</th>
              <th className="px-3 py-2 text-right font-semibold">Input</th>
              <th className="px-3 py-2 text-right font-semibold">Current</th>
              <th className="px-3 py-2 text-right font-semibold">Closing</th>
              <th className="px-3 py-2 text-center font-semibold">Closed</th>
              {canEdit && <th className="px-3 py-2 text-center font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-3 py-8 text-center text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-3 py-8 text-center text-gray-500">
                  No WIP records found
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{row.state_date}</td>
                  <td className="px-3 py-2">{row.work_centre_name || row.work_centre_id}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatWip(row.opening_wip)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatWip(row.today_input)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-700">{formatWip(row.current_wip)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatWip(row.closing_wip)}</td>
                  <td className="px-3 py-2 text-center">
                    {row.is_closed ? (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Yes</span>
                    ) : (
                      <span className="text-xs text-gray-500">No</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(row)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {loading && rows.length === 0 ? (
          <div className="px-3 py-8 text-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-8 text-center text-gray-500">No WIP records found</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-gray-900">{row.work_centre_name || row.work_centre_id}</span>
                  <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums">{row.state_date}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {row.is_closed ? (
                    <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Closed</span>
                  ) : (
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Open</span>
                  )}
                  {canEdit && (
                    <>
                      <button type="button" onClick={() => openEdit(row)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setDeleteCandidate(row)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Opening</p>
                  <p className="text-xs font-semibold tabular-nums text-gray-700">{formatWip(row.opening_wip)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-cyan-500">Input</p>
                  <p className="text-xs font-semibold tabular-nums text-cyan-700">{formatWip(row.today_input)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-amber-500">Current</p>
                  <p className="text-sm font-black tabular-nums text-amber-700">{formatWip(row.current_wip)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Closing</p>
                  <p className="text-xs font-semibold tabular-nums text-gray-700">{formatWip(row.closing_wip)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {total > 10 && (
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-gray-600 mt-3">
        <span>{total} record{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white"
          >
            <option value={5}>5/page</option>
            <option value={10}>10/page</option>
            <option value={20}>20/page</option>
            <option value={50}>50/page</option>
          </select>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-xs sm:text-sm"
          >
            Prev
          </button>
          <span className="px-2 py-1 tabular-nums text-xs">{page}/{totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-xs sm:text-sm"
          >
            Next
          </button>
        </div>
      </div>
      )}

      {showForm && canEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? `Edit WIP Record #${editingId}` : 'Add WIP Record'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Line</label>
                <select
                  value={form.work_centre_id}
                  onChange={(e) => setForm((f) => ({ ...f, work_centre_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                >
                  <option value="">Select line</option>
                  {workCentres.map((wc) => (
                    <option key={wc.id} value={wc.id}>{wc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.state_date}
                  onChange={(e) => setForm((f) => ({ ...f, state_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2.5">
                  <input
                    type="checkbox"
                    checked={form.is_closed}
                    onChange={(e) => setForm((f) => ({ ...f, is_closed: e.target.checked }))}
                  />
                  Day closed
                </label>
              </div>
              {(['opening_wip', 'today_input', 'current_wip', 'closing_wip'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {field.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              While the day is open, current WIP is recalculated live: opening + machine input − output.
              {!form.is_closed && (
                <span className="block mt-1 text-gray-600">
                  Implied output from your numbers above = opening + today input − current = {computedFromFormula}
                </span>
              )}
            </p>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && canEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900">Delete WIP Record</h2>
            <p className="text-sm text-gray-600 mt-2">
              Delete WIP for <span className="font-semibold">{deleteCandidate.work_centre_name || deleteCandidate.work_centre_id}</span> on{' '}
              <span className="font-semibold">{deleteCandidate.state_date}</span>?
            </p>
            <p className="text-xs text-red-600 mt-2">This may affect TV dashboard WIP display for that day.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={saving}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteCandidate)}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
