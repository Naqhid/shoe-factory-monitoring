import React from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, API_BASE_URL } from '../services/api';

const POLL_INTERVAL = 30_000; // keep badge reasonably fresh
const LEADER_LEASE_MS = POLL_INTERVAL + 5_000;
const ALERT_POLL_LEADER_KEY = 'alert_bell_poll_leader';
const ALERT_UNREAD_CACHE_KEY = 'alert_bell_unread_count';

export const AlertBell: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const tabIdRef = React.useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const fetchAlerts = React.useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/alerts?unread_only=false&limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const nextCount = Number(data.unread_count || 0);
        setUnreadCount(nextCount);
        localStorage.setItem(ALERT_UNREAD_CACHE_KEY, String(nextCount));
      }
    } catch { /* silent */ }
  }, []);

  const getCurrentLeader = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(ALERT_POLL_LEADER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { tabId?: string; expiresAt?: number };
      if (!parsed?.tabId || !parsed?.expiresAt) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const tryAcquireOrRefreshLeadership = React.useCallback(() => {
    const now = Date.now();
    const mine = tabIdRef.current;
    const current = getCurrentLeader();
    if (!current || current.expiresAt <= now || current.tabId === mine) {
      localStorage.setItem(
        ALERT_POLL_LEADER_KEY,
        JSON.stringify({ tabId: mine, expiresAt: now + LEADER_LEASE_MS })
      );
      return true;
    }
    return false;
  }, [getCurrentLeader]);

  // Multi-tab safe polling: only leader tab polls backend; others mirror cached count.
  React.useEffect(() => {
    const cached = Number(localStorage.getItem(ALERT_UNREAD_CACHE_KEY) || 0);
    if (Number.isFinite(cached)) setUnreadCount(cached);

    const tick = () => {
      const iAmLeader = tryAcquireOrRefreshLeadership();
      if (iAmLeader) fetchAlerts();
    };

    // Run once on mount for fast badge paint / leader claim.
    tick();
    const id = window.setInterval(tick, POLL_INTERVAL);

    const onStorage = (event: StorageEvent) => {
      if (event.key === ALERT_UNREAD_CACHE_KEY && event.newValue !== null) {
        const next = Number(event.newValue);
        if (Number.isFinite(next)) setUnreadCount(next);
      }
      if (event.key === ALERT_POLL_LEADER_KEY && document.visibilityState === 'visible') {
        // If leader disappeared while we are visible, opportunistically take over.
        const current = getCurrentLeader();
        if (!current || current.expiresAt <= Date.now()) {
          tick();
        }
      }
    };
    window.addEventListener('storage', onStorage);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      // Release leadership early when this tab is closing.
      const current = getCurrentLeader();
      if (current?.tabId === tabIdRef.current) {
        localStorage.removeItem(ALERT_POLL_LEADER_KEY);
      }
    };
  }, [fetchAlerts, getCurrentLeader, tryAcquireOrRefreshLeadership]);

  return (
    <div className="relative">
      <button
        onClick={() => navigate('/alert_center')}
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
        title="Open Alert Center"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
