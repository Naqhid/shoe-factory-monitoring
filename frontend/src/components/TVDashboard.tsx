import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smile, Frown, Meh, TrendingUp, Target, Zap, Activity, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';
import { TV_ACCENT, TV_BG, TV_KPI_CARD, TV_KPI_LABEL, TV_KPI_VALUE, TV_PANEL, tvPctTextClass } from './tvDashboardTheme';

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
                const [dashRes, reworkRes] = await Promise.allSettled([
                    apiFetch(`${API_BASE_URL}/api/tv-dashboard/dashboard/${workCentreId}?date=${currentDate}`),
                    apiFetch(`${API_BASE_URL}/api/rework-rejection/summary?date=${currentDate}`)
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

                if (reworkRes.status === 'fulfilled') {
                    const reworkResult = await reworkRes.value.json();
                    if (reworkResult.success && Array.isArray(reworkResult.data)) {
                        setReworkUpdatedAt(new Date());
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
            <div className="min-h-[100dvh] bg-[#003399] flex items-center justify-center p-6">
                <div className={`${TV_PANEL} rounded-lg p-8 max-w-lg w-full text-center text-white`}>
                    <h2 className="text-2xl font-bold text-red-300 mb-3">Dashboard Unavailable</h2>
                    <p className="text-white/80 mb-6">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-white/20 text-white px-5 py-2 rounded border border-white/40 hover:bg-white/30 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (loading || !dashboardData) {
        return (
            <div className="min-h-[100dvh] bg-[#003399] flex items-center justify-center">
                <div className="text-[#CCFF00] text-2xl motion-safe:animate-pulse">Loading Dashboard...</div>
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
        <div className={`min-h-[100dvh] ${TV_BG} text-white p-3 sm:p-6 2xl:p-10 2xl:max-w-[min(122rem,96vw)] mx-auto font-sans`}>
            <div key={String(currentWorkCentreId ?? currentIndex)} className={`${TV_PANEL} rounded-lg p-4 sm:p-8 2xl:p-10 mb-4 sm:mb-6 2xl:mb-8 motion-safe:animate-tv-section-in max-sm:motion-safe:animate-none motion-reduce:animate-none`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-4xl lg:text-5xl 2xl:text-6xl font-bold text-white drop-shadow-lg tracking-tight">{topSection.workCentreName}</h1>
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
                        <div className="text-left sm:text-right rounded-xl px-4 py-2 2xl:px-6 2xl:py-3 ring-1 bg-slate-950/50 backdrop-blur-md ring-white/30 max-sm:drop-shadow-md sm:bg-white/10 sm:backdrop-blur-sm sm:ring-white/15">
                            <div className="text-white text-lg sm:text-2xl 2xl:text-3xl font-semibold max-sm:font-bold tabular-nums">
                                {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-blue-100 text-base sm:text-xl 2xl:text-2xl font-medium tabular-nums">
                                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-blue-100 text-xs sm:text-sm mt-1 font-medium">
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
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${pinnedWorkCentreId ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40' : 'bg-white/15 text-white/90 border border-white/25'}`}
                            >
                                {pinnedWorkCentreId ? 'Pinned Line' : 'Auto Rotate'}
                            </button>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${isOffline ? 'bg-red-500/25 text-red-200 border border-red-400/40' : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'}`}>
                                {isOffline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                                {isOffline ? 'Offline' : 'Online'}
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${isCriticalStale ? 'bg-red-500/25 text-red-200 border border-red-400/40' : isStale ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40' : 'bg-blue-400/25 text-blue-100 border border-blue-300/40'}`}>
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {secondsSinceUpdate === null ? 'No live data yet' : isCriticalStale ? `Data stale (${secondsSinceUpdate}s)` : isStale ? `Data aging (${secondsSinceUpdate}s)` : `Live (${secondsSinceUpdate}s ago)`}
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${isRefreshing ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40' : 'bg-white/15 text-white/90 border border-white/25'}`}>
                                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                {isRefreshing ? 'Refreshing...' : 'Auto-refresh 10s'}
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${needActionCount > 0 ? 'bg-red-500/25 text-red-200 border border-red-400/40' : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'}`}>
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Lines Below Target: {needActionCount}
                            </div>
                            {topPerformer && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-cyan-500/25 text-cyan-200 border border-cyan-400/40">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    Best: {topPerformer.line_name || '-'} ({Number(topPerformer.efficiency || 0)}%)
                                </div>
                            )}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-sky-500/25 text-sky-200 border border-sky-400/40">
                                Shift Used: {shiftWindow.elapsedPct}%
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-violet-500/25 text-violet-200 border border-violet-400/40">
                                Remaining: {shiftWindow.remainingMin}m
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${targetGap > 0 ? 'bg-rose-500/25 text-rose-200 border border-rose-400/40' : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'}`}>
                                {recoveryLabel}
                            </div>
                            {retryAttempts > 0 && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-orange-500/25 text-orange-200 border border-orange-400/40">
                                    Retry attempt {retryAttempts}
                                </div>
                            )}
                        </div>
                    )}
                    {(partialWarning || errorMessage || isOffline || isCriticalStale) && (
                        <div className={`rounded-xl px-4 py-3 text-sm font-semibold mb-4 ${isOffline || isCriticalStale ? 'bg-red-500/25 text-red-200 border border-red-400/40' : 'bg-amber-500/25 text-amber-200 border border-amber-400/40'}`}>
                            {isOffline
                                ? 'Connection lost. Showing last available data. Auto-retry is active.'
                                : isCriticalStale
                                    ? 'Data feed appears stale. Showing last available snapshot while auto-retry continues.'
                                    : partialWarning || errorMessage}
                        </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 2xl:gap-8">
                        <div className={`${TV_KPI_CARD} motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-0 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none`}>
                            <Target className="h-8 w-8 sm:h-12 sm:w-12 2xl:h-14 2xl:w-14 text-white mx-auto mb-2 sm:mb-3 drop-shadow-md transition-transform duration-500 motion-safe:hover:scale-110" />
                            <div className="text-white/90 text-xs sm:text-sm 2xl:text-base mb-1 sm:mb-2 font-medium">Target</div>
                            <div className="text-white text-2xl sm:text-4xl 2xl:text-5xl font-bold drop-shadow-md max-sm:[text-shadow:0_2px_8px_rgba(0,0,0,0.45)] tabular-nums transition-transform duration-300">{topSection.target}</div>
                        </div>
                        <div className={`${TV_KPI_CARD} motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-75 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none`}>
                            <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 2xl:h-14 2xl:w-14 text-green-300 mx-auto mb-2 sm:mb-3 drop-shadow-md transition-transform duration-500 motion-safe:hover:scale-110" />
                            <div className="text-white/90 text-xs sm:text-sm 2xl:text-base mb-1 sm:mb-2 font-medium">Output</div>
                            <div className="text-[#CCFF00] text-2xl sm:text-4xl 2xl:text-5xl font-bold tabular-nums">{topSection.output}</div>
                        </div>
                        <div className={`${TV_KPI_CARD} motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-100 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none`}>
                            <Activity className="h-8 w-8 sm:h-12 sm:w-12 2xl:h-14 2xl:w-14 text-purple-300 mx-auto mb-2 sm:mb-3 drop-shadow-md transition-transform duration-500 motion-safe:hover:scale-110" />
                            <div className={TV_KPI_LABEL}>Output %</div>
                            <div className={`${TV_KPI_VALUE} ${tvPctTextClass(topSection.outputPercent)}`}>
                                {topSection.outputPercent}%
                            </div>
                        </div>
                        <div className={`${TV_KPI_CARD} motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-150 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none`}>
                            <Zap className="h-8 w-8 sm:h-12 sm:w-12 2xl:h-14 2xl:w-14 text-yellow-300 mx-auto mb-2 sm:mb-3 drop-shadow-md transition-transform duration-500 motion-safe:hover:scale-110" />
                            <div className={TV_KPI_LABEL}>Efficiency %</div>
                            <div className={`${TV_KPI_VALUE} ${tvPctTextClass(topSection.efficiencyPercent)}`}>
                                {topSection.efficiencyPercent}%
                            </div>
                        </div>
                        <div className={`${TV_KPI_CARD} flex items-center justify-center col-span-2 sm:col-span-1 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-200 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none`}>
                            {topSection.showHappyEmoji ? (
                                <Smile className="h-16 w-16 sm:h-24 sm:w-24 2xl:h-28 2xl:w-28 text-green-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" />
                            ) : topSection.showMediumEmoji ? (
                                <Meh className="h-16 w-16 sm:h-24 sm:w-24 2xl:h-28 2xl:w-28 text-yellow-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" style={{ animationDelay: '0.4s' }} />
                            ) : (
                                <Frown className="h-16 w-16 sm:h-24 sm:w-24 2xl:h-28 2xl:w-28 text-red-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" style={{ animationDelay: '0.2s' }} />
                            )}
                        </div>
                    </div>
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-2 2xl:gap-8 2xl:items-start">
            <div className="mb-4 sm:mb-6 2xl:mb-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:80ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
            <div className={`${TV_PANEL} rounded-lg p-4 sm:p-8 2xl:p-10`}>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-xl lg:text-2xl 2xl:text-3xl font-bold text-white uppercase tracking-wider">Line Performance</h3>
                    {dashboardAgeSec !== null && dashboardAgeSec > 30 && (
                        <span className="text-xs 2xl:text-sm font-semibold px-2 py-1 rounded border border-amber-400/50 bg-amber-500/20 text-amber-200">Stale metrics</span>
                    )}
                </div>
                <div className="overflow-x-auto -mx-1 px-1">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b-2 border-white/40">
                                <th className="px-4 py-3 2xl:px-6 2xl:py-4 text-left text-sm 2xl:text-base font-bold text-white uppercase tracking-wide">Line</th>
                                <th className="px-4 py-3 2xl:px-6 text-center text-sm 2xl:text-base font-bold text-white uppercase tracking-wide">Target</th>
                                <th className="px-4 py-3 2xl:px-6 text-center text-sm 2xl:text-base font-bold text-white uppercase tracking-wide">Output</th>
                                <th className="px-4 py-3 2xl:px-6 text-center text-sm 2xl:text-base font-bold text-white uppercase tracking-wide">Output %</th>
                                <th className="px-4 py-3 2xl:px-6 text-center text-sm 2xl:text-base font-bold text-white uppercase tracking-wide">Efficiency %</th>
                                <th className="px-4 py-3 2xl:px-6 text-center text-sm 2xl:text-base font-bold text-white uppercase tracking-wide">WIP</th>
                                
                            </tr>
                        </thead>
                        <tbody>
                            {lowerSection.linePerformance?.map((line: any, index: number) => {
                                const rw = reworkSummary[line.work_centre_id] || { total_rework: 0, total_rejection: 0 };
                                return (
                                    <tr
                                        key={index}
                                        onClick={() => navigate(`/mobile?line=${encodeURIComponent(line.line_name)}`)}
                                        className="border-b border-white/20 hover:bg-white/10 cursor-pointer transition-colors duration-200 motion-safe:opacity-0 motion-safe:animate-tv-section-in max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100"
                                        style={{ animationDelay: `${Math.min(index, 12) * 55 + 40}ms` }}
                                    >
                                        <td className="px-4 py-4 2xl:px-6 2xl:py-5 text-sm 2xl:text-lg font-bold text-[#CCFF00]">{line.line_name}</td>
                                        <td className="px-4 py-4 2xl:px-6 text-center text-lg 2xl:text-2xl font-bold text-white tabular-nums">{line.target}</td>
                                        <td className="px-4 py-4 2xl:px-6 text-center text-lg 2xl:text-2xl font-bold text-[#CCFF00] tabular-nums">{line.output}</td>
                                        <td className="px-4 py-4 2xl:px-6 text-center">
                                            <span className={`text-lg 2xl:text-2xl font-bold tabular-nums ${tvPctTextClass(Number(line.output_percentage))}`}>{line.output_percentage}%</span>
                                        </td>
                                        <td className="px-4 py-4 2xl:px-6 text-center">
                                            <span className={`text-lg 2xl:text-2xl font-bold tabular-nums ${tvPctTextClass(Number(line.efficiency))}`}>{line.efficiency}%</span>
                                        </td>
                                        <td className="px-4 py-4 2xl:px-6 text-center text-lg 2xl:text-2xl font-bold text-white tabular-nums">{line.wip || 0}</td>
                                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>

            <div className="motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:140ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
            <div className="space-y-4 sm:space-y-6 2xl:space-y-8">
                <HourlyOutputChart 
                    workCentreId={currentWorkCentreId} 
                    workCentreName={lowerSection.workCentreName}
                    showProgress={workCentres.length > 1}
                    progress={progress}
                    date={currentDate}
                    variant="airport"
                />

                <div className={`${TV_PANEL} rounded-lg p-4 sm:p-8 2xl:p-10`}>
                    <h3 className="text-lg sm:text-xl lg:text-2xl 2xl:text-3xl font-bold text-white uppercase tracking-wider mb-4 sm:mb-6 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 2xl:h-8 2xl:w-8 text-red-300 motion-safe:animate-pulse motion-reduce:animate-none" />
                        Top 3 Bottleneck Machines
                        {reworkAgeSec !== null && reworkAgeSec > 30 && (
                            <span className="text-xs 2xl:text-sm font-semibold px-2 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 ml-2">Rework stale</span>
                        )}
                    </h3>
                    {lowerSection.bottlenecks.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4 2xl:space-y-5">
                            {lowerSection.bottlenecks.map((item: any, index: number) => (
                                <div
                                    key={index}
                                    className="bg-gradient-to-r border border-white/25 border-l-4 border-l-red-400 bg-[#001a4d]/90 rounded p-3 sm:p-4 2xl:p-5 shadow-sm hover:shadow-lg transition-all duration-500 motion-safe:opacity-0 motion-safe:animate-tv-section-in max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100 2xl:hover:translate-x-1"
                                    style={{ animationDelay: `${180 + index * 90}ms` }}
                                >
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <span className="text-[#CCFF00] font-bold text-lg 2xl:text-xl bg-[#003399] px-2 border border-white/30 py-1 rounded shadow-sm">#{index + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[#CCFF00] font-bold text-sm sm:text-lg 2xl:text-2xl truncate">{item.machine_centre_name}</div>
                                                <div className="text-white/70 text-xs sm:text-sm 2xl:text-lg truncate">{item.work_centre_name}</div>
                                            </div>
                                        </div>
                                        <div className="text-white text-2xl sm:text-3xl 2xl:text-4xl font-bold flex-shrink-0 bg-red-600/80 px-3 py-1 2xl:px-4 2xl:py-2 rounded-lg shadow-sm tabular-nums">{item.efficiency}%</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 sm:h-64 2xl:h-72 text-white/50">
                            <div className="text-center px-4 motion-safe:animate-tv-section-in motion-reduce:animate-none">
                                <Smile className="h-12 w-12 sm:h-16 sm:w-16 2xl:h-20 2xl:w-20 mx-auto mb-3 sm:mb-4 text-[#CCFF00] motion-safe:animate-tv-breathe motion-reduce:animate-none" />
                                <div className="text-sm sm:text-xl 2xl:text-2xl">No Bottlenecks - All machines performing well!</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </div>
            </div>
        </div>
    );
};
