import React, { useState, useEffect } from 'react';
import { Smile, Frown, Meh, TrendingUp, Target, Zap, Activity, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';

export const TVDashboard: React.FC = () => {
    const [workCentres, setWorkCentres] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [currentDate, setCurrentDate] = useState('');
    const [reworkSummary, setReworkSummary] = useState<Record<number, { total_rework: number; total_rejection: number }>>({});
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [retryAttempts, setRetryAttempts] = useState(0);
    const [partialWarning, setPartialWarning] = useState<string | null>(null);

    useEffect(() => {
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setCurrentDate(localDate);
    }, []);

    useEffect(() => {
        const fetchWorkCentres = async () => {
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/tv-dashboard/work-centres`);
                const result = await res.json();
                if (result.success && result.data.length > 0) {
                    setWorkCentres(result.data);
                    setErrorMessage(null);
                } else {
                    setErrorMessage('No work centres available for dashboard.');
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error fetching work centres:', error);
                setErrorMessage('Failed to load work centres. Please retry.');
                setLoading(false);
            }
        };
        fetchWorkCentres();
    }, []);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (workCentres.length === 0 || !currentDate) return;

        const fetchDashboard = async () => {
            setIsRefreshing(true);
            try {
                const workCentreId = workCentres[currentIndex].id;
                const [dashRes, reworkRes] = await Promise.allSettled([
                    apiFetch(`${API_BASE_URL}/api/tv-dashboard/dashboard/${workCentreId}?date=${currentDate}`),
                    apiFetch(`${API_BASE_URL}/api/rework-rejection/summary?date=${currentDate}`)
                ]);

                let dashboardUpdated = false;
                const warnings: string[] = [];

                if (dashRes.status === 'fulfilled') {
                    const dashResult = await dashRes.value.json();
                    if (dashResult.success && dashResult.data) {
                        setDashboardData(dashResult.data);
                        setLastUpdatedAt(new Date());
                        setErrorMessage(null);
                        setRetryAttempts(0);
                        setLoading(false);
                        dashboardUpdated = true;
                    } else {
                        warnings.push('Live dashboard feed returned invalid data.');
                    }
                } else {
                    warnings.push('Live dashboard feed is unreachable.');
                }

                if (reworkRes.status === 'fulfilled') {
                    const reworkResult = await reworkRes.value.json();
                    if (reworkResult.success && Array.isArray(reworkResult.data)) {
                        const map: Record<number, { total_rework: number; total_rejection: number }> = {};
                        reworkResult.data.forEach((r: any) => { map[r.work_centre_id] = r; });
                        setReworkSummary(map);
                    } else {
                        warnings.push('Rework/rejection summary is unavailable.');
                    }
                } else {
                    warnings.push('Rework/rejection feed is unreachable.');
                }

                if (!dashboardUpdated) {
                    setRetryAttempts((prev) => prev + 1);
                    setErrorMessage('Live refresh failed. Auto-retrying...');
                    setLoading(false);
                }

                if (warnings.length > 0) {
                    setPartialWarning(warnings.join(' '));
                } else {
                    setPartialWarning(null);
                }
            } catch (error) {
                console.error('Error fetching dashboard:', error);
                setErrorMessage('Failed to refresh dashboard data. Auto-retrying...');
                setRetryAttempts((prev) => prev + 1);
                setLoading(false);
            } finally {
                setIsRefreshing(false);
            }
        };

        fetchDashboard();
        const interval = setInterval(fetchDashboard, 10000);
        return () => clearInterval(interval);
    }, [workCentres, currentIndex, currentDate]);

    useEffect(() => {
        if (workCentres.length <= 1) return;
        setProgress(0);
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % workCentres.length);
            setProgress(0);
        }, 60000);
        return () => clearInterval(interval);
    }, [workCentres]);

    useEffect(() => {
        if (workCentres.length <= 1) return;
        const interval = setInterval(() => setProgress((prev) => Math.min(prev + 0.167, 100)), 100);
        return () => clearInterval(interval);
    }, [currentIndex, workCentres]);

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    if (errorMessage && !dashboardData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-3">Dashboard Unavailable</h2>
                    <p className="text-gray-700 mb-6">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (loading || !dashboardData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
                <div className="text-white text-2xl">Loading Dashboard...</div>
            </div>
        );
    }

    const { topSection, middleSection, lowerSection } = dashboardData;
    const currentWorkCentreId = workCentres[currentIndex]?.id;
    const secondsSinceUpdate = lastUpdatedAt ? Math.floor((currentTime.getTime() - lastUpdatedAt.getTime()) / 1000) : null;
    const isStale = secondsSinceUpdate !== null && secondsSinceUpdate > 30;
    const isCriticalStale = secondsSinceUpdate !== null && secondsSinceUpdate > 120;

    const chartData = lowerSection.hourlyData.map((item: any) => ({
        hour: `${item.hour}:00`,
        output: item.output || 0
    }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-3 sm:p-6">
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 mb-4 sm:mb-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">{topSection.workCentreName}</h1>
                        <div className="text-left sm:text-right bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                            <div className="text-white text-lg sm:text-2xl font-semibold">
                                {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-blue-100 text-base sm:text-xl">
                                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-blue-100 text-xs sm:text-sm mt-1">
                                Last update: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Waiting...'}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${isOffline ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isOffline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                            {isOffline ? 'Offline' : 'Online'}
                        </div>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${isCriticalStale ? 'bg-red-100 text-red-700' : isStale ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {secondsSinceUpdate === null ? 'No live data yet' : isCriticalStale ? `Data stale (${secondsSinceUpdate}s)` : isStale ? `Data aging (${secondsSinceUpdate}s)` : `Live (${secondsSinceUpdate}s ago)`}
                        </div>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${isRefreshing ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing...' : 'Auto-refresh 10s'}
                        </div>
                        {retryAttempts > 0 && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-orange-100 text-orange-700">
                                Retry attempt {retryAttempts}
                            </div>
                        )}
                    </div>
                    {(partialWarning || errorMessage || isOffline || isCriticalStale) && (
                        <div className={`rounded-xl px-4 py-3 text-sm font-semibold mb-4 ${isOffline || isCriticalStale ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                            {isOffline
                                ? 'Connection lost. Showing last available data. Auto-retry is active.'
                                : isCriticalStale
                                    ? 'Data feed appears stale. Showing last available snapshot while auto-retry continues.'
                                    : partialWarning || errorMessage}
                        </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <Target className="h-8 w-8 sm:h-12 sm:w-12 text-white mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Target</div>
                            <div className="text-white text-2xl sm:text-4xl font-bold drop-shadow-md">{topSection.target}</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 text-green-300 mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Output</div>
                            <div className="text-white text-2xl sm:text-4xl font-bold drop-shadow-md">{topSection.output}</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <Activity className="h-8 w-8 sm:h-12 sm:w-12 text-purple-300 mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Output %</div>
                            <div className={`text-2xl sm:text-4xl font-bold drop-shadow-md ${topSection.outputPercent >= 90 ? 'text-green-300' : topSection.outputPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {topSection.outputPercent}%
                            </div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <Zap className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-300 mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Efficiency %</div>
                            <div className={`text-2xl sm:text-4xl font-bold drop-shadow-md ${topSection.efficiencyPercent >= 90 ? 'text-green-300' : topSection.efficiencyPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {topSection.efficiencyPercent}%
                            </div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 flex items-center justify-center col-span-2 sm:col-span-1 hover:bg-white/30 transition-all duration-300 shadow-lg">
                            {topSection.showHappyEmoji ? (
                                <Smile className="h-16 w-16 sm:h-24 sm:w-24 text-green-300 drop-shadow-lg animate-pulse" />
                            ) : topSection.showMediumEmoji ? (
                                <Meh className="h-16 w-16 sm:h-24 sm:w-24 text-yellow-300 drop-shadow-lg" />
                            ) : (
                                <Frown className="h-16 w-16 sm:h-24 sm:w-24 text-red-300 drop-shadow-lg" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* LINE PERFORMANCE Section */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 mb-4 sm:mb-6 border border-gray-100">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 mb-4 sm:mb-6">LINE PERFORMANCE</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">LINE</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">TARGET</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT %</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">EFFICIENCY %</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">WIP</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-yellow-600">REWORK</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-red-600">REJECTION</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lowerSection.linePerformance?.map((line: any, index: number) => {
                                const getStatusColor = (eff: number) => {
                                    if (eff >= 95) return 'bg-green-500';
                                    if (eff >= 85) return 'bg-yellow-500';
                                    return 'bg-red-500';
                                };
                                const rw = reworkSummary[line.work_centre_id] || { total_rework: 0, total_rejection: 0 };
                                return (
                                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-4 py-4 text-sm font-semibold text-gray-800">{line.line_name}</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-blue-600">{line.target}</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-green-600">{line.output}</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-purple-600">{line.output_percentage}%</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-orange-600">{line.efficiency}%</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-red-600">{line.wip || 0}</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-yellow-600">{rw.total_rework}</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-red-600">{rw.total_rejection}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center gap-2">
                                                <div className={`w-4 h-4 rounded-full ${getStatusColor(line.efficiency)}`}></div>
                                                <div className={`w-4 h-4 rounded-full ${getStatusColor(line.efficiency)}`}></div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
                <HourlyOutputChart 
                    workCentreId={currentWorkCentreId} 
                    workCentreName={lowerSection.workCentreName}
                    showProgress={workCentres.length > 1}
                    progress={progress}
                    date={currentDate}
                />

                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 border border-gray-100 hover:shadow-3xl transition-shadow duration-300">
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 mb-4 sm:mb-6 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-red-600" />
                        Top 3 Bottleneck Machines
                    </h3>
                    {lowerSection.bottlenecks.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4">
                            {lowerSection.bottlenecks.map((item: any, index: number) => (
                                <div key={index} className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all duration-300 hover:scale-105">
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <span className="text-red-600 font-bold text-lg bg-white px-2 py-1 rounded">#{index + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-gray-800 font-bold text-sm sm:text-lg truncate">{item.machine_centre_name}</div>
                                                <div className="text-gray-600 text-xs sm:text-sm truncate">{item.work_centre_name}</div>
                                            </div>
                                        </div>
                                        <div className="text-red-600 text-2xl sm:text-3xl font-bold flex-shrink-0 bg-white px-3 py-1 rounded-lg shadow-sm">{item.efficiency}%</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 sm:h-64 text-gray-400">
                            <div className="text-center px-4">
                                <Smile className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-green-400" />
                                <div className="text-sm sm:text-xl">No Bottlenecks - All machines performing well!</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
