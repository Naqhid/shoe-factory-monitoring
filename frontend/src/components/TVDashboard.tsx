import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Target, Activity, Wifi, WifiOff, RefreshCw, AlertTriangle, ArrowDownToLine, PackageOpen, Wrench, Clock } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';
import { wipTextClass, formatWip, formatInput } from '../utils/wipUtils';
import { formatSinceTimeHHMM, formatTimeRangeHHMM } from '../utils/dateTimeFormat';

export const TVDashboard: React.FC = () => {
    const navigate = useNavigate();
    const PINNED_LINE_STORAGE_KEY = 'tv_dashboard_pinned_line_id';
    const [workCentres, setWorkCentres] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const formatStoppageDetail = (detail?: string | null) => {
        if (!detail) return '';
        return String(detail)
            .replace(/^BOTTLENECK:/i, '')
            .replace(/^BREAKDOWN:/i, '')
            .replace(/\s*\[Approved By:[^\]]+\]\s*$/i, '')
            .trim();
    };

    const getStoppageSortTime = (item: { idle_start_time?: string | null; start_time?: string | null }) => {
        const raw = item.idle_start_time || item.start_time;
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return Number.isNaN(t) ? 0 : t;
    };

    const isStoppageLive = (item: { button_status?: number; finish_time?: string | null }) =>
        Number(item.button_status) === 1 || !item.finish_time;

    const renderStoppageCard = (
        item: any,
        kind: 'bottleneck' | 'breakdown',
        index: number,
        soloOnSlide = false,
        compactOnSlide = false
    ) => {
        const isBreakdown = kind === 'breakdown';
        const isLive = Number(item.button_status) === 1;
        const badgeLabel = isBreakdown ? 'BREAKDOWN' : 'BOTTLENECK';
        const detail = formatStoppageDetail(item.detail);
        const Icon = isBreakdown ? Wrench : AlertTriangle;

        const timeLabel =
            isLive && item.idle_start_time
                ? formatSinceTimeHHMM(item.idle_start_time)
                : formatTimeRangeHHMM(item.start_time, item.finish_time);

        const lineTimeLabel = [item.work_centre_name, timeLabel].filter(Boolean).join(' • ');

        const cardTheme = isBreakdown
            ? {
                shell: 'bg-gradient-to-br from-red-800 via-red-700 to-red-600 border-red-900 ring-red-500/50 shadow-red-950/50',
                accent: 'border-l-red-950',
                title: 'text-white',
                timeChip: 'bg-yellow-300 text-red-950 ring-2 ring-yellow-100 shadow-md',
                detail: 'text-white/95',
                badge: 'bg-red-950 text-white ring-red-400/60',
                icon: 'text-white/90',
                live: 'bg-red-950 ring-red-400/40',
            }
            : {
                shell: 'bg-gradient-to-br from-orange-600 via-red-600 to-red-700 border-orange-700 ring-orange-400/50 shadow-orange-900/40',
                accent: 'border-l-orange-400',
                title: 'text-white',
                timeChip: 'bg-white text-red-800 ring-2 ring-white/90 shadow-md',
                detail: 'text-white/95',
                badge: 'bg-white/95 text-red-700 ring-2 ring-white/80 shadow-sm',
                icon: 'text-orange-100',
                live: 'bg-orange-800 ring-orange-200/50',
            };

        const titleSize = soloOnSlide ? 'text-sm sm:text-base' : compactOnSlide ? 'text-xs leading-tight' : 'text-xs sm:text-sm';
        const chipSize = soloOnSlide ? 'text-xs sm:text-sm' : compactOnSlide ? 'text-[10px] sm:text-xs leading-snug' : 'text-[10px] sm:text-[11px]';
        const detailSize = soloOnSlide ? 'text-xs sm:text-sm' : compactOnSlide ? 'text-[10px] sm:text-xs leading-tight' : 'text-[10px] sm:text-[11px]';

        return (
            <div
                key={`${kind}-${index}-${item.machine_centre_name}-${item.start_time || item.idle_start_time || ''}`}
                className={[
                    'w-full max-w-full self-stretch rounded-lg border-2 border-l-[6px] ring-2 shadow-lg flex flex-col min-h-0',
                    soloOnSlide ? 'flex-1 justify-center px-3 py-3 sm:px-4 sm:py-4' : compactOnSlide ? 'flex-1 min-h-0 px-2 py-1.5' : 'flex-1 px-2.5 py-2.5',
                    cardTheme.shell,
                    cardTheme.accent,
                    isLive
                        ? isBreakdown
                            ? 'motion-safe:animate-tv-stoppage-glow motion-reduce:animate-none'
                            : 'motion-safe:animate-tv-stoppage-glow-bottleneck motion-reduce:animate-none'
                        : '',
                ].join(' ')}
            >
                <div
                    className={`flex flex-col items-center justify-center text-center w-full min-h-0 flex-1 ${
                        compactOnSlide ? 'gap-0.5 overflow-y-auto overscroll-contain' : soloOnSlide ? 'gap-2' : 'gap-1.5'
                    }`}
                >
                    <div className="flex flex-wrap items-center justify-center gap-1 shrink-0">
                        {isLive && (
                            <span
                                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-white ${cardTheme.live}`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse motion-reduce:animate-none" />
                                Live
                            </span>
                        )}
                        <span
                            className={`${compactOnSlide ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] sm:text-[10px] px-2 py-1'} font-extrabold uppercase tracking-wide rounded-md shadow-md ring-1 ${cardTheme.badge}`}
                        >
                            {badgeLabel}
                        </span>
                        {!compactOnSlide && (
                            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${cardTheme.icon}`} aria-hidden />
                        )}
                    </div>
                    <div
                        className={`font-extrabold shrink-0 w-full ${cardTheme.title} ${titleSize} ${
                            compactOnSlide ? 'line-clamp-1' : 'line-clamp-2'
                        }`}
                    >
                        {item.machine_centre_name}
                    </div>
                    {detail ? (
                        <div
                            className={`font-bold shrink-0 w-full leading-snug ${cardTheme.detail} ${detailSize} line-clamp-3`}
                            title={detail}
                        >
                            {detail}
                        </div>
                    ) : null}
                    {lineTimeLabel ? (
                        <div
                            className={`shrink-0 w-full rounded-md px-2 py-0.5 sm:py-1 font-extrabold tabular-nums ${cardTheme.timeChip} ${chipSize}`}
                        >
                            <span className="flex items-center justify-center gap-1">
                                <Clock className={`${compactOnSlide ? 'h-2.5 w-2.5' : 'h-3 w-3'} shrink-0 opacity-80`} aria-hidden />
                                <span className="break-words">{lineTimeLabel}</span>
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };
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
    const [stoppageCarouselIndex, setStoppageCarouselIndex] = useState(0);
    const [stoppageCarouselProgress, setStoppageCarouselProgress] = useState(0);

    const DETAIL_CAROUSEL_SLIDES = 2;
    const DETAIL_CAROUSEL_MS = 30000;
    const STOPPAGE_CAROUSEL_MS = 15000;

    const bottleneckList = dashboardData?.lowerSection?.bottlenecks ?? [];
    const breakdownList = dashboardData?.lowerSection?.breakdowns ?? [];

    const mergedStoppageEvents = useMemo(() => {
        const bn = bottleneckList.map((item: any) => ({ ...item, kind: 'bottleneck' as const }));
        const bd = breakdownList.map((item: any) => ({ ...item, kind: 'breakdown' as const }));
        return [...bn, ...bd].sort((a, b) => {
            const aLive = isStoppageLive(a);
            const bLive = isStoppageLive(b);
            if (aLive !== bLive) return aLive ? -1 : 1;
            return getStoppageSortTime(b) - getStoppageSortTime(a);
        });
    }, [dashboardData]);

    const stoppageItemsPerSlide = useMemo(() => {
        if (mergedStoppageEvents.length === 0) return 2;
        const maxDetailLen = Math.max(
            0,
            ...mergedStoppageEvents.map((e) => formatStoppageDetail(e.detail).length)
        );
        return maxDetailLen > 22 ? 1 : 2;
    }, [mergedStoppageEvents]);

    const stoppageSlideCount = mergedStoppageEvents.length === 0
        ? 1
        : Math.ceil(mergedStoppageEvents.length / stoppageItemsPerSlide);

    const stoppageSlides = useMemo(() => {
        if (mergedStoppageEvents.length === 0) return [];
        const slides: typeof mergedStoppageEvents[] = [];
        for (let i = 0; i < mergedStoppageEvents.length; i += stoppageItemsPerSlide) {
            slides.push(mergedStoppageEvents.slice(i, i + stoppageItemsPerSlide));
        }
        return slides;
    }, [mergedStoppageEvents, stoppageItemsPerSlide]);

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
        setStoppageCarouselIndex(0);
        setStoppageCarouselProgress(0);
    }, [currentIndex]);

    useEffect(() => {
        setStoppageCarouselIndex(0);
        setStoppageCarouselProgress(0);
    }, [stoppageSlideCount]);

    useEffect(() => {
        setStoppageCarouselIndex((prev) => (prev >= stoppageSlideCount ? 0 : prev));
    }, [stoppageSlideCount]);

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

    useEffect(() => {
        if (stoppageSlideCount <= 1 || mergedStoppageEvents.length === 0) return;

        const rotateInterval = setInterval(() => {
            setStoppageCarouselIndex((prev) => (prev + 1) % stoppageSlideCount);
            setStoppageCarouselProgress(0);
        }, STOPPAGE_CAROUSEL_MS);

        return () => clearInterval(rotateInterval);
    }, [currentIndex, stoppageSlideCount]);

    useEffect(() => {
        if (stoppageSlideCount <= 1 || mergedStoppageEvents.length === 0) return;

        const tickMs = 100;
        const increment = (tickMs / STOPPAGE_CAROUSEL_MS) * 100;
        const interval = setInterval(() => {
            setStoppageCarouselProgress((prev) => Math.min(prev + increment, 100));
        }, tickMs);

        return () => clearInterval(interval);
    }, [stoppageCarouselIndex, currentIndex, stoppageSlideCount]);

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
    const overallInputPercent = Number(topSection.target || 0) > 0
        ? Math.round((Number(topSection.input || 0) / Number(topSection.target || 0)) * 100)
        : 0;

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
                    <div className="grid grid-cols-6 gap-1 sm:gap-2 min-w-0">
                        {/* ── Target ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-0 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <Target className="h-4 w-4 sm:h-7 sm:w-7 text-white mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Target</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">{topSection.target}</div>
                        </div>
                        {/* ── Input (Heel Grip Machine) — NEW MES card ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-[50ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <ArrowDownToLine className="h-4 w-4 sm:h-7 sm:w-7 text-cyan-300 mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Input</div>
                            <div className="text-cyan-300 text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">
                                {formatInput(topSection.input)}
                            </div>
                        </div>
                        {/* ── Input % ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-75 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <ArrowDownToLine className="h-4 w-4 sm:h-7 sm:w-7 text-sky-300 mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Input efficiency %</div>
                            <div className={`text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none ${overallInputPercent >= 90 ? 'text-green-300' : overallInputPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {overallInputPercent}%
                            </div>
                        </div>
                        {/* ── Output ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-100 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <TrendingUp className="h-4 w-4 sm:h-7 sm:w-7 text-green-300 mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Output</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">{topSection.output}</div>
                        </div>
                        {/* ── Output % ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-150 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <Activity className="h-4 w-4 sm:h-7 sm:w-7 text-purple-300 mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">Output efficiency %</div>
                            <div className={`text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none ${topSection.outputPercent >= 90 ? 'text-green-300' : topSection.outputPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {topSection.outputPercent}%
                            </div>
                        </div>
                        {/* ── WIP (MES formula) — replaces emoji slot, emoji moves inline ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-200 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <PackageOpen className={`h-4 w-4 sm:h-7 sm:w-7 mx-auto mb-0.5 sm:mb-1 drop-shadow-md ${wipTextClass(topSection.currentWip ?? 0, topSection.target)}`} />
                            <div className="text-white/90 text-[9px] sm:text-xs mb-0.5 font-medium truncate">WIP</div>
                            <div className={`text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none ${wipTextClass(topSection.currentWip ?? 0, topSection.target)}`}>
                                {formatWip(topSection.currentWip)}
                            </div>
                        </div>
                    </div>
                    {/* ── Performance emoji — shown below KPI row (disabled) ── */}
                    {/* <div className="flex justify-center mt-1.5 sm:mt-2">
                        {topSection.showHappyEmoji ? (
                            <Smile className="h-6 w-6 sm:h-10 sm:w-10 text-green-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" />
                        ) : topSection.showMediumEmoji ? (
                            <Meh className="h-6 w-6 sm:h-10 sm:w-10 text-yellow-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" style={{ animationDelay: '0.4s' }} />
                        ) : (
                            <Frown className="h-6 w-6 sm:h-10 sm:w-10 text-red-300 drop-shadow-lg motion-safe:animate-tv-breathe motion-reduce:animate-none" style={{ animationDelay: '0.2s' }} />
                        )}
                    </div> */}
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-4 gap-2 sm:gap-3 overflow-hidden min-w-0">
            <div className="col-span-3 min-h-0 h-full flex flex-col motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:80ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
            <div className="h-full min-h-0 flex flex-col bg-white rounded-xl shadow-lg border border-gray-100 ring-1 ring-slate-200/60 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pt-3 pb-2 flex-shrink-0 border-b border-gray-100">
                    <h3 className="font-bold text-blue-600 truncate" style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.3px' }}>
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
                                        detailCarouselIndex === i ? 'w-6 bg-blue-500' : 'w-2 bg-slate-300 hover:bg-slate-400'
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
                        <thead className="sticky top-0 z-10 bg-white">
                            <tr className="border-b-2 border-gray-200">
                                <th className="px-2 py-1.5 text-left font-bold text-gray-700">LINE</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">TARGET</th>
                                {/* INPUT column — live Heel Grip Machine quantity */}
                                <th className="px-2 py-1.5 text-center font-bold text-cyan-600">INPUT</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">INPUT %</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">OUTPUT</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">OUTPUT %</th>
                                <th className="px-2 py-1.5 text-center font-bold text-gray-700">WIP</th>
                                {/* <th className="px-2 py-1.5 text-center font-bold text-yellow-600">REWORK</th>
                                <th className="px-2 py-1.5 text-center font-bold text-red-600">REJECTION</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {lowerSection.linePerformance?.map((line: any, index: number) => {
                                // const rw = reworkSummary[line.work_centre_id] || { total_rework: 0, total_rejection: 0 };
                                const lineTarget = Number(line.target || 0);
                                const lineInputPercent = lineTarget > 0
                                    ? Math.round((Number(line.input || 0) / lineTarget) * 100)
                                    : 0;
                                return (
                                    <tr
                                        key={index}
                                        onClick={() => navigate(`/mobile?line=${encodeURIComponent(line.line_name)}`)}
                                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors duration-200 motion-safe:opacity-0 motion-safe:animate-tv-section-in max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100"
                                        style={{ animationDelay: `${Math.min(index, 12) * 55 + 40}ms` }}
                                    >
                                        <td className="px-2 py-2 font-semibold text-gray-800">{line.line_name}</td>
                                        <td className="px-2 py-2 text-center font-bold text-blue-600 tabular-nums">{line.target}</td>
                                        {/* INPUT — live Heel Grip Machine quantity for this line */}
                                        <td className="px-2 py-2 text-center font-bold text-cyan-600 tabular-nums">
                                            {formatInput(line.input)}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${
                                                lineInputPercent >= 90 ? 'bg-green-500' : lineInputPercent >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}>{lineInputPercent}%</span>
                                        </td>
                                        <td className="px-2 py-2 text-center font-bold text-green-600 tabular-nums">{line.output}</td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${
                                                Number(line.output_percentage) >= 90 ? 'bg-green-500' : Number(line.output_percentage) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}>{line.output_percentage}%</span>
                                        </td>
                                        {/* WIP — MES formula: Opening WIP + Input - Output */}
                                        <td className={`px-2 py-2 text-center font-bold tabular-nums ${
                                            Number(line.wip) > 0 ? 'text-orange-600' : 'text-emerald-600'
                                        }`}>
                                            {formatWip(line.wip)}
                                        </td>
                                        {/* <td className="px-2 py-2 text-center font-bold text-yellow-600 tabular-nums">{rw.total_rework}</td>
                                        <td className="px-2 py-2 text-center font-bold text-red-600 tabular-nums">{rw.total_rejection}</td> */}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                        </div>
                        <div className="min-w-full h-full flex flex-col min-h-0" style={{ background: 'rgba(239,246,255,0.95)', borderRadius: '12px', overflow: 'hidden' }}>
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
                <div className="px-3 mt-2 sm:px-4 pb-3 flex-shrink-0">
                    <div className="w-full rounded-full h-1.5 bg-gray-200 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-blue-500 transition-[width] duration-100 motion-reduce:transition-none"
                            style={{ width: `${detailCarouselProgress}%` }}
                        />
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-blue-500 font-semibold text-center mt-0.5 tabular-nums hidden sm:block">
                        Auto-switch in {Math.max(0, Math.ceil((DETAIL_CAROUSEL_MS / 1000) * (1 - detailCarouselProgress / 100)))}s
                    </p>
                </div>
            </div>
            </div>

            <div className="col-span-1 min-h-0 h-full flex flex-col motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:140ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
                <div className="h-full min-h-0 flex flex-col rounded-xl shadow-lg p-2 sm:p-3 border border-gray-200 bg-white ring-1 ring-slate-200/60 overflow-hidden">
                    <div className="flex-shrink-0 mb-1.5">
                        <h3 className="font-bold text-red-600 flex items-center gap-1.5 leading-tight text-sm sm:text-base">
                            <TrendingUp className="h-3.5 w-3.5 text-red-600 motion-safe:animate-pulse motion-reduce:animate-none flex-shrink-0" />
                            <span>Bottleneck &amp; Breakdown</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-orange-900 ring-1 ring-orange-300 tabular-nums">
                                Bottleneck {bottleneckList.length}
                            </span>
                            <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-red-900 ring-1 ring-red-300 tabular-nums">
                                Breakdown {breakdownList.length}
                            </span>
                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-gray-700 ring-1 ring-gray-200 tabular-nums">
                                Total {mergedStoppageEvents.length}
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="relative flex-1 min-h-0 w-full overflow-hidden">
                            {mergedStoppageEvents.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center px-2">
                                    <p className="text-[10px] sm:text-xs text-gray-400">No bottlenecks or breakdowns today</p>
                                </div>
                            ) : (
                                <div
                                    className="flex h-full w-full transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                                    style={{ transform: `translateX(-${stoppageCarouselIndex * 100}%)` }}
                                >
                                    {stoppageSlides.map((slide, slideIdx) => (
                                        <div
                                            key={`stoppage-slide-${slideIdx}`}
                                            className="flex-[0_0_100%] w-full h-full min-h-0 flex flex-col gap-1.5 overflow-hidden"
                                        >
                                            {slide.map((item, itemIdx) =>
                                                renderStoppageCard(
                                                    item,
                                                    item.kind,
                                                    slideIdx * stoppageItemsPerSlide + itemIdx,
                                                    slide.length === 1,
                                                    slide.length > 1
                                                )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {mergedStoppageEvents.length > 0 && stoppageSlideCount > 1 && (
                            <div className="flex-shrink-0 pt-1 pb-0.5 border-t border-gray-100 mt-1">
                                <div className="flex items-center justify-center gap-1.5 mb-1" role="tablist" aria-label="Stoppage events">
                                    {stoppageSlides.map((_, i) => (
                                        <button
                                            key={`stoppage-dot-${i}`}
                                            type="button"
                                            role="tab"
                                            aria-selected={stoppageCarouselIndex === i}
                                            aria-label={`Stoppage page ${i + 1}`}
                                            onClick={() => {
                                                setStoppageCarouselIndex(i);
                                                setStoppageCarouselProgress(0);
                                            }}
                                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                                stoppageCarouselIndex === i ? 'w-5 bg-red-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <div className="w-full rounded-full h-1 bg-gray-200 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-red-500 transition-[width] duration-100 motion-reduce:transition-none"
                                        style={{ width: `${stoppageCarouselProgress}%` }}
                                    />
                                </div>
                                <p className="text-[9px] sm:text-[10px] text-red-500 font-semibold text-center mt-0.5 tabular-nums">
                                    {stoppageCarouselIndex + 1}/{stoppageSlideCount} · Auto-switch in{' '}
                                    {Math.max(0, Math.ceil((STOPPAGE_CAROUSEL_MS / 1000) * (1 - stoppageCarouselProgress / 100)))}s
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};
