import { API_BASE_URL, apiFetch } from '../services/api';

export const ALERT_POLL_INTERVAL = 30_000;
export const ALERT_POLL_LEADER_KEY = 'alert_bell_poll_leader';
export const ALERT_UNREAD_CACHE_KEY = 'alert_bell_unread_count';
export const ALERT_COUNT_UPDATED_EVENT = 'prodpulse:alert-count-updated';
const LEADER_LEASE_MS = ALERT_POLL_INTERVAL + 5_000;

const toGroupedVisibleCount = (rows: unknown[]): number => {
  const grouped = new Set<string>();
  rows.forEach((row) => {
    const r = row as Record<string, unknown>;
    const key = [
      String(r?.alert_type || ''),
      String(r?.severity || ''),
      String(r?.work_centre_name || ''),
      String(r?.machine_id || ''),
    ].join('|');
    grouped.add(key);
  });
  return grouped.size;
};

export const readCachedAlertCount = (): number => {
  const cached = Number(localStorage.getItem(ALERT_UNREAD_CACHE_KEY) || 0);
  return Number.isFinite(cached) ? cached : 0;
};

export const writeCachedAlertCount = (count: number): void => {
  const next = Math.max(0, Math.round(Number(count) || 0));
  localStorage.setItem(ALERT_UNREAD_CACHE_KEY, String(next));
  window.dispatchEvent(new CustomEvent(ALERT_COUNT_UPDATED_EVENT, { detail: next }));
};

/** Single API fetch — shared by header bell (leader poll) and Production Tracker (cache read). */
export const fetchAndCacheAlertCount = async (): Promise<number | null> => {
  try {
    let res = await apiFetch(
      `${API_BASE_URL}/api/alerts/center?include_acknowledged=false&limit=10&page=1`
    );
    if (!res.ok) {
      res = await apiFetch(`${API_BASE_URL}/api/alerts?unread_only=false&limit=30`);
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;

    const centerRows = Array.isArray(data.data) ? data.data : [];
    const nextCount =
      centerRows.length > 0
        ? toGroupedVisibleCount(centerRows)
        : Number(data.unacknowledged_count ?? data.unread_count ?? 0);
    if (!Number.isFinite(nextCount)) return null;

    writeCachedAlertCount(nextCount);
    return nextCount;
  } catch {
    return null;
  }
};

export const getAlertPollLeader = (): { tabId: string; expiresAt: number } | null => {
  try {
    const raw = localStorage.getItem(ALERT_POLL_LEADER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tabId?: unknown; expiresAt?: unknown };
    if (typeof parsed?.tabId !== 'string' || typeof parsed?.expiresAt !== 'number') return null;
    return { tabId: parsed.tabId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
};

export const tryAcquireAlertPollLeadership = (tabId: string): boolean => {
  const now = Date.now();
  const current = getAlertPollLeader();
  if (!current || current.expiresAt <= now || current.tabId === tabId) {
    localStorage.setItem(
      ALERT_POLL_LEADER_KEY,
      JSON.stringify({ tabId, expiresAt: now + LEADER_LEASE_MS })
    );
    return true;
  }
  return false;
};

export const releaseAlertPollLeadership = (tabId: string): void => {
  const current = getAlertPollLeader();
  if (current?.tabId === tabId) {
    localStorage.removeItem(ALERT_POLL_LEADER_KEY);
  }
};

/** Subscribe to alert count updates (cache + cross-tab storage + same-tab custom event). */
export const subscribeAlertCount = (onCount: (count: number) => void): (() => void) => {
  onCount(readCachedAlertCount());

  const onStorage = (event: StorageEvent) => {
    if (event.key === ALERT_UNREAD_CACHE_KEY && event.newValue !== null) {
      const next = Number(event.newValue);
      if (Number.isFinite(next)) onCount(next);
    }
  };

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail;
    if (Number.isFinite(detail)) onCount(detail);
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(ALERT_COUNT_UPDATED_EVENT, onCustom);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(ALERT_COUNT_UPDATED_EVENT, onCustom);
  };
};
