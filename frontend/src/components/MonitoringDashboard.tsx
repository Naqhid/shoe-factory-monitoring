import React, { useState, useEffect, useCallback } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, Cpu, Database, HardDrive, RefreshCw, TrendingUp, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; responseTime?: string; error?: string };
    disk: { status: string; usedPercent?: string; freeMB?: string; note?: string };
  };
  process: {
    pid: number;
    nodeVersion: string;
    memoryMB: { rss: string; heapUsed: string; heapTotal: string };
    cpuLoad: number[];
  };
  logging: { uptime: number; errorCount: number; warnCount: number; logLevel: string };
  requests: {
    totalRequests: number;
    totalErrors: number;
    errorRate: string;
    avgResponseTime: string;
    p95ResponseTime: string;
    p99ResponseTime: string;
    recentRequests: Array<{ ts: number; method: string; url: string; status: number; duration: number }>;
  };
}

const formatUptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    ok: 'bg-green-100 text-green-800',
    healthy: 'bg-green-100 text-green-800',
    warn: 'bg-yellow-100 text-yellow-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };
  const Icon = status === 'ok' || status === 'healthy' ? CheckCircle
    : status === 'warn' || status === 'degraded' ? AlertTriangle
    : AlertCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-800'}`}>
      <Icon className="h-3 w-3" />{status}
    </span>
  );
};

const statCardIconColors: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  red: 'bg-red-50 text-red-600',
};

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string }> = ({ label, value, sub, icon, color = 'blue' }) => (
  <div className="bg-white rounded-xl border p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
    <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${statCardIconColors[color] || statCardIconColors.blue}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] sm:text-xs text-gray-500">{label}</p>
      <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-gray-400 truncate">{sub}</p>}
    </div>
  </div>
);

