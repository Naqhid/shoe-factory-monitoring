import React from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ALERT_POLL_INTERVAL,
  ALERT_POLL_LEADER_KEY,
  fetchAndCacheAlertCount,
  getAlertPollLeader,
  readCachedAlertCount,
  releaseAlertPollLeadership,
  subscribeAlertCount,
  tryAcquireAlertPollLeadership,
} from '../utils/alertCountCache';

export const AlertBell: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const tabIdRef = React.useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  React.useEffect(() => {
    setUnreadCount(readCachedAlertCount());
    return subscribeAlertCount(setUnreadCount);
  }, []);

  React.useEffect(() => {
    const tick = () => {
      const iAmLeader = tryAcquireAlertPollLeadership(tabIdRef.current);
      if (iAmLeader) void fetchAndCacheAlertCount();
    };

    tick();
    const id = window.setInterval(tick, ALERT_POLL_INTERVAL);

    const onStorage = (event: StorageEvent) => {
      if (event.key === ALERT_POLL_LEADER_KEY && document.visibilityState === 'visible') {
        const current = getAlertPollLeader();
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
      releaseAlertPollLeadership(tabIdRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => navigate('/alert_center')}
        className="relative flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
        title="Open Alert Center"
        aria-label={unreadCount > 0 ? `Notifications: ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="h-6 w-6 sm:h-5 sm:w-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] sm:min-w-[14px] sm:h-[14px] px-0.5 text-[9px] sm:text-[8px] font-bold text-white bg-red-500 rounded-full leading-none shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
