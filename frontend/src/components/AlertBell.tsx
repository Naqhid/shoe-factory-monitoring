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
