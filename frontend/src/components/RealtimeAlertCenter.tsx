import React from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, apiFetch } from '../services/api';

type Severity = 'info' | 'warning' | 'critical';

interface AlertRow {
  id: number;
  alert_type: string;
  severity: Severity;
  work_centre_name?: string;
  machine_id?: string;
  machine_name?: string;
  message: string;
  threshold_value?: number;
  actual_value?: number;
  created_at: string;
  is_acknowledged: number;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  alert_ids?: number[];
  occurrence_count?: number;
  first_seen_at?: string;
  last_seen_at?: string;
}

const alertTypeLabel: Record<string, string> = {
  over_target: 'Over Target',
  idle_too_long: 'Idle Too Long',
  no_scan_heartbeat: 'No Cycle Update (Finish Pending)',
  machine_offline: 'Machine Offline',
  machine_idle: 'Machine Idle',
  efficiency_low: 'Efficiency Low',
  headcount_low: 'Headcount Low',
  target_at_risk: 'Target At Risk',
};

const severityBadgeClass: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  info: 'bg-blue-100 text-blue-700',
};

const severityIcon = (severity: Severity) => {
  if (severity === 'critical') return <AlertCircle className="h-4 w-4 text-red-500" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <Bell className="h-4 w-4 text-blue-500" />;
};

const formatAlertMessage = (alert: AlertRow): string => {
  const machineLabel = alert.machine_id
    ? `${alert.machine_id}${alert.machine_name ? ` - ${alert.machine_name}` : ''}`
    : '-';
  if (alert.alert_type === 'no_scan_heartbeat') {
    const minutesFromValue = Number(alert.actual_value);
    const minutesFromTextMatch = String(alert.message || '').match(/for\s+(\d+(?:\.\d+)?)\s+minutes/i);
    const minutesFromText = minutesFromTextMatch ? Number(minutesFromTextMatch[1]) : NaN;
    const mins = Number.isFinite(minutesFromValue)
      ? Math.round(minutesFromValue)
      : (Number.isFinite(minutesFromText) ? Math.round(minutesFromText) : null);
    if (mins !== null) {
      return `Machine ${machineLabel} has no cycle update for ${mins} minutes (Finish/next action may be pending)`;
    }
    return `Machine ${machineLabel} has no cycle update (Finish/next action may be pending)`;
  }
  return alert.message;
};

const getAlertAgeMinutes = (createdAt?: string) => {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
};

const getSlaBadge = (alert: AlertRow) => {
  if (Number(alert.is_acknowledged || 0) === 1) return null;
  const age = getAlertAgeMinutes(alert.created_at);
  if (age === null) return null;
  if (alert.alert_type === 'no_scan_heartbeat') {
    const delayFromActual = Number(alert.actual_value);
    const delayMins = Number.isFinite(delayFromActual) ? Math.max(0, Math.round(delayFromActual)) : null;
    if (delayMins !== null) {
      return {
        text: `Open ${age}m • Delay ${delayMins}m`,
        cls: delayMins >= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
      };
    }
  }
  if (age >= 30) return { text: `SLA Breach (${age}m)`, cls: 'bg-red-100 text-red-700' };
  if (age >= 15) return { text: `SLA Warning (${age}m)`, cls: 'bg-yellow-100 text-yellow-700' };
  return { text: `Open ${age}m`, cls: 'bg-gray-100 text-gray-700' };
};

const getAlertContextHint = (alert: AlertRow): string | null => {
  const actual = Number(alert.actual_value);
  const threshold = Number(alert.threshold_value);
  if (!Number.isFinite(actual) || !Number.isFinite(threshold)) return null;
  if (alert.alert_type === 'over_target') {
    const delta = Math.max(0, actual - threshold).toFixed(1);
    return `Delta: +${delta} min`;
  }
  if (alert.alert_type === 'efficiency_low') {
    const delta = Math.max(0, threshold - actual).toFixed(1);
    return `Gap: ${delta}% below threshold`;
  }
  if (alert.alert_type === 'no_scan_heartbeat') {
    const delta = Math.max(0, actual - threshold).toFixed(0);
    return `Delay: ${delta} min above heartbeat threshold`;
  }
  return null;
};

