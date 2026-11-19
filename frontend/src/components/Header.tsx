import React from 'react';
import { Factory, Calendar, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface HeaderProps {
  isConnected: boolean;
  lastRefresh?: Date;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, lastRefresh }) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Shoe Factory Monitoring
            </h1>
            <p className="text-sm text-gray-500 hidden sm:block">
              Real-time Production Dashboard
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-gray-700">
              {format(currentTime, 'MMM dd, yyyy')}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-gray-700 font-mono">
              {format(currentTime, 'HH:mm:ss')}
            </span>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-red-600 font-medium">Disconnected</span>
                </>
              )}
            </div>
            {lastRefresh && isConnected && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <RefreshCw className="h-3 w-3" />
                <span>
                  Last refreshed: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};