export const MonitoringDashboard: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/health/detailed`);
      if (!res.ok) {
        const message = res.status === 403
          ? 'You do not have permission to view monitoring data'
          : 'Cannot reach backend server';
        throw new Error(message);
      }
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Cannot reach backend server');
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-center">
      <WifiOff className="h-12 w-12 text-red-400 mx-auto mb-3" />
      <p className="text-red-600 font-medium">{error}</p>
      <button onClick={fetchHealth} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button>
    </div>
  );

  if (!health) return null;

  const { checks, process: proc, logging, requests } = health;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900">System Monitoring</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Updated: {lastRefresh.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={health.status} />
            <button onClick={fetchHealth} className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer mt-2">
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Auto-refresh (15s)
        </label>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard label="Uptime" value={formatUptime(health.uptime)} icon={<Clock className="h-5 w-5" />} color="blue" />
        <StatCard label="Total Requests" value={requests.totalRequests.toLocaleString()} sub={`Error rate: ${requests.errorRate}`} icon={<TrendingUp className="h-5 w-5" />} color="green" />
        <StatCard label="Avg Response" value={requests.avgResponseTime} sub={`p95: ${requests.p95ResponseTime}`} icon={<Wifi className="h-5 w-5" />} color="purple" />
        <StatCard label="Errors Logged" value={logging.errorCount} sub={`Warnings: ${logging.warnCount}`} icon={<AlertCircle className="h-5 w-5" />} color="red" />
      </div>

      {/* Health checks + Memory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Database */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <Database className="h-4 w-4" />Database
            </div>
            <StatusBadge status={checks.database.status} />
          </div>
          <p className="text-sm text-gray-500">Response: {checks.database.responseTime || '—'}</p>
          {checks.database.error && <p className="text-xs text-red-500 mt-1">{checks.database.error}</p>}
        </div>

        {/* Disk */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <HardDrive className="h-4 w-4" />Disk
            </div>
            <StatusBadge status={checks.disk.status} />
          </div>
          {checks.disk.usedPercent && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: checks.disk.usedPercent }} />
              </div>
              <p className="text-xs text-gray-500">Used: {checks.disk.usedPercent} — Free: {checks.disk.freeMB}MB</p>
            </>
          )}
          {checks.disk.note && <p className="text-xs text-gray-400">{checks.disk.note}</p>}
        </div>

        {/* Memory */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 font-medium text-gray-700 mb-3">
            <Cpu className="h-4 w-4" />Memory
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex justify-between"><span>Heap Used</span><span className="font-medium">{proc.memoryMB.heapUsed} MB</span></div>
            <div className="flex justify-between"><span>Heap Total</span><span className="font-medium">{proc.memoryMB.heapTotal} MB</span></div>
            <div className="flex justify-between"><span>RSS</span><span className="font-medium">{proc.memoryMB.rss} MB</span></div>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(100, (parseFloat(proc.memoryMB.heapUsed) / parseFloat(proc.memoryMB.heapTotal)) * 100).toFixed(0)}%` }} />
          </div>
        </div>
      </div>

      {/* Recent requests */}
      <div className="bg-white rounded-xl border">
        <div className="px-3 sm:px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium text-gray-700 text-sm sm:text-base">Recent Requests</h2>
          <span className="text-[10px] sm:text-xs text-gray-400">p99: {requests.p99ResponseTime}</span>
        </div>
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['Time', 'Method', 'URL', 'Status', 'Duration'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.recentRequests.map((r, i) => (
                <tr key={i} className={r.status >= 500 ? 'bg-red-50' : r.status >= 400 ? 'bg-yellow-50' : ''}>
                  <td className="px-3 py-1.5 text-gray-500">{new Date(r.ts).toLocaleTimeString()}</td>
                  <td className="px-3 py-1.5">
                    <span className={`font-medium ${r.method === 'GET' ? 'text-blue-600' : r.method === 'POST' ? 'text-green-600' : r.method === 'DELETE' ? 'text-red-600' : 'text-orange-600'}`}>{r.method}</span>
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 max-w-xs truncate">{r.url}</td>
                  <td className="px-3 py-1.5">
                    <span className={`font-medium ${r.status < 300 ? 'text-green-600' : r.status < 400 ? 'text-blue-600' : r.status < 500 ? 'text-yellow-600' : 'text-red-600'}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-1.5 text-gray-500">{r.duration}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-gray-100">
          {requests.recentRequests.map((r, i) => (
            <div key={i} className={`px-3 py-2 ${r.status >= 500 ? 'bg-red-50' : r.status >= 400 ? 'bg-yellow-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.method === 'GET' ? 'bg-blue-100 text-blue-700' : r.method === 'POST' ? 'bg-green-100 text-green-700' : r.method === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{r.method}</span>
                  <span className={`text-xs font-medium ${r.status < 300 ? 'text-green-600' : r.status < 500 ? 'text-yellow-600' : 'text-red-600'}`}>{r.status}</span>
                  <span className="text-[10px] text-gray-400">{r.duration}ms</span>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{new Date(r.ts).toLocaleTimeString()}</span>
              </div>
              <p className="text-[11px] text-gray-600 truncate mt-0.5">{r.url}</p>
            </div>
          ))}
        </div>
        {requests.recentRequests.length === 0 && (
          <p className="text-center text-gray-400 py-6 text-sm">No requests yet</p>
        )}
      </div>

      {/* Process info */}
      <div className="bg-white rounded-xl border p-3 sm:p-4">
        <h2 className="font-medium text-gray-700 mb-3 text-sm sm:text-base">Process Info</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
          <div><span className="text-[10px] sm:text-xs text-gray-500 uppercase">PID</span><p className="font-medium text-gray-900">{proc.pid}</p></div>
          <div><span className="text-[10px] sm:text-xs text-gray-500 uppercase">Node</span><p className="font-medium text-gray-900">{proc.nodeVersion}</p></div>
          <div><span className="text-[10px] sm:text-xs text-gray-500 uppercase">Log Level</span><p className="font-medium text-gray-900 uppercase">{logging.logLevel}</p></div>
          <div><span className="text-[10px] sm:text-xs text-gray-500 uppercase">CPU Load (1m)</span><p className="font-medium text-gray-900">{proc.cpuLoad[0]?.toFixed(2) ?? '—'}</p></div>
        </div>
      </div>
    </div>
  );
};