export const RealtimeAlertCenter: React.FC = () => {
  const [alerts, setAlerts] = React.useState<AlertRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [severity, setSeverity] = React.useState<'all' | Severity>('all');
  const [type, setType] = React.useState('all');
  const [includeAcknowledged, setIncludeAcknowledged] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [enableGrouping, setEnableGrouping] = React.useState(true);
  const [sortMode, setSortMode] = React.useState<'sla' | 'newest'>('sla');
  const [ackNote, setAckNote] = React.useState('');
  const [showAckDialog, setShowAckDialog] = React.useState(false);
  const [pendingAckIds, setPendingAckIds] = React.useState<number[] | 'all'>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [totalAlerts, setTotalAlerts] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [unacknowledgedCount, setUnacknowledgedCount] = React.useState(0);

  const mapLegacyAlertShape = (rows: any[]): AlertRow[] =>
    rows.map((row) => ({
      id: Number(row.id),
      alert_type: String(row.alert_type || 'custom'),
      severity: (row.severity || 'warning') as Severity,
      work_centre_name: row.work_centre_name || undefined,
      machine_id: row.machine_id || undefined,
      machine_name: row.machine_name || undefined,
      message: String(row.message || ''),
      threshold_value: row.threshold_value ?? undefined,
      actual_value: row.actual_value ?? undefined,
      created_at: row.created_at,
      // legacy endpoint returns is_read; center expects is_acknowledged
      is_acknowledged: Number(row.is_acknowledged ?? row.is_read ?? 0),
    }));

  const normalizeAndGroupAlerts = (rows: AlertRow[]): AlertRow[] => {
    const grouped = new Map<string, AlertRow>();
    rows.forEach((row) => {
      const key = [
        row.alert_type || '',
        row.severity || '',
        row.work_centre_name || '',
        row.machine_id || '',
      ].join('|');
      const createdAtMs = new Date(row.created_at).getTime() || 0;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          ...row,
          alert_ids: [row.id],
          occurrence_count: 1,
          first_seen_at: row.created_at,
          last_seen_at: row.created_at,
        });
        return;
      }
      const existingMs = new Date(existing.created_at).getTime() || 0;
      const latest = createdAtMs >= existingMs ? row : existing;
      const firstSeenMs = Math.min(
        new Date(existing.first_seen_at || existing.created_at).getTime() || createdAtMs,
        createdAtMs
      );
      const lastSeenMs = Math.max(
        new Date(existing.last_seen_at || existing.created_at).getTime() || createdAtMs,
        createdAtMs
      );
      const mergedIds = Array.from(new Set([...(existing.alert_ids || [existing.id]), row.id]));
      grouped.set(key, {
        ...latest,
        // Keep created_at anchored to first seen so SLA/Open age does not reset on repeats.
        created_at: new Date(firstSeenMs).toISOString(),
        alert_ids: mergedIds,
        occurrence_count: mergedIds.length,
        first_seen_at: new Date(firstSeenMs).toISOString(),
        last_seen_at: new Date(lastSeenMs).toISOString(),
        is_acknowledged:
          Number(existing.is_acknowledged || 0) === 1 && Number(row.is_acknowledged || 0) === 1 ? 1 : 0,
      });
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const rank = (s: Severity) => (s === 'critical' ? 1 : s === 'warning' ? 2 : 3);
      const ackA = Number(a.is_acknowledged || 0);
      const ackB = Number(b.is_acknowledged || 0);
      if (ackA !== ackB) return ackA - ackB; // unack first
      if (sortMode === 'sla') {
        const ageA = getAlertAgeMinutes(a.created_at) ?? 0;
        const ageB = getAlertAgeMinutes(b.created_at) ?? 0;
        const breachA = ageA >= 30 ? 2 : ageA >= 15 ? 1 : 0;
        const breachB = ageB >= 30 ? 2 : ageB >= 15 ? 1 : 0;
        if (breachA !== breachB) return breachB - breachA;
      }
      if (rank(a.severity) !== rank(b.severity)) return rank(a.severity) - rank(b.severity);
      if (sortMode === 'newest') {
        return (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0);
      }
      return (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0);
    });
  };

  const loadAlerts = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      const params = new URLSearchParams();
      if (severity !== 'all') params.set('severity', severity);
      if (type !== 'all') params.set('alert_type', type);
      params.set('include_acknowledged', includeAcknowledged ? 'true' : 'false');
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      const centerUrl = `${API_BASE_URL}/api/alerts/center?${params.toString()}`;
      const res = await apiFetch(centerUrl);
      if (res.status === 404) {
        // Backward compatibility: older backend without /alerts/center route.
        const legacy = await apiFetch(`${API_BASE_URL}/api/alerts?unread_only=false&limit=500`);
        const legacyType = legacy.headers.get('content-type') || '';
        if (!legacyType.includes('application/json')) {
          throw new Error('Alert API returned non-JSON response. Please restart backend and try again.');
        }
        const legacyJson = await legacy.json();
        if (!legacy.ok || !legacyJson.success) {
          throw new Error(legacyJson.message || legacyJson.error || 'Failed to load realtime alerts');
        }
        const rows = mapLegacyAlertShape(Array.isArray(legacyJson.data) ? legacyJson.data : []);
        const filtered = rows.filter((row) => {
          const severityOk = severity === 'all' ? true : row.severity === severity;
          const typeOk = type === 'all' ? true : row.alert_type === type;
          const ackOk = includeAcknowledged ? true : Number(row.is_acknowledged || 0) === 0;
          return severityOk && typeOk && ackOk;
        });
        const normalized = normalizeAndGroupAlerts(filtered);
        const start = (page - 1) * pageSize;
        const sliced = normalized.slice(start, start + pageSize);
        setAlerts(sliced);
        setTotalAlerts(normalized.length);
        setTotalPages(Math.max(1, Math.ceil(normalized.length / pageSize)));
        setUnacknowledgedCount(normalized.filter((r) => Number(r.is_acknowledged || 0) === 0).length);
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Alert API returned non-JSON response. Please restart backend and try again.');
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || 'Failed to load realtime alerts');
      }
      const baseRows = Array.isArray(json.data) ? json.data : [];
      setAlerts(enableGrouping ? normalizeAndGroupAlerts(baseRows) : baseRows);
      const pagination = json.pagination || {};
      const safeTotal = Number(pagination.total || baseRows.length || 0);
      const safeTotalPages = Number(pagination.totalPages || Math.max(1, Math.ceil(safeTotal / pageSize)));
      setTotalAlerts(safeTotal);
      setTotalPages(safeTotalPages);
      setUnacknowledgedCount(Number(json.unacknowledged_count || 0));
      if (page > safeTotalPages && safeTotalPages > 0) {
        setPage(1);
      }
    } catch (error: any) {
      if (!silent) toast.error(error?.message || 'Failed to load alert center');
    } finally {
      setLoading(false);
    }
  }, [enableGrouping, includeAcknowledged, page, pageSize, severity, sortMode, type]);

  React.useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  React.useEffect(() => {
    setPage(1);
  }, [severity, type, includeAcknowledged, enableGrouping, sortMode, pageSize]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => loadAlerts({ silent: true }), 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, loadAlerts]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    let closed = false;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`${API_BASE_URL}/api/alerts/stream`);
      source.onmessage = () => {
        if (!closed) loadAlerts({ silent: true });
      };
      source.onerror = () => {
        // Silent fallback: polling effect already active.
      };
    } catch {
      // Silent fallback: polling effect already active.
    }
    return () => {
      closed = true;
      if (source) source.close();
    };
  }, [autoRefresh, loadAlerts]);

  const submitAcknowledge = async (ids: number[] | 'all') => {
    try {
      const userInfo = (() => {
        try {
          const raw = localStorage.getItem('user_info');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();
      const owner = userInfo?.name || userInfo?.code || userInfo?.emp_code || undefined;
      let res = await apiFetch(`${API_BASE_URL}/api/alerts/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ ids, note: ackNote || undefined, owner }),
      });
      if (res.status === 404) {
        // Backward compatibility with legacy endpoint.
        res = await apiFetch(`${API_BASE_URL}/api/alerts/mark-read`, {
          method: 'POST',
          body: JSON.stringify({ ids, note: ackNote || undefined, owner }),
        });
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Acknowledge API returned non-JSON response. Please restart backend and try again.');
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Failed to acknowledge alerts');
      }
      toast.success(ids === 'all' ? 'All alerts acknowledged' : 'Alert acknowledged');
      setAckNote('');
      setShowAckDialog(false);
      setPendingAckIds([]);
      loadAlerts({ silent: true });
    } catch (error: any) {
      toast.error(error?.message || 'Acknowledge failed');
    }
  };

  const openAcknowledgeDialog = (ids: number[] | 'all') => {
    setPendingAckIds(ids);
    setShowAckDialog(true);
  };

  const visibleAlertIds = Array.from(
    new Set(alerts.flatMap((a) => (a.alert_ids && a.alert_ids.length ? a.alert_ids : [a.id])))
  );
  const unacknowledgedVisibleCount = alerts.filter((a) => Number(a.is_acknowledged || 0) === 0).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Realtime Alert Center</h2>
          <p className="text-sm text-gray-500">Critical production alerts with acknowledge flow.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAlerts}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {unacknowledgedVisibleCount > 0 && (
            <button
              type="button"
              onClick={() => openAcknowledgeDialog(visibleAlertIds)}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Acknowledge Visible ({unacknowledgedVisibleCount})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as 'all' | Severity)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All alert types</option>
          <option value="over_target">Over Target</option>
          <option value="idle_too_long">Idle Too Long</option>
          <option value="no_scan_heartbeat">No Cycle Update (Finish Pending)</option>
          <option value="machine_offline">Machine Offline</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeAcknowledged}
            onChange={(e) => setIncludeAcknowledged(e.target.checked)}
          />
          Show acknowledged
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh (30s)
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={enableGrouping} onChange={(e) => setEnableGrouping(e.target.checked)} />
          Group duplicates
        </label>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as 'sla' | 'newest')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="sla">Sort by SLA severity</option>
          <option value="newest">Sort by newest</option>
        </select>
        <select
          value={String(pageSize)}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="10">10 per page</option>
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span>
          Showing page {page} of {totalPages} ({alerts.length} on this page, {totalAlerts} total)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {showAckDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
            <h3 className="text-base font-bold text-gray-900">Acknowledge Alerts</h3>
            <p className="text-sm text-gray-600">
              Add an optional note (action taken / root cause) for audit trail.
            </p>
            <textarea
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
              placeholder="Optional note..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[90px]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAckDialog(false);
                  setAckNote('');
                  setPendingAckIds([]);
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitAcknowledge(pendingAckIds)}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Confirm Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading realtime alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-500">No alerts for selected filters.</div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-white rounded-xl border p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${severityBadgeClass[alert.severity]}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        {alertTypeLabel[alert.alert_type] || alert.alert_type}
                      </span>
                      {Number(alert.occurrence_count || 0) > 1 && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {alert.occurrence_count} occurrences
                        </span>
                      )}
                      {Number(alert.is_acknowledged || 0) === 1 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Acknowledged
                        </span>
                      )}
                      {getSlaBadge(alert) && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getSlaBadge(alert)?.cls}`}>
                          {getSlaBadge(alert)?.text}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mt-2">{formatAlertMessage(alert)}</p>
                    <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-3">
                      <span>Line: {alert.work_centre_name || '-'}</span>
                      <span>
                        Machine: {alert.machine_id || '-'}
                        {alert.machine_name ? ` - ${alert.machine_name}` : ''}
                      </span>
                      <span>First seen: {new Date(alert.first_seen_at || alert.created_at).toLocaleString()}</span>
                      <span>Last seen: {new Date(alert.last_seen_at || alert.created_at).toLocaleString()}</span>
                      {getAlertContextHint(alert) && <span>{getAlertContextHint(alert)}</span>}
                      {Number(alert.is_acknowledged || 0) === 1 && alert.acknowledged_at && (
                        <span>
                          Ack: {new Date(alert.acknowledged_at).toLocaleString()}
                          {alert.acknowledged_by ? ` by ${alert.acknowledged_by}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <a
                        href="/production_tracker"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        title="Open production tracker context"
                      >
                        Open in Production Tracker
                      </a>
                    </div>
                  </div>
                </div>
                {Number(alert.is_acknowledged || 0) === 0 && (
                  <button
                    type="button"
                    onClick={() => openAcknowledgeDialog(alert.alert_ids && alert.alert_ids.length ? alert.alert_ids : [alert.id])}
                    className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm hover:bg-blue-50"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

