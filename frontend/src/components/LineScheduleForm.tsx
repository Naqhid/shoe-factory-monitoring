import React from 'react';
import {
  Calendar,
  Factory,
  Loader2,
  RefreshCw,
  Repeat2,
  Search,
  Shirt,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

interface MasterOption {
  id: number;
  code: string;
  name: string;
}

interface BoardLine {
  work_centre_id: number;
  work_centre_code: string;
  work_centre_name: string;
  assignment_id: number | null;
  effective_from_date: string | null;
  style_id: number | null;
  style_code: string | null;
  style_name: string | null;
  customer_name: string | null;
  group_name: string | null;
  leather_name: string | null;
  color_name: string | null;
  notes: string | null;
  plan_id: number | null;
  plan_style_id: number | null;
  plan_style_code: string | null;
  plan_style_name: string | null;
}

interface RoutingPreview {
  customer_name?: string;
  group_name?: string;
  leather_name?: string;
  color_name?: string;
  target_per_day?: number;
  tot_smv?: number;
  lines?: Array<{ observed_time: number; rating_factor: number; manpower: number }>;
}

interface HistoryEntry {
  id: number;
  assignment_date: string;
  style_id: number;
  style_code: string;
  style_name: string;
  customer_name: string | null;
  color_name: string | null;
  notes: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'assigned' | 'unassigned' | 'mismatch';

const todayKey = () => new Date().toISOString().split('T')[0];

const formatDateLabel = (value: string) => {
  const part = String(value || '').split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return part || '—';
  const [y, m, d] = part.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
};

// Color palette for customer-based color coding
const CUSTOMER_COLORS: Record<string, { border: string; bg: string; badge: string }> = {};
const COLOR_PALETTE = [
  { border: 'border-blue-300', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800 ring-blue-200' },
  { border: 'border-emerald-300', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  { border: 'border-orange-300', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-800 ring-orange-200' },
  { border: 'border-pink-300', bg: 'bg-pink-50', badge: 'bg-pink-100 text-pink-800 ring-pink-200' },
  { border: 'border-cyan-300', bg: 'bg-cyan-50', badge: 'bg-cyan-100 text-cyan-800 ring-cyan-200' },
  { border: 'border-amber-300', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-800 ring-amber-200' },
  { border: 'border-indigo-300', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  { border: 'border-rose-300', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-800 ring-rose-200' },
];
let nextColorIdx = 0;

function getCustomerColor(customerName: string | null) {
  if (!customerName) return { border: 'border-slate-200', bg: 'bg-white', badge: 'bg-gray-100 text-gray-700 ring-gray-200' };
  if (!CUSTOMER_COLORS[customerName]) {
    CUSTOMER_COLORS[customerName] = COLOR_PALETTE[nextColorIdx % COLOR_PALETTE.length];
    nextColorIdx++;
  }
  return CUSTOMER_COLORS[customerName];
}

export const LineScheduleForm: React.FC = () => {
  const [boardDate, setBoardDate] = React.useState(todayKey());
  const [lines, setLines] = React.useState<BoardLine[]>([]);
  const [styles, setStyles] = React.useState<MasterOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [styleSearch, setStyleSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

  const [showModal, setShowModal] = React.useState(false);
  const [selectedLine, setSelectedLine] = React.useState<BoardLine | null>(null);
  const [changeoverStyleId, setChangeoverStyleId] = React.useState('');
  const [startDate, setStartDate] = React.useState(todayKey());
  const [usePlanRange, setUsePlanRange] = React.useState(false);
  const [planThroughDate, setPlanThroughDate] = React.useState(todayKey());
  const [updatePlan, setUpdatePlan] = React.useState(true);
  const [notes, setNotes] = React.useState('');
  const [routingPreview, setRoutingPreview] = React.useState<RoutingPreview | null>(null);
  const [loadingRouting, setLoadingRouting] = React.useState(false);

  // History panel state
  const [showHistory, setShowHistory] = React.useState(false);
  const [historyLine, setHistoryLine] = React.useState<BoardLine | null>(null);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  // Drag and drop state
  const [dragSource, setDragSource] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);

  const loadMasters = React.useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/masters/styles`);
      const json = await res.json();
      if (json.success) setStyles(json.data || []);
    } catch {
      toast.error('Failed to load styles');
    }
  }, []);

  const loadBoard = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/line-schedule/board?date=${encodeURIComponent(boardDate)}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load schedule');
      setLines(json.data?.lines || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load line schedule');
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [boardDate]);

  React.useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  React.useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const filteredStyles = React.useMemo(() => {
    const q = styleSearch.trim().toLowerCase();
    if (!q) return styles.slice(0, 80);
    return styles
      .filter((s) => s.code?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))
      .slice(0, 80);
  }, [styles, styleSearch]);

  const assignedCount = lines.filter((l) => l.assignment_id).length;
  const unassignedCount = lines.filter((l) => !l.assignment_id).length;
  const mismatchCount = lines.filter(
    (l) => l.assignment_id && l.plan_id && l.style_id !== l.plan_style_id
  ).length;

  // Filter lines by status
  const filteredLines = React.useMemo(() => {
    switch (statusFilter) {
      case 'assigned':
        return lines.filter((l) => l.assignment_id);
      case 'unassigned':
        return lines.filter((l) => !l.assignment_id);
      case 'mismatch':
        return lines.filter((l) => l.assignment_id && l.plan_id && l.style_id !== l.plan_style_id);
      default:
        return lines;
    }
  }, [lines, statusFilter]);

  const openChangeover = (line: BoardLine) => {
    setSelectedLine(line);
    setChangeoverStyleId(line.style_id ? String(line.style_id) : '');
    setStartDate(boardDate);
    setUsePlanRange(false);
    setPlanThroughDate(boardDate);
    setUpdatePlan(true);
    setNotes(line.notes || '');
    setRoutingPreview(null);
    setStyleSearch('');
    setShowModal(true);
    if (line.style_id) {
      loadRoutingPreview(String(line.style_id));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLine(null);
    setChangeoverStyleId('');
    setRoutingPreview(null);
  };

  const loadRoutingPreview = async (styleId: string) => {
    if (!styleId) {
      setRoutingPreview(null);
      return;
    }
    setLoadingRouting(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/production-routing/style/${styleId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setRoutingPreview(json.data);
      } else {
        setRoutingPreview(null);
        if (res.status !== 404) toast.error(json.error || 'Could not load routing');
      }
    } catch {
      setRoutingPreview(null);
      toast.error('Error loading routing preview');
    } finally {
      setLoadingRouting(false);
    }
  };

  const handleStylePick = (styleId: string) => {
    setChangeoverStyleId(styleId);
    loadRoutingPreview(styleId);
  };

  const openHistory = async (line: BoardLine) => {
    setHistoryLine(line);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/line-schedule/history/${line.work_centre_id}?limit=20`);
      const json = await res.json();
      if (res.ok && json.success) {
        setHistory(json.data || []);
      } else {
        setHistory([]);
        toast.error(json.error || 'Failed to load history');
      }
    } catch {
      setHistory([]);
      toast.error('Failed to load changeover history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, workCentreId: number) => {
    const line = lines.find((l) => l.work_centre_id === workCentreId);
    if (!line || !line.assignment_id) {
      e.preventDefault();
      return;
    }
    setDragSource(workCentreId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(workCentreId));
  };

  const handleDragOver = (e: React.DragEvent, workCentreId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(workCentreId);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = async (e: React.DragEvent, targetWorkCentreId: number) => {
    e.preventDefault();
    setDragOver(null);
    const sourceWorkCentreId = dragSource;
    setDragSource(null);
    if (!sourceWorkCentreId || sourceWorkCentreId === targetWorkCentreId) return;

    const sourceLine = lines.find((l) => l.work_centre_id === sourceWorkCentreId);
    if (!sourceLine || !sourceLine.style_id) return;

    // Perform changeover: assign source's style to target line
    try {
      const res = await apiFetch(`${API_BASE}/api/line-schedule/changeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_centre_id: targetWorkCentreId,
          from_date: boardDate,
          style_id: sourceLine.style_id,
          update_plan: true,
          open_ended: true,
          notes: `Drag-reassigned from ${sourceLine.work_centre_code}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Reassignment failed');
      toast.success(`Style moved to target line`);
      loadBoard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reassign style');
    }
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOver(null);
  };

  const submitChangeover = async () => {
    if (!selectedLine || !changeoverStyleId) {
      toast.error('Select a style for the changeover');
      return;
    }
    if (!startDate) {
      toast.error('Start date is required');
      return;
    }
    if (usePlanRange && planThroughDate < startDate) {
      toast.error('Plan through date cannot be before start date');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        work_centre_id: selectedLine.work_centre_id,
        from_date: startDate,
        style_id: Number(changeoverStyleId),
        update_plan: updatePlan,
        notes: notes.trim() || null,
        open_ended: !usePlanRange,
      };
      if (usePlanRange) {
        body.to_date = planThroughDate;
      }

      const res = await apiFetch(`${API_BASE}/api/line-schedule/changeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Changeover failed');
      toast.success(json.message || 'Article updated on line');
      closeModal();
      if (startDate <= boardDate && (!usePlanRange || planThroughDate >= boardDate)) {
        loadBoard();
      }
    } catch (e: any) {
      toast.error(e.message || 'Changeover failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-4 sm:p-5 shadow-sm mb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-2.5 py-1 ring-1 ring-violet-200">
              <Repeat2 className="h-3.5 w-3.5 text-violet-700" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800">Line schedule</span>
            </div>
            <h1 className="mt-3 text-xl sm:text-2xl font-bold text-gray-900">Article on Line</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Record when a new article <strong>starts</strong> on a line. Drag cards to reassign styles between lines.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 shrink-0">
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              Schedule date
              <input
                type="date"
                value={boardDate}
                onChange={(e) => setBoardDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={loadBoard}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-violet-700">
            <Factory className="h-4 w-4" />
            <p className="text-[11px] font-bold uppercase tracking-wide">Work centres</p>
          </div>
          <p className="text-3xl font-black text-violet-900 mt-2 tabular-nums">{lines.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-[11px] font-bold uppercase tracking-wide">Assigned</p>
          </div>
          <p className="text-3xl font-black text-emerald-900 mt-2 tabular-nums">{assignedCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-[11px] font-bold uppercase tracking-wide">Plan mismatch</p>
          </div>
          <p className="text-3xl font-black text-amber-900 mt-2 tabular-nums">{mismatchCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Calendar className="h-4 w-4" />
            <p className="text-[11px] font-bold uppercase tracking-wide">Viewing</p>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-2">{formatDateLabel(boardDate)}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter:</span>
        {([
          { key: 'all', label: 'All', count: lines.length },
          { key: 'assigned', label: 'Assigned', count: assignedCount },
          { key: 'unassigned', label: 'Unassigned', count: unassignedCount },
          { key: 'mismatch', label: 'Mismatch', count: mismatchCount },
        ] as const).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === f.key
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f.label}
            <span className={`tabular-nums ${statusFilter === f.key ? 'text-violet-200' : 'text-gray-400'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Unassigned lines warning banner */}
      {unassignedCount > 0 && boardDate === todayKey() && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {unassignedCount} line{unassignedCount > 1 ? 's' : ''} without an article today
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              These lines should be producing. Assign an article or mark them idle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('unassigned')}
            className="ml-auto shrink-0 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-semibold"
          >
            Show unassigned
          </button>
        </div>
      )}

      {/* Line cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredLines.map((line) => {
            const hasAssignment = Boolean(line.assignment_id);
            const carriedForward = Boolean(
              line.effective_from_date && line.effective_from_date < boardDate
            );
            const planMismatch = hasAssignment && line.plan_id && line.style_id !== line.plan_style_id;
            const customerColor = getCustomerColor(line.customer_name);
            const isDragTarget = dragOver === line.work_centre_id;
            const isDragSource = dragSource === line.work_centre_id;

            return (
              <div
                key={line.work_centre_id}
                draggable={hasAssignment}
                onDragStart={(e) => handleDragStart(e, line.work_centre_id)}
                onDragOver={(e) => handleDragOver(e, line.work_centre_id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, line.work_centre_id)}
                onDragEnd={handleDragEnd}
                className={[
                  'rounded-xl border p-4 shadow-sm transition-all',
                  hasAssignment ? customerColor.bg : 'bg-white',
                  planMismatch
                    ? 'border-amber-300 ring-1 ring-amber-100'
                    : !hasAssignment
                      ? 'border-red-200 border-dashed'
                      : customerColor.border,
                  isDragTarget ? 'ring-2 ring-violet-400 scale-[1.02]' : '',
                  isDragSource ? 'opacity-50' : '',
                  hasAssignment ? 'cursor-grab active:cursor-grabbing' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {hasAssignment && (
                      <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {line.work_centre_code}
                      </p>
                      <h3 className="text-lg font-bold text-gray-900">{line.work_centre_name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {planMismatch && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 ring-1 ring-amber-200">
                        Plan differs
                      </span>
                    )}
                    {!hasAssignment && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 ring-1 ring-red-200">
                        Idle
                      </span>
                    )}
                  </div>
                </div>

                {hasAssignment ? (
                  <div className="mt-3 space-y-1">
                    {carriedForward && line.effective_from_date && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
                        Active since {formatDateLabel(line.effective_from_date)}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-violet-700">
                      <Shirt className="h-4 w-4 shrink-0" />
                      <p className="font-semibold text-gray-900">
                        {line.style_code} — {line.style_name}
                      </p>
                    </div>
                    {line.customer_name && (
                      <span className={`inline-flex items-center ml-6 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${customerColor.badge}`}>
                        {line.customer_name}
                      </span>
                    )}
                    <p className="text-xs text-gray-500 pl-6">
                      {[line.leather_name, line.color_name].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {line.plan_style_name && (
                      <p className="text-xs text-gray-500 pl-6">
                        Plan: {line.plan_style_code} — {line.plan_style_name}
                      </p>
                    )}
                    {line.notes && (
                      <p className="text-xs italic text-gray-500 pl-6 mt-1">{line.notes}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-red-600 font-medium">
                    No article assigned — this line should be producing.
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openChangeover(line)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 text-sm font-semibold"
                  >
                    <Repeat2 className="h-4 w-4" />
                    {hasAssignment ? 'Change' : 'Assign'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openHistory(line)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 text-sm font-semibold"
                    title="View changeover history"
                  >
                    <Clock className="h-4 w-4" />
                    History
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Changeover modal */}
      {showModal && selectedLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Changeover</p>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedLine.work_centre_code} — {selectedLine.work_centre_name}
                </h2>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-sm text-violet-900">
                The article runs from the start date until you record the <strong>next changeover</strong> on this line. No end date is required.
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                Start date (changeover)
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!usePlanRange) setPlanThroughDate(e.target.value);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={usePlanRange}
                  onChange={(e) => {
                    setUsePlanRange(e.target.checked);
                    if (!e.target.checked) setPlanThroughDate(startDate);
                  }}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span>
                  Pre-fill production plans for multiple days
                  <span className="block text-xs font-normal text-gray-500 mt-0.5">
                    Optional — only if you already know how long this article will run
                  </span>
                </span>
              </label>

              {usePlanRange && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Plan through date
                  <input
                    type="date"
                    value={planThroughDate}
                    min={startDate}
                    onChange={(e) => setPlanThroughDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600">Style</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={styleSearch}
                    onChange={(e) => setStyleSearch(e.target.value)}
                    placeholder="Search by code or name…"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                  {filteredStyles.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No styles found</p>
                  ) : (
                    filteredStyles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleStylePick(String(s.id))}
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-violet-50 ${
                          changeoverStyleId === String(s.id) ? 'bg-violet-100 font-semibold' : ''
                        }`}
                      >
                        <span className="font-mono text-violet-700">{s.code}</span> — {s.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {loadingRouting ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading routing…
                </div>
              ) : routingPreview ? (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-gray-700 space-y-1">
                  <p className="font-semibold text-gray-900">Routing defaults</p>
                  <p>Customer: {routingPreview.customer_name || '—'}</p>
                  <p>Target/day: {routingPreview.target_per_day ?? '—'}</p>
                  <p>SMV: {routingPreview.tot_smv ?? '—'}</p>
                </div>
              ) : changeoverStyleId ? (
                <p className="text-sm text-amber-700">No routing found for this style — create routing first.</p>
              ) : null}

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={updatePlan}
                  onChange={(e) => setUpdatePlan(e.target.checked)}
                  className="rounded border-gray-300"
                />
                {usePlanRange
                  ? 'Update production plans from routing for each day in the range'
                  : 'Update today\'s production plan from routing (keeps pairs/tray if plan exists)'}
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                Notes (optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal"
                  placeholder="e.g. Changeover after style ABC completed"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitChangeover}
                disabled={saving || !changeoverStyleId || !routingPreview}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
                Apply changeover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Changeover History panel */}
      {showHistory && historyLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Changeover history</p>
                <h2 className="text-lg font-bold text-gray-900">
                  {historyLine.work_centre_code} — {historyLine.work_centre_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowHistory(false); setHistoryLine(null); }}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-10">No changeover history found for this line.</p>
              ) : (
                <div className="relative pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-violet-200" />
                  <div className="space-y-4">
                    {history.map((entry, idx) => (
                      <div key={entry.id} className="relative">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[18px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${
                          idx === 0 ? 'bg-violet-600' : 'bg-violet-300'
                        }`} />
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {entry.style_code} — {entry.style_name}
                            </p>
                            {idx === 0 && (
                              <span className="text-[10px] font-bold uppercase text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Started: {formatDateLabel(entry.assignment_date)}
                            {entry.customer_name ? ` · ${entry.customer_name}` : ''}
                            {entry.color_name ? ` · ${entry.color_name}` : ''}
                          </p>
                          {entry.notes && (
                            <p className="text-xs italic text-gray-400 mt-1">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
