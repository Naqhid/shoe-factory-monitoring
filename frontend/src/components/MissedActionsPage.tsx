import React from 'react';
import { AlertTriangle, BellOff, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

type MissedAction = {
  issue_key: string;
  session_id: string;
  machine_id: string;
  machine_name: string;
  employee_code: string;
  employee_name: string;
  work_centre_name: string;
  action_type: 'START_PENDING' | 'FINISH_PENDING';
  action_label: string;
  overdue_mins: number;
  details: string;
  state?: {
    acknowledged?: boolean;
    acknowledged_at?: string | null;
    snoozed_until?: string | null;
    is_snoozed?: boolean;
  };
};

export const MissedActionsPage: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isActionLoading, setIsActionLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<MissedAction[]>([]);
  const [summary, setSummary] = React.useState({ total: 0, start_pending: 0, finish_pending: 0 });
  const [selectedLine, setSelectedLine] = React.useState<string>('all');
  const [issueFilter, setIssueFilter] = React.useState<'all' | 'START_PENDING' | 'FINISH_PENDING'>('all');
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [showMuted, setShowMuted] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions?startReminderMins=10&finishGraceMins=0`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load missed actions');
      setItems(result.data || []);
      setSummary(result.summary || { total: 0, start_pending: 0, finish_pending: 0 });
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to load missed actions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const id = window.setInterval(() => {
      fetchData();
    }, 30000);
    return () => window.clearInterval(id);
  }, [fetchData]);

  const lineOptions = React.useMemo(() => {
    return Array.from(new Set(items.map((i) => i.work_centre_name).filter(Boolean))).sort();
  }, [items]);

  const getSeverity = (overdueMins: number) => {
    if (overdueMins >= 60) return { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' };
    if (overdueMins >= 30) return { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (overdueMins >= 10) return { label: 'Medium', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Low', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
  };

  const visibleItems = React.useMemo(() => {
    if (showMuted) return items;
    return items.filter((item) => {
      if (item.state?.acknowledged) return false;
      if (item.state?.is_snoozed) return false;
      return true;
    });
  }, [items, showMuted]);

  const filteredItems = React.useMemo(() => {
    return visibleItems.filter((item) => {
      if (selectedLine !== 'all' && item.work_centre_name !== selectedLine) return false;
      if (issueFilter !== 'all' && item.action_type !== issueFilter) return false;
      return true;
    });
  }, [visibleItems, selectedLine, issueFilter]);

  const filteredSummary = React.useMemo(() => {
    return {
      total: filteredItems.length,
      start_pending: filteredItems.filter((i) => i.action_type === 'START_PENDING').length,
      finish_pending: filteredItems.filter((i) => i.action_type === 'FINISH_PENDING').length,
    };
  }, [filteredItems]);

  const groupedItems = React.useMemo(() => {
    return filteredItems.reduce<Record<string, MissedAction[]>>((acc, item) => {
      const key = item.work_centre_name || 'Unknown Line';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [filteredItems]);

  const acknowledgeItem = async (item: MissedAction) => {
    if (!item.issue_key) return;
    setIsActionLoading(item.issue_key);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_key: item.issue_key }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to acknowledge');
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to acknowledge');
    } finally {
      setIsActionLoading(null);
    }
  };

  const snoozeItem = async (item: MissedAction, mins: number) => {
    if (!item.issue_key) return;
    setIsActionLoading(item.issue_key);
    try {
      const response = await apiFetch(`${API_BASE}/api/missed-actions/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_key: item.issue_key, minutes: mins }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to snooze');
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to snooze');
    } finally {
      setIsActionLoading(null);
    }
  };

  const exportFilteredCsv = () => {
    if (filteredItems.length === 0) return;
    const headers = ['line', 'machine', 'operator', 'issue', 'overdue_mins', 'severity', 'details'];
    const rows = [
      headers.join(','),
      ...filteredItems.map((i) => {
        const severity = getSeverity(i.overdue_mins).label;
        const vals = [
          i.work_centre_name,
          i.machine_name,
          `${i.employee_name} (${i.employee_code})`,
          i.action_label,
          String(i.overdue_mins),
          severity,
          i.details,
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        return vals.join(',');
      }),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missed_actions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Missed Start / Finish</h1>
            <p className="text-sm text-gray-500 mt-1">
              Machines where operators likely forgot to click START or FINISH.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Not updated yet'}
            </p>
            <p className="text-xs text-gray-400">Auto-refresh every 30s</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMuted((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
                showMuted ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              <BellOff className="h-3.5 w-3.5" />
              {showMuted ? 'Showing Muted' : 'Hide Muted'}
            </button>
            <button
              onClick={exportFilteredCsv}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-semibold uppercase">Total Alerts</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{filteredSummary.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs text-amber-700 font-semibold uppercase">Start Not Clicked</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{filteredSummary.start_pending}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
            <p className="text-xs text-red-700 font-semibold uppercase">Finish Not Clicked</p>
            <p className="text-3xl font-bold text-red-700 mt-1">{filteredSummary.finish_pending}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Line</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="all">All Lines</option>
                {lineOptions.map((line) => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Issue Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIssueFilter('all')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border ${issueFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setIssueFilter('START_PENDING')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border ${issueFilter === 'START_PENDING' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  Start Pending
                </button>
                <button
                  type="button"
                  onClick={() => setIssueFilter('FINISH_PENDING')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border ${issueFilter === 'FINISH_PENDING' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  Finish Pending
                </button>
              </div>
            </div>
            <div className="ml-auto text-xs text-gray-500">
              Showing {filteredItems.length} of {items.length} total
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="py-10 px-6 text-center">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-10 px-6 text-center text-gray-500">
              No records match current filters.
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {Object.entries(groupedItems).map(([lineName, lineItems]) => (
                <div key={lineName} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-700">{lineName}</p>
                    <span className="text-xs text-gray-500">{lineItems.length} issue(s)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Machine</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Operator</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Issue</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Severity</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Overdue</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Details</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lineItems.map((item) => {
                          const severity = getSeverity(item.overdue_mins);
                          return (
                            <tr key={`${item.session_id}-${item.machine_id}-${item.action_type}`}>
                              <td className="px-3 py-2.5 text-sm font-semibold text-gray-800">{item.machine_name}</td>
                              <td className="px-3 py-2.5 text-sm text-gray-700">{item.employee_name} ({item.employee_code})</td>
                              <td className="px-3 py-2.5 text-sm">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  item.action_type === 'START_PENDING'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {item.action_label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-sm">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${severity.cls}`}>
                                  {severity.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-sm font-bold text-gray-800">{item.overdue_mins} mins</td>
                              <td className="px-3 py-2.5 text-sm text-gray-600">{item.details}</td>
                              <td className="px-3 py-2.5 text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => acknowledgeItem(item)}
                                    disabled={isActionLoading === item.issue_key}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Ack
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => snoozeItem(item, 30)}
                                    disabled={isActionLoading === item.issue_key}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                                  >
                                    <BellOff className="h-3.5 w-3.5" /> Snooze 30m
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

