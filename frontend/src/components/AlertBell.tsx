import React from 'react';
import { Bell, X, CheckCheck, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { apiFetch, API_BASE_URL } from '../services/api';

interface Alert {
  id: number;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  work_centre_name?: string;
  machine_id?: string;
  alert_date: string;
  message: string;
  actual_value?: number;
  threshold_value?: number;
  created_at: string;
  is_read: number;
}

const POLL_INTERVAL = 300_000; // 5 minutes (only when bell open)

const severityIcon = (s: Alert['severity']) => {
  if (s === 'critical') return <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  if (s === 'warning')  return <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
};

const severityBg = (s: Alert['severity']) => {
  if (s === 'critical') return 'bg-red-50 border-red-100';
  if (s === 'warning')  return 'bg-yellow-50 border-yellow-100';
  return 'bg-blue-50 border-blue-100';
};

export const AlertBell: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const bellRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = React.useState({ top: 0, left: 0 });

  const fetchAlerts = React.useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/alerts?unread_only=false&limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setAlerts(data.data);
        setUnreadCount(data.unread_count);
      }
    } catch { /* silent */ }
  }, []);

  // Initial fetch on mount for badge count, then only poll when dropdown is open
  React.useEffect(() => {
    fetchAlerts(); // One-time fetch for initial badge count
  }, [fetchAlerts]);

  // Poll every 5 minutes ONLY when dropdown is open
  React.useEffect(() => {
    if (!open) return;
    fetchAlerts(); // Fetch immediately when opened
    const id = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [open, fetchAlerts]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleBellClick = () => {
    if (!open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const panelWidth = 384; // w-96
      let left = rect.left;
      // Keep panel within viewport
      if (left + panelWidth > window.innerWidth - 8) {
        left = window.innerWidth - panelWidth - 8;
      }
      if (left < 8) left = 8;
      setPanelPos({ top: rect.bottom + 8, left });
    }
    setOpen(o => !o);
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/alerts/mark-read`, {
        method: 'POST',
        body: JSON.stringify({ ids: 'all' }),
      });
      setAlerts(prev => prev.map(a => ({ ...a, is_read: 1 })));
      setUnreadCount(0);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const markOneRead = async (id: number) => {
    try {
      await apiFetch(`${API_BASE_URL}/api/alerts/mark-read`, {
        method: 'POST',
        body: JSON.stringify({ ids: [id] }),
      });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: 1 } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  return (
    <div className="relative" ref={bellRef}>
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
        title="Alerts"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed so it escapes sidebar/overflow clipping */}
      {open && (
        <div
          ref={panelRef}
          className="fixed w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] flex flex-col max-h-[480px]"
          style={{ top: panelPos.top, left: panelPos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-gray-800 text-sm">Alerts</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div className="overflow-y-auto flex-1">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No alerts</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                    alert.is_read ? 'opacity-60' : ''
                  } ${severityBg(alert.severity)}`}
                >
                  <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {alert.work_centre_name && (
                        <span className="text-[10px] text-gray-500">{alert.work_centre_name}</span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {!alert.is_read && (
                    <button
                      onClick={() => markOneRead(alert.id)}
                      className="flex-shrink-0 text-gray-300 hover:text-gray-500 mt-0.5"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
