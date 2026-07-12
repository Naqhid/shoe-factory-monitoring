import React, { useState, useEffect, useMemo } from 'react';
import { Building, Cpu, Filter, X, RefreshCw } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { getEffectiveRole } from '../utils/roleConfig';
import { StoppageEntryTab } from './StoppageEntryTab';
import { ReworkRejectionEntryTab } from './ReworkRejectionEntryTab';

interface WorkCentre {
  id: number;
  name: string;
}

interface MachineCentre {
  id: number;
  name: string;
  machine_id: string;
}

type DatePreset = 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom';

const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getPresetDates = (preset: DatePreset): { from: string; to: string } => {
  const today = new Date();
  switch (preset) {
    case 'today':
      return { from: formatDate(today), to: formatDate(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: formatDate(y), to: formatDate(y) };
    }
    case 'last7': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: formatDate(start), to: formatDate(today) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: formatDate(start), to: formatDate(today) };
    }
    default:
      return { from: formatDate(today), to: formatDate(today) };
  }
};

export const ReworkRejectionTrackerPage: React.FC = () => {
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const effectiveRole = getEffectiveRole(userInfo);
  const isSupervisor = effectiveRole === 'Line Supervisor';
  const canEditRework = effectiveRole === 'Admin' || effectiveRole === 'Line Supervisor' || effectiveRole === 'Quality' || effectiveRole === 'Project Monitor';
  const canDeleteRework = effectiveRole === 'Admin' || effectiveRole === 'Project Monitor';
  const supervisorWorkCentreId = userInfo?.work_centre_id ? String(userInfo.work_centre_id) : '';

  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState(() => formatDate(new Date()));
  const [customTo, setCustomTo] = useState(() => formatDate(new Date()));

  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([]);
  const [machineCentres, setMachineCentres] = useState<MachineCentre[]>([]);
  const [selectedWorkCentre, setSelectedWorkCentre] = useState(isSupervisor ? supervisorWorkCentreId : '');
  const [selectedMachineCentre, setSelectedMachineCentre] = useState('');
  const [activeTab, setActiveTab] = useState<'rework_rejection' | 'breakdown'>('rework_rejection');
  const [refreshKey, setRefreshKey] = useState(0);

  const { from: dateFrom, to: dateTo } = useMemo(() => {
    if (datePreset === 'custom') return { from: customFrom, to: customTo };
    return getPresetDates(datePreset);
  }, [datePreset, customFrom, customTo]);

  // For child components that need a single selectedDate (for creating entries)
  const selectedDate = dateFrom;

  const effectiveWorkCentreId = isSupervisor ? supervisorWorkCentreId : selectedWorkCentre;
  const workCentreDisplayName = effectiveWorkCentreId
    ? isSupervisor
      ? String(userInfo?.work_centre_name || supervisorWorkCentreId)
      : workCentres.find((wc) => String(wc.id) === effectiveWorkCentreId)?.name || 'selected work centre'
    : '';

  useEffect(() => {
    const fetchWorkCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/tv-dashboard/work-centres`);
        const result = await response.json();
        if (result.success) setWorkCentres(result.data);
      } catch (error) {
        console.error('Error fetching work centres:', error);
      }
    };
    fetchWorkCentres();
  }, []);

  useEffect(() => {
    if (isSupervisor && supervisorWorkCentreId && workCentres.length > 0) {
      setSelectedWorkCentre(supervisorWorkCentreId);
    }
  }, [workCentres]);

  useEffect(() => {
    const fetchMachineCentres = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedWorkCentre) params.set('work_centre_id', selectedWorkCentre);
        params.set('limit', '500');
        const response = await apiFetch(`${API_BASE_URL}/api/masters/machine_centres?${params.toString()}`);
        const result = await response.json();
        if (result.success) {
          setMachineCentres(result.data);
          setSelectedMachineCentre('');
        }
      } catch (error) {
        console.error('Error fetching machine centres:', error);
      }
    };
    if (selectedWorkCentre) fetchMachineCentres();
  }, [selectedWorkCentre]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
  };

  const hasFilters = datePreset !== 'today' || selectedWorkCentre !== '' || selectedMachineCentre !== '';
  const clearFilters = () => {
    setDatePreset('today');
    setCustomFrom(formatDate(new Date()));
    setCustomTo(formatDate(new Date()));
    if (!isSupervisor) setSelectedWorkCentre('');
    setSelectedMachineCentre('');
  };

  const PRESET_BUTTONS: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last7', label: 'Last 7 days' },
    { key: 'this_month', label: 'This month' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Page header */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm p-4 sm:p-5 ring-1 ring-black/[0.02]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Quality</p>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                Rework / Rejection Tracker
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Track and manage rework and rejection quantities for production
              </p>
            </div>
          </div>
          {/* Tab buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('rework_rejection')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'rework_rejection'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Rework / Rejection
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('breakdown')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'breakdown'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Breakdown
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ring-1 ring-black/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" aria-hidden />
              <p className="text-sm font-bold text-slate-800">Filters</p>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear filters
              </button>
            )}
          </div>

          {/* Date presets */}
          <div className="mb-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Date range</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_BUTTONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePresetChange(p.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    datePreset === p.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range inputs */}
          {datePreset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  max={formatDate(new Date())}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow"
                />
              </div>
            </div>
          )}

          {/* Line and Machine filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                <span className="inline-flex items-center gap-1"><Building className="h-3 w-3" aria-hidden /> Line</span>
              </label>
              {isSupervisor ? (
                <input
                  type="text"
                  readOnly
                  value={userInfo?.work_centre_name || supervisorWorkCentreId}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 cursor-not-allowed"
                />
              ) : (
                <select
                  value={selectedWorkCentre}
                  onChange={(e) => setSelectedWorkCentre(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow"
                >
                  <option value="">All lines</option>
                  {workCentres.map((wc) => (
                    <option key={wc.id} value={wc.id}>{wc.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" aria-hidden /> Machine</span>
              </label>
              <select
                value={selectedMachineCentre}
                onChange={(e) => setSelectedMachineCentre(e.target.value)}
                disabled={!selectedWorkCentre}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 disabled:opacity-60 transition-shadow"
              >
                <option value="">All Machines</option>
                {machineCentres.map((mc) => (
                  <option key={mc.id} value={mc.name}>{mc.machine_id} - {mc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Load button */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Load
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'rework_rejection' && (
          <ReworkRejectionEntryTab
            selectedDate={selectedDate}
            dateFrom={dateFrom}
            dateTo={dateTo}
            refreshKey={refreshKey}
            selectedWorkCentre={selectedWorkCentre}
            selectedMachineCentre={selectedMachineCentre}
            machineCentres={machineCentres}
            workCentres={workCentres}
            isSupervisor={isSupervisor}
            supervisorWorkCentreId={supervisorWorkCentreId}
            workCentreDisplayName={workCentreDisplayName}
            canEditRework={canEditRework}
            canDeleteRework={canDeleteRework}
          />
        )}

        {activeTab === 'breakdown' && (
          <StoppageEntryTab
            entryKind="breakdown"
            selectedDate={selectedDate}
            selectedWorkCentre={selectedWorkCentre}
            selectedMachineCentre={selectedMachineCentre}
            machineCentres={machineCentres}
            workCentres={workCentres}
            isSupervisor={isSupervisor}
            supervisorWorkCentreId={supervisorWorkCentreId}
            userInfo={userInfo}
            workCentreDisplayName={workCentreDisplayName}
          />
        )}
      </div>
    </div>
  );
};
