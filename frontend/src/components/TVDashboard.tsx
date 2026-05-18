import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smile, Frown, Meh, TrendingUp, Target, Zap, Activity, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';

export const TVDashboard: React.FC = () => {
    const navigate = useNavigate();
    const PINNED_LINE_STORAGE_KEY = 'tv_dashboard_pinned_line_id';
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
    const [pinnedWorkCentreId, setPinnedWorkCentreId] = useState<number | null>(null);
    const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<Date | null>(null);
    const [reworkUpdatedAt, setReworkUpdatedAt] = useState<Date | null>(null);
    const staleReloadTimerRef = React.useRef<number | null>(null);
    const [showStatusBar, setShowStatusBar] = useState(false);
    const [detailCarouselIndex, setDetailCarouselIndex] = useState(0);
    const [detailCarouselProgress, setDetailCarouselProgress] = useState(0);

    const DETAIL_CAROUSEL_SLIDES = 2;
    const DETAIL_CAROUSEL_MS = 30000;

    useEffect(() => {
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setCurrentDate(localDate);
        try {
            const raw = localStorage.getItem(PINNED_LINE_STORAGE_KEY);
            if (raw) {
                const parsed = Number(raw);
                if (!Number.isNaN(parsed) && parsed > 0) setPinnedWorkCentreId(parsed);
            }
        } catch (error) {
            console.warn('Failed to restore pinned work centre preference:', error);
        }
    }, []);

    useEffect(() => {
        const fetchWorkCentres = async () => {
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/tv-dashboard/work-centres`);
                const result = await res.json();
                if (result.success && result.data.length > 0) {
                    setWorkCentres(result.data);
                    if (pinnedWorkCentreId) {
                        const idx = result.data.findIndex((wc: any) => Number(wc.id) === Number(pinnedWorkCentreId));
                        if (idx >= 0) setCurrentIndex(idx);
                    }
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
    }, [pinnedWorkCentreId]);

    useEffect(() => {
        if (!workCentres.length || !pinnedWorkCentreId) return;
        const idx = workCentres.findIndex((wc: any) => Number(wc.id) === Number(pinnedWorkCentreId));
        if (idx >= 0) setCurrentIndex(idx);
    }, [pinnedWorkCentreId, workCentres]);

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
                const [dashRes] = await Promise.allSettled([
                    apiFetch(`${API_BASE_URL}/api/tv-dashboard/dashboard/${workCentreId}?date=${currentDate}`),
                    // apiFetch(`${API_BASE_URL}/api/rework-rejection/summary?date=${currentDate}`),
                ]);

                let dashboardUpdated = false;
                const warnings: string[] = [];

                if (dashRes.status === 'fulfilled') {
                    const dashResult = await dashRes.value.json();
                    if (dashResult.success && dashResult.data) {
                        const nowTs = new Date();
                        setDashboardData(dashResult.data);
                        setDashboardUpdatedAt(nowTs);
                        setLastUpdatedAt(nowTs);
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

                // if (reworkRes.status === 'fulfilled') {
                //     const reworkResult = await reworkRes.value.json();
                //     if (reworkResult.success && Array.isArray(reworkResult.data)) {
                //         setReworkUpdatedAt(new Date());
                //         const map: Record<number, { total_rework: number; total_rejection: number }> = {};
                //         reworkResult.data.forEach((r: any) => { map[r.work_centre_id] = r; });
                //         setReworkSummary(map);
                //     } else {
                //         warnings.push('Rework/rejection summary is unavailable.');
                //     }
                // } else {
                //     warnings.push('Rework/rejection feed is unreachable.');
                // }

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
        if (workCentres.length <= 1 || pinnedWorkCentreId !== null) return;
        setProgress(0);
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % workCentres.length);
            setProgress(0);
        }, 60000);
        return () => clearInterval(interval);
    }, [workCentres, pinnedWorkCentreId]);

    useEffect(() => {
        if (workCentres.length <= 1 || pinnedWorkCentreId !== null) return;
        const interval = setInterval(() => setProgress((prev) => Math.min(prev + 0.167, 100)), 100);
        return () => clearInterval(interval);
    }, [currentIndex, workCentres, pinnedWorkCentreId]);

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setDetailCarouselIndex(0);
        setDetailCarouselProgress(0);
    }, [currentIndex]);

    useEffect(() => {
        setDetailCarouselProgress(0);
        const rotateInterval = setInterval(() => {
            setDetailCarouselIndex((prev) => (prev + 1) % DETAIL_CAROUSEL_SLIDES);
            setDetailCarouselProgress(0);
        }, DETAIL_CAROUSEL_MS);
        return () => clearInterval(rotateInterval);
    }, [currentIndex]);

    useEffect(() => {
        const tickMs = 100;
        const increment = (tickMs / DETAIL_CAROUSEL_MS) * 100;
        const interval = setInterval(() => {
            setDetailCarouselProgress((prev) => Math.min(prev + increment, 100));
        }, tickMs);
        return () => clearInterval(interval);
    }, [detailCarouselIndex, currentIndex]);

    const secondsSinceLastSuccess = lastUpdatedAt ? Math.floor((currentTime.getTime() - lastUpdatedAt.getTime()) / 1000) : null;
    const isCriticalStaleNow = secondsSinceLastSuccess !== null && secondsSinceLastSuccess > 120;
    const sectionAge = (ts: Date | null) => ts ? Math.floor((currentTime.getTime() - ts.getTime()) / 1000) : null;
    const dashboardAgeSec = sectionAge(dashboardUpdatedAt);
    const reworkAgeSec = sectionAge(reworkUpdatedAt);

    // Escalation: if stale remains critical for 5+ minutes, trigger hard reload.
    useEffect(() => {
        if (!isCriticalStaleNow || isOffline) {
            if (staleReloadTimerRef.current) {
                window.clearTimeout(staleReloadTimerRef.current);
                staleReloadTimerRef.current = null;
            }
            return;
        }
        if (staleReloadTimerRef.current) return;
        staleReloadTimerRef.current = window.setTimeout(() => {
            window.location.reload();
        }, 5 * 60 * 1000);
        return () => {
            if (staleReloadTimerRef.current) {
                window.clearTimeout(staleReloadTimerRef.current);
                staleReloadTimerRef.current = null;
            }
        };
    }, [isCriticalStaleNow, isOffline]);

    if (errorMessage && !dashboardData) {
        return (
            <div className="h-full min-h-0 bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-6">
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
            <div className="h-full min-h-0 bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
                <div className="text-white text-2xl motion-safe:animate-pulse">Loading Dashboard...</div>
            </div>
        );
    }

    const { topSection, middleSection, lowerSection } = dashboardData;
    const currentWorkCentreId = workCentres[currentIndex]?.id;
    const secondsSinceUpdate = lastUpdatedAt ? Math.floor((currentTime.getTime() - lastUpdatedAt.getTime()) / 1000) : null;
    const isStale = secondsSinceUpdate !== null && secondsSinceUpdate > 30;
    const isCriticalStale = secondsSinceUpdate !== null && secondsSinceUpdate > 120;
    const linePerformanceRows = Array.isArray(lowerSection?.linePerformance) ? lowerSection.linePerformance : [];
    const topPerformer = linePerformanceRows.reduce((best: any, line: any) => {
        if (!best) return line;
        return Number(line.efficiency || 0) > Number(best.efficiency || 0) ? line : best;
    }, null as any);
    const needActionCount = linePerformanceRows.filter((line:any) => {
        const efficiency = Number(line.efficiency || 0);
        const outputPct = Number(line.output_percentage || 0);
        return efficiency < 90 || outputPct < 90;
    }).length;
    const shiftWindow = (() => {
        const now = currentTime;
        const start = new Date(now);
        start.setHours(9, 0, 0, 0);
        const end = new Date(now);
        end.setHours(17, 30, 0, 0);
        const totalMin = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 60000));
        const elapsedMin = Math.min(totalMin, Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000)));
        const remainingMin = Math.max(0, totalMin - elapsedMin);
        const elapsedPct = Math.round((elapsedMin / totalMin) * 100);
        return { elapsedPct, remainingMin };
    })();
    const targetGap = Math.max(0, Number(topSection.target || 0) - Number(topSection.output || 0));
    const recoveryLabel =
        targetGap > 0
            ? `Gap: ${targetGap}`
            : `Ahead: ${Math.max(0, Number(topSection.output || 0) - Number(topSection.target || 0))}`;

    const chartData = lowerSection.hourlyData.map((item: any) => ({
        hour: `${item.hour}:00`,
        output: item.output || 0
    }));

    return (
        <div className="h-full min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-2 sm:p-3 max-w-[min(122rem,96vw)] mx-auto">
            <div key={String(currentWorkCentreId ?? currentIndex)} className="flex-shrink-0 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-xl sm:rounded-2xl shadow-xl p-2 sm:p-3 mb-2 relative overflow-hidden ring-1 ring-white/10 motion-safe:animate-tv-section-in max-sm:motion-safe:animate-none motion-reduce:animate-none">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-72 h-72 sm:w-96 sm:h-96 max-sm:w-44 max-sm:h-44 bg-white rounded-full blur-3xl opacity-[0.12] max-sm:opacity-[0.05] max-sm:blur-2xl motion-safe:animate-tv-shimmer max-sm:motion-safe:animate-none motion-reduce:opacity-10" />
                    <div className="absolute bottom-0 right-0 w-80 h-80 sm:w-[28rem] sm:h-[28rem] max-sm:w-48 max-sm:h-48 bg-indigo-300/40 rounded-full blur-3xl opacity-[0.15] max-sm:opacity-[0.06] max-sm:blur-2xl motion-safe:animate-tv-shimmer max-sm:motion-safe:animate-none motion-reduce:opacity-10" style={{ animationDelay: '2.5s' }} />
                </div>
                <div className="relative z-10 isolate">
                    <div className="flex flex-row justify-between items-center mb-1.5 sm:mb-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <h1 className="text-sm sm:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg tracking-tight truncate">{topSection.workCentreName}</h1>
                            <button
                                type="button"
                                onClick={() => setShowStatusBar(v => !v)}
                                className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors shrink-0"
                                title={showStatusBar ? 'Hide status' : 'Show status'}
                            >
                                <span className="text-sm">{showStatusBar ? '▲' : '▼'}</span>
                                {(isCriticalStale || isOffline || needActionCount > 0) && (
                                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                )}
                            </button>
                        </div>
                        <div className="text-right rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 ring-1 bg-slate-950/50 backdrop-blur-md ring-white/30 sm:bg-white/10 flex-shrink-0 leading-tight">
                            <div className="text-white text-[10px] sm:text-lg font-semibold tabular-nums whitespace-nowrap">
                                {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-blue-100 text-[10px] sm:text-base font-medium tabular-nums whitespace-nowrap">
                                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="hidden sm:block text-blue-100 text-[10px] sm:text-xs mt-0.5 font-medium whitespace-nowrap">
                                Last update: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Waiting...'}
                            </div>
                        </div>
                    </div>
                    {showStatusBar && (
                        <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                            <button
                                type="button"
                                onClick={() => {
                                    const currentId = workCentres[currentIndex]?.id;
                                    const next = pinnedWorkCentreId ? null : Number(currentId || 0);
                                    setPinnedWorkCentreId(next && next > 0 ? next : null);
                                    try {
                                        if (next && next > 0) localStorage.setItem(PINNED_LINE_STORAGE_KEY, String(next));
                                        else localStorage.removeItem(PINNED_LINE_STORAGE_KEY);
                                    } catch (error) {
                                        console.warn('Failed to persist pinned work centre preference:', error);
                                    }
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${pinnedWorkCentreId ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-slate-100 text-slate-700'}`}
                            >
                                {pinnedWorkCentreId ? 'Pinned Line' : 'Auto Rotate'}
                            </button>
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
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${needActionCount > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Lines Below Target: {needActionCount}
                            </div>
                            {topPerformer && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-cyan-100 text-cyan-700">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    Best: {topPerformer.line_name || '-'} ({Number(topPerformer.efficiency || 0)}%)
                                </div>
                            )}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-sky-100 text-sky-700">
                                Shift Used: {shiftWindow.elapsedPct}%
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-violet-100 text-violet-700">
                                Remaining: {shiftWindow.remainingMin}m
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${targetGap > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {recoveryLabel}
                            </div>
                            {retryAttempts > 0 && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-orange-100 text-orange-700">
                                    Retry attempt {retryAttempts}
                                </div>
                            )}
                        </div>
                    )}
                    {(partialWarning || errorMessage || isOffline || isCriticalStale) && (
                        <div className={`rounded-xl px-4 py-3 text-sm font-semibold mb-4 ${isOffline || isCriticalStale ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                            {isOffline
                                ? 'Connection lost. Showing last available data. Auto-retry is active.'
                                : isCriticalStale
                                    ? 'Data feed appears stale. Showing last available snapshot while auto-retry continues.'
                                    : partialWarning || errorMessage}
                        </div>
                    )}
                    <div className="grid grid-cols-5 gap-1 sm:gap-2 min-w-0">
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-0 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <Target className="h-4 w-4 sm:h-7 sm:w-7 text-white mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Target</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">{topSection.target}</div>
                        </div>
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-75 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <TrendingUp className="h-4 w-4 sm:h-7 sm:w-7 text-green-300 mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Output</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">{topSection.output}</div>
                        </div>
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-100 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <Activity className="h-4 w-4 sm:h-7 sm:w-7 text-purple-300 mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Output %</div>
                            <div className={`text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none ${topSection.outputPercent >= 90 ? 'text-green-300' : topSection.outputPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {topSection.outputPercent}%
                            </div>
                        </div>
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-150 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <Zap className="h-4 w-4 sm:h-7 sm:w-7 text-yellow-300 mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Efficiency %</div>
                            <div className={`text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none ${topSection.efficiencyPercent >= 90 ? 'text-green-300' : topSection.efficiencyPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {topSection.efficiencyPercent}%
                            </div>
                        </div>
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1 sm:p-2 flex items-center justify-center min-w-0 shadow-lg motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-200 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            {topSection.showHappyEmoji ? (
                                <Smile className="h-7 w-7 sm:h-14 sm:w-14 text-green-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" />
                            ) : topSection.showMediumEmoji ? (
                                <Meh className="h-7 w-7 sm:h-14 sm:w-14 text-yellow-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" style={{ animationDelay: '0.4s' }} />
                            ) : (
                                <Frown className="h-7 w-7 sm:h-14 sm:w-14 text-red-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" style={{ animationDelay: '0.2s' }} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 sm:gap-3 overflow-hidden min-w-0">
            <div className="min-h-0 h-full flex flex-col motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:80ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
            <div className="h-full min-h-0 flex flex-col bg-white rounded-xl shadow-lg border border-gray-100 ring-1 ring-slate-200/60 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pt-3 pb-2 flex-shrink-0 border-b border-gray-100">
                    <h3 className="text-sm sm:text-base font-bold text-blue-600 truncate">
                        {detailCarouselIndex === 0
                            ? 'LINE PERFORMANCE'
                            : `${lowerSection.workCentreName || 'Line'} - Hourly Output`}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {dashboardAgeSec !== null && dashboardAgeSec > 30 && detailCarouselIndex === 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Stale</span>
                        )}
                        <div className="flex items-center gap-1.5" role="tablist" aria-label="Dashboard views">
                            {['Line table', 'Hourly chart'].map((label, i) => (
                                <button
                                    key={label}
                                    type="button"
                                    role="tab"
                                    aria-selected={detailCarouselIndex === i}
                                    aria-label={label}
                                    onClick={() => {
                                        setDetailCarouselIndex(i);
                                        setDetailCarouselProgress(0);
                                    }}
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                        detailCarouselIndex === i ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="relative flex-1 min-h-0 overflow-hidden">
                    <div
                        className="flex h-full transition-transform duration-700 ease-in-out motion-reduce:transition-none"
                        style={{ transform: `translateX(-${detailCarouselIndex * 100}%)` }}
                    >
                        <div className="min-w-full h-full flex flex-col p-3 sm:p-4 pt-2">
                <div className="flex-1 min-h-0 overflow-auto -mx-1 px-1">
                    <table className="min-w-full text-xs sm:text-sm">
                        <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b-2 border-gray-200">
                                <th className="px-2 py-1.5 text-left font-bold text-gray-700">LINE</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">TARGET</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">OUTPUT</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">OUTPUT %</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">EFFICIENCY %</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">WIP</th>
                                {/* <th className="px-2 py-1.5 text-center font-bold text-yellow-600">REWORK</th>
                                <th className="px-2 py-1.5 text-center font-bold text-red-600">REJECTION</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {lowerSection.linePerformance?.map((line: any, index: number) => {
                                // const rw = reworkSummary[line.work_centre_id] || { total_rework: 0, total_rejection: 0 };
                                return (
                                    <tr
                                        key={index}
                                        onClick={() => navigate(`/mobile?line=${encodeURIComponent(line.line_name)}`)}
                                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors duration-200 motion-safe:opacity-0 motion-safe:animate-tv-section-in max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100"
                                        style={{ animationDelay: `${Math.min(index, 12) * 55 + 40}ms` }}
                                    >
                                        <td className="px-2 py-2 font-semibold text-gray-800">{line.line_name}</td>
                                        <td className="px-2 py-2 text-center font-bold text-blue-600 tabular-nums">{line.target}</td>
                                        <td className="px-2 py-2 text-center font-bold text-green-600 tabular-nums">{line.output}</td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${
                                                Number(line.output_percentage) >= 90 ? 'bg-green-500' : Number(line.output_percentage) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}>{line.output_percentage}%</span>
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${
                                                Number(line.efficiency) >= 90 ? 'bg-green-500' : Number(line.efficiency) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}>{line.efficiency}%</span>
                                        </td>
                                        <td className="px-2 py-2 text-center font-bold text-red-600 tabular-nums">{line.wip || 0}</td>
                                        {/* <td className="px-2 py-2 text-center font-bold text-yellow-600 tabular-nums">{rw.total_rework}</td>
                                        <td className="px-2 py-2 text-center font-bold text-red-600 tabular-nums">{rw.total_rejection}</td> */}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                        </div>
                        <div className="min-w-full h-full flex flex-col min-h-0">
                            <HourlyOutputChart
                                workCentreId={currentWorkCentreId}
                                workCentreName={lowerSection.workCentreName}
                                showProgress={false}
                                progress={progress}
                                date={currentDate}
                                fitContainer
                                hideTitle
                            />
                        </div>
                    </div>
                </div>
                <div className="px-3 sm:px-4 pb-3 flex-shrink-0">
                    <div className="w-full rounded-full h-1.5 bg-gray-200 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-[width] duration-100 motion-reduce:transition-none"
                            style={{ width: `${detailCarouselProgress}%` }}
                        />
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-gray-400 text-center mt-0.5 tabular-nums hidden sm:block">
                        Auto-switch in {Math.max(0, Math.ceil((DETAIL_CAROUSEL_MS / 1000) * (1 - detailCarouselProgress / 100)))}s
                    </p>
                </div>
            </div>
            </div>

            <div className="min-h-0 h-full flex flex-col motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:140ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
                <div className="h-full min-h-0 flex flex-col bg-white rounded-xl shadow-lg p-2 sm:p-3 border border-gray-100 ring-1 ring-slate-200/60">
                    <h3 className="text-xs sm:text-sm font-bold text-red-600 mb-1.5 flex items-center gap-1.5 flex-shrink-0">
                        <TrendingUp className="h-3.5 w-3.5 text-red-600 motion-safe:animate-pulse motion-reduce:animate-none" />
                        Top 3 Bottleneck Machines
                        {/* {reworkAgeSec !== null && reworkAgeSec > 30 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-1">Rework stale</span>
                        )} */}
                    </h3>
                    {lowerSection.bottlenecks.length > 0 ? (
                        <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
                            {lowerSection.bottlenecks.map((item: any, index: number) => (
                                <div
                                    key={index}
                                    className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-md px-2 py-1.5 shadow-sm motion-safe:opacity-0 motion-safe:animate-tv-section-in max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100"
                                    style={{ animationDelay: `${180 + index * 90}ms` }}
                                >
                                    <div className="flex justify-between items-center gap-1.5">
                                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                            <span className="text-red-600 font-bold text-[10px] bg-white px-1 py-0.5 rounded shadow-sm">#{index + 1}</span>
                                            <div className="flex-1 min-w-0 leading-tight">
                                                <div className="text-gray-800 font-bold text-[11px] sm:text-xs truncate">{item.machine_centre_name}</div>
                                                <div className="text-gray-600 text-[10px] truncate">{item.work_centre_name}</div>
                                            </div>
                                        </div>
                                        <div className="text-red-600 text-sm font-bold flex-shrink-0 bg-white px-1.5 py-0.5 rounded shadow-sm tabular-nums">{item.efficiency}%</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-2 flex items-center justify-center text-gray-400">
                            <div className="text-center px-2 motion-safe:animate-tv-section-in motion-reduce:animate-none">
                                <Smile className="h-6 w-6 mx-auto mb-0.5 text-green-400 motion-safe:animate-tv-breathe motion-reduce:animate-none" />
                                <div className="text-[10px] sm:text-xs">No Bottlenecks - All machines performing well!</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};
