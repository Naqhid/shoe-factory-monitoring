import React from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, API_BASE_URL } from '../services/api';

const POLL_INTERVAL = 30_000; // keep badge reasonably fresh

export const AlertBell: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = React.useState(0);

  const fetchAlerts = React.useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/alerts?unread_only=false&limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setUnreadCount(Number(data.unread_count || 0));
      }
    } catch { /* silent */ }
  }, []);

  // Keep unread badge up to date.
  React.useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAlerts]);

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
