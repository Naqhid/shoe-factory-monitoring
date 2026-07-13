import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Target, Activity, Wifi, WifiOff, RefreshCw, AlertTriangle, ArrowDownToLine, PackageOpen, Wrench, Clock, ClipboardList, RotateCcw, XCircle } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';
import { loadEfficiencyThresholds, getEfficiencyBgClass } from '../utils/efficiencyColors';
// import { TvPlanPacePanel } from './TvPlanPacePanel';
import { TvMachinePacePanel, TvMachinePaceLegend } from './TvMachinePacePanel';
import { buildMachinePaceSnapshot, getProductiveShiftTotals } from '../utils/shiftPaceUtils';
import { wipTextClass, formatWip, formatInput } from '../utils/wipUtils';
import { formatSinceTimeHHMM, formatTimeRangeHHMM } from '../utils/dateTimeFormat';
import { minutesToDurationParts, formatDurationString } from '../utils/formatCycleDuration';
import { M4_BADGE_CLASS, M4_REASON_ROW_CLASS, M4_REASON_TEXT_CLASS } from '../utils/m4ReasonUtils';

const formatPairsPerHour = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return '—';
    const rounded = Math.round(value * 10) / 10;
    const num = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${num}/hr`;
};

export const TVDashboard: React.FC = () => {
    const navigate = useNavigate();
    const PINNED_LINE_STORAGE_KEY = 'tv_dashboard_pinned_line_id';
    const [workCentres, setWorkCentres] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Load efficiency color thresholds on mount
    useEffect(() => { loadEfficiencyThresholds(); }, []);

    const formatStoppageDetail = (detail?: string | null) => {
        if (!detail) return '';
        return String(detail)
            .replace(/^BOTTLENECK:/i, '')
            .replace(/^BREAKDOWN:/i, '')
            .replace(/\s*\[Approved By:[^\]]+\]\s*$/i, '')
            .trim();
    };

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

    const M4_LEFT_BORDER_CLASS: Record<string, string> = {
        MAN: 'border-l-blue-500',
        MACHINE: 'border-l-violet-500',
        MATERIAL: 'border-l-emerald-500',
        METHOD: 'border-l-indigo-500',
    };

    const renderReworkCard = (row: any, index: number, soloOnSlide = false) => {
        const reworkQty = Number(row.rework_qty || 0);
        const rejectionQty = Number(row.rejection_qty || 0);
        const category = String(row.reason_category || '').trim();
        const reasonLabel = String(row.reason || '').trim() || '—';
        const reasonRowClass = M4_REASON_ROW_CLASS[category] || 'bg-amber-50/90 ring-amber-200/70';
        const reasonTextClass = M4_REASON_TEXT_CLASS[category] || 'text-slate-800';
        const leftBorderClass = M4_LEFT_BORDER_CLASS[category] || 'border-l-amber-500';

        return (
            <div
                key={`rework-${index}-${row.machine_centre_name}`}
                className={[
                    'w-full max-w-full rounded-xl border-2 border-l-[6px] bg-gradient-to-br from-white via-amber-50/40 to-orange-50/60',
                    'ring-1 shadow-md flex flex-col min-h-0',
                    leftBorderClass,
                    'border-amber-200/90 ring-amber-200/60',
                    soloOnSlide ? 'flex-1 justify-center px-3 py-3' : 'px-2.5 py-2.5',
                ].join(' ')}
            >
                <div className={`flex items-start gap-2 ${soloOnSlide ? 'mb-3' : 'mb-2'}`}>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                        <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                    </div>
                    <p
                        className={`font-extrabold text-slate-900 leading-snug line-clamp-2 flex-1 text-left ${
                            soloOnSlide ? 'text-sm sm:text-base' : 'text-[11px] sm:text-xs'
                        }`}
                        title={row.machine_centre_name}
                    >
                        {row.machine_centre_name}
                    </p>
                </div>

                <div className={`grid grid-cols-2 gap-1.5 ${soloOnSlide ? 'mb-3' : 'mb-2'}`}>
                    <div className="rounded-lg border border-yellow-200 bg-gradient-to-b from-yellow-50 to-yellow-100/80 px-2 py-1.5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-yellow-800/90">
                            <RotateCcw className="h-2.5 w-2.5" aria-hidden />
                            Rework
                        </div>
                        <p className={`font-black tabular-nums text-yellow-900 ${soloOnSlide ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
                            {reworkQty}
                        </p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-gradient-to-b from-red-50 to-red-100/80 px-2 py-1.5 text-center shadow-sm">
                        <div className="flex items-center justify-center gap-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-red-800/90">
                            <XCircle className="h-2.5 w-2.5" aria-hidden />
                            Reject
                        </div>
                        <p className={`font-black tabular-nums text-red-900 ${soloOnSlide ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
                            {rejectionQty}
                        </p>
                    </div>
                </div>

                <div className={`rounded-lg border px-2 py-1.5 ring-1 text-left ${reasonRowClass}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {category ? (
                            <span
                                className={`inline-flex px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide ring-1 ${
                                    M4_BADGE_CLASS[category] || 'bg-gray-100 text-gray-700 ring-gray-200'
                                }`}
                            >
                                {category}
                            </span>
                        ) : (
                            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-slate-500">Reason</span>
                        )}
                        <span className={`text-[10px] sm:text-[11px] font-bold leading-snug line-clamp-2 ${reasonTextClass}`}>
                            {reasonLabel}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [currentDate, setCurrentDate] = useState('');
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [retryAttempts, setRetryAttempts] = useState(0);
    const [partialWarning, setPartialWarning] = useState<string | null>(null);
    const [pinnedWorkCentreId, setPinnedWorkCentreId] = useState<number | null>(null);
    const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<Date | null>(null);
    const staleReloadTimerRef = React.useRef<number | null>(null);
    const [showStatusBar, setShowStatusBar] = useState(false);
    const [detailCarouselIndex, setDetailCarouselIndex] = useState(0);
    const [detailCarouselProgress, setDetailCarouselProgress] = useState(0);
    const [insightCarouselIndex, setInsightCarouselIndex] = useState(0);
    const [insightCarouselProgress, setInsightCarouselProgress] = useState(0);
    const [machinePaceRows, setMachinePaceRows] = useState<any[]>([]);
    const [allLinesMachinePace, setAllLinesMachinePace] = useState<Record<number, { name: string; rows: any[] }>>({});

    const DETAIL_CAROUSEL_FIXED_SLIDES = 2; // Line table + Hourly chart
    const DETAIL_CAROUSEL_LABELS = useMemo(() => {
        const labels = ['Line table', 'Hourly chart'];
        workCentres.forEach((wc: any) => labels.push(wc.name));
        return labels;
    }, [workCentres]);
    const DETAIL_CAROUSEL_SLIDES = DETAIL_CAROUSEL_LABELS.length;
    const DETAIL_CAROUSEL_MS = 60000;
    const INSIGHT_CAROUSEL_MS = 15000;

    type InsightSlideKind = string; // 'time_loss_<wcId>' | 'rework' | 'breakdown'

    const perLineTimeLosses: Record<number, { lineName: string; losses: any[] }> = dashboardData?.lowerSection?.perLineTimeLosses || {};

    const insightSlides = useMemo((): string[] => {
        const slides: string[] = [];
        // Add one time_loss slide per active line
        for (const wc of workCentres) {
            slides.push(`time_loss_${wc.id}`);
        }
        const rework = Array.isArray(dashboardData?.lowerSection?.reworkEntries)
            ? dashboardData.lowerSection.reworkEntries
            : [];
        const breakdowns = Array.isArray(dashboardData?.lowerSection?.breakdowns)
            ? dashboardData.lowerSection.breakdowns
            : [];
        if (rework.length > 0) slides.push('rework');
        if (breakdowns.length > 0) slides.push('breakdown');
        return slides;
    }, [dashboardData, workCentres]);

    const insightSlideCount = insightSlides.length;
    const breakdownList = dashboardData?.lowerSection?.breakdowns ?? [];

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
        if (!workCentres.length || !currentDate) return;
        const workCentreId = workCentres[currentIndex]?.id;
        if (!workCentreId) return;

        const loadMachinePace = async () => {
            try {
                const res = await apiFetch(
                    `${API_BASE_URL}/api/tv-dashboard/machine-centres/${workCentreId}?date=${currentDate}`
                );
                const result = await res.json();
                if (result.success) {
                    setMachinePaceRows(result.data || []);
                } else {
                    setMachinePaceRows([]);
                }
            } catch {
                setMachinePaceRows([]);
            }
        };

        const loadAllLinesMachinePace = async () => {
            const paceMap: Record<number, { name: string; rows: any[] }> = {};
            await Promise.all(
                workCentres.map(async (wc: any) => {
                    try {
                        const res = await apiFetch(
                            `${API_BASE_URL}/api/tv-dashboard/machine-centres/${wc.id}?date=${currentDate}`
                        );
                        const result = await res.json();
                        if (result.success) {
                            paceMap[wc.id] = { name: wc.name, rows: result.data || [] };
                        } else {
                            paceMap[wc.id] = { name: wc.name, rows: [] };
                        }
                    } catch {
                        paceMap[wc.id] = { name: wc.name, rows: [] };
                    }
                })
            );
            setAllLinesMachinePace(paceMap);
        };

        loadMachinePace();
        loadAllLinesMachinePace();
    }, [workCentres, currentIndex, currentDate, dashboardUpdatedAt]);

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
        setInsightCarouselIndex(0);
        setInsightCarouselProgress(0);
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

    useEffect(() => {
        setInsightCarouselIndex((prev) => Math.min(prev, Math.max(0, insightSlideCount - 1)));
    }, [insightSlideCount]);

    useEffect(() => {
        if (insightSlideCount <= 1) return;

        const rotateInterval = setInterval(() => {
            setInsightCarouselIndex((prev) => (prev + 1) % insightSlideCount);
            setInsightCarouselProgress(0);
        }, INSIGHT_CAROUSEL_MS);

        return () => clearInterval(rotateInterval);
    }, [currentIndex, insightSlideCount]);

    useEffect(() => {
        if (insightSlideCount <= 1) {
            setInsightCarouselProgress(0);
            return;
        }

        const tickMs = 100;
        const increment = (tickMs / INSIGHT_CAROUSEL_MS) * 100;
        const interval = setInterval(() => {
            setInsightCarouselProgress((prev) => Math.min(prev + increment, 100));
        }, tickMs);

        return () => clearInterval(interval);
    }, [insightCarouselIndex, currentIndex, insightSlideCount]);

    const secondsSinceLastSuccess = lastUpdatedAt ? Math.floor((currentTime.getTime() - lastUpdatedAt.getTime()) / 1000) : null;
    const isCriticalStaleNow = secondsSinceLastSuccess !== null && secondsSinceLastSuccess > 120;
    const sectionAge = (ts: Date | null) => ts ? Math.floor((currentTime.getTime() - ts.getTime()) / 1000) : null;
    const dashboardAgeSec = sectionAge(dashboardUpdatedAt);

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

    const machinePaceSnapshots = useMemo(() => {
        const now = currentTime;
        return machinePaceRows.map((row: any) =>
            buildMachinePaceSnapshot(
                String(row.machine_id),
                row.machine_name || row.machine_centre_name || String(row.machine_id),
                Number(row.total_output_pairs || 0),
                Number(row.target_mins_per_box || 0),
                now
            )
        );
    }, [machinePaceRows, currentTime]);

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
    const currentLineName =
        middleSection?.workCentreName ||
        lowerSection?.workCentreName ||
        workCentres[currentIndex]?.name ||
        'Line';
    const secondsSinceUpdate = lastUpdatedAt ? Math.floor((currentTime.getTime() - lastUpdatedAt.getTime()) / 1000) : null;
    const isStale = secondsSinceUpdate !== null && secondsSinceUpdate > 30;
    const isCriticalStale = secondsSinceUpdate !== null && secondsSinceUpdate > 120;
    const linePerformanceRows = Array.isArray(lowerSection?.linePerformance) ? lowerSection.linePerformance : [];
    const currentLinePerformance = linePerformanceRows.find(
        (line: any) => Number(line.work_centre_id) === Number(currentWorkCentreId)
    );
    const linePaceTarget = Number(currentLinePerformance?.target ?? 0);
    const linePaceOutput = Number(currentLinePerformance?.output ?? 0);
    const machineTimeLossRows = Array.isArray(lowerSection?.machineTimeLosses) ? lowerSection.machineTimeLosses : [];
    const reworkEntries = Array.isArray(lowerSection?.reworkEntries) ? lowerSection.reworkEntries : [];
    const reworkTotals = lowerSection?.reworkTotals ?? { total_rework: 0, total_rejection: 0 };
    const totalReworkQty = Number(reworkTotals.total_rework || 0);
    const totalRejectionQty = Number(reworkTotals.total_rejection || 0);
    const netMachineDeltaMins = machineTimeLossRows.reduce((sum: number, row: any) => sum + Number(row.net_mins || 0), 0);
    const netMachineDeltaLabel =
      Math.abs(netMachineDeltaMins) * 60 < 1
        ? 'neutral'
        : netMachineDeltaMins > 0
          ? 'gain'
          : 'loss';
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
        const { elapsedPct, remainingProductiveMins } = getProductiveShiftTotals(currentTime);
        return { elapsedPct, remainingMin: Math.round(remainingProductiveMins) };
    })();
    const targetGap = Math.max(0, Number(topSection.target || 0) - Number(topSection.output || 0));
    const timeLossMins = Math.max(0, Math.round(Number(topSection.lossOfMinutes || 0)));
    const reworkRejectionCount = Math.max(0, totalReworkQty + totalRejectionQty);
    const insightSlideLabels: Record<string, string> = {
        rework: 'Rework',
        breakdown: 'Breakdown',
    };
    // Add per-line time loss labels dynamically
    for (const wc of workCentres) {
        insightSlideLabels[`time_loss_${wc.id}`] = wc.name;
    }
    const insightTabStyles: Record<string, { base: string; active: string }> = {
        rework: { base: 'bg-amber-100 text-amber-900 ring-amber-300', active: 'ring-amber-500' },
        breakdown: { base: 'bg-rose-100 text-rose-900 ring-rose-300', active: 'ring-rose-500' },
    };
    // Default style for time_loss slides
    const getInsightTabStyle = (kind: string) => {
        if (insightTabStyles[kind]) return insightTabStyles[kind];
        return { base: 'bg-orange-100 text-orange-900 ring-orange-300', active: 'ring-orange-500' };
    };
    const insightTabCount = (kind: string) => {
        if (kind === 'rework') return reworkRejectionCount;
        if (kind === 'breakdown') return breakdownList.length;
        return null;
    };
    const insightGridCols = (() => {
        const len = insightSlides.length;
        if (len <= 1) return 'grid-cols-1';
        if (len === 2) return 'grid-cols-2';
        if (len === 3) return 'grid-cols-3';
        return 'grid-cols-4';
    })();
    const recoveryLabel =
        targetGap > 0
            ? `Gap: ${targetGap}`
            : `Ahead: ${Math.max(0, Number(topSection.output || 0) - Number(topSection.target || 0))}`;
    const overallInputPercent = Number(topSection.target || 0) > 0
        ? Math.round((Number(topSection.input || 0) / Number(topSection.target || 0)) * 100)
        : 0;

    const planPaceSnapshot = (() => {
        const { totalProductiveMins, elapsedProductiveMins, remainingProductiveMins, elapsedPct } =
            getProductiveShiftTotals(currentTime);
        const elapsedMins = Math.max(0, elapsedProductiveMins);
        const remainingMins = Math.round(remainingProductiveMins);

        const daily = Number(topSection.target || 0);
        const actual = Number(topSection.output || 0);
        if (daily <= 0) return null;

        const expected =
            elapsedMins > 0 && totalProductiveMins > 0
                ? Math.round((daily * elapsedMins) / totalProductiveMins)
                : 0;
        const projectedEod =
            elapsedMins > 0 && totalProductiveMins > 0
                ? Math.round((actual / elapsedMins) * totalProductiveMins)
                : 0;
        const onTrack = projectedEod >= daily;
        const shortBy = onTrack ? 0 : daily - projectedEod;

        return {
            daily,
            actual,
            expected,
            projectedEod,
            shortBy,
            remainingMins,
            onTrack,
            elapsedPct,
            lossOfMinutes: Math.round(Number(topSection.lossOfMinutes || 0)),
            lossInactiveMins: Math.round(Number(topSection.lossInactiveMins || 0)),
            lossExtraMins: Math.round(Number(topSection.lossExtraMins || 0)),
        };
    })();

    const productiveMinsLeft = Math.round(
        getProductiveShiftTotals(currentTime).remainingProductiveMins
    );

    const currentLinePlanPace = (() => {
        if (linePaceTarget <= 0) return null;
        const { totalProductiveMins, elapsedProductiveMins } = getProductiveShiftTotals(currentTime);
        const elapsedMins = Math.max(0, elapsedProductiveMins);
        const expected =
            elapsedMins > 0 && totalProductiveMins > 0
                ? Math.round((linePaceTarget * elapsedMins) / totalProductiveMins)
                : 0;
        const projectedEod =
            elapsedMins > 0 && totalProductiveMins > 0
                ? Math.round((linePaceOutput / elapsedMins) * totalProductiveMins)
                : 0;
        return { expected, projectedEod };
    })();

    const lineRecoveryStats = (() => {
        if (linePaceTarget <= 0) return null;
        const { remainingProductiveMins, elapsedProductiveMins } = getProductiveShiftTotals(currentTime);
        const gapToTarget = Math.max(0, linePaceTarget - linePaceOutput);
        const pairsPerHrNeeded =
            remainingProductiveMins > 0 && gapToTarget > 0
                ? Math.round((gapToTarget / remainingProductiveMins) * 60 * 10) / 10
                : null;
        const currentPairsPerHr =
            elapsedProductiveMins > 0
                ? Math.round((linePaceOutput / elapsedProductiveMins) * 60 * 10) / 10
                : null;
        return { gapToTarget, pairsPerHrNeeded, currentPairsPerHr };
    })();

    const currentArticleCode = currentLinePerformance?.style_code || topSection.styleCode || null;
    const currentArticleName = currentLinePerformance?.style_name || topSection.styleName || null;
    const articlePill = currentArticleName ? (
        <span className="shrink-0 text-[10px] sm:text-xs font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-full truncate ring-2 ring-indigo-300 shadow-sm">
            {currentArticleName}
        </span>
    ) : null;

    const chartData = lowerSection.hourlyData.map((item: any) => ({
        hour: `${item.hour}:00`,
        output: item.output || 0
    }));

    return (
        <div className="h-full min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 w-full px-2 sm:px-3">
            <div key={String(currentWorkCentreId ?? currentIndex)} className="flex-shrink-0 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-xl sm:rounded-2xl shadow-xl p-2 sm:p-3 mb-2 relative overflow-hidden ring-1 ring-white/10 motion-safe:animate-tv-section-in max-sm:motion-safe:animate-none motion-reduce:animate-none">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-72 h-72 sm:w-96 sm:h-96 max-sm:w-44 max-sm:h-44 bg-white rounded-full blur-3xl opacity-[0.12] max-sm:opacity-[0.05] max-sm:blur-2xl motion-safe:animate-tv-shimmer max-sm:motion-safe:animate-none motion-reduce:opacity-10" />
                    <div className="absolute bottom-0 right-0 w-80 h-80 sm:w-[28rem] sm:h-[28rem] max-sm:w-48 max-sm:h-48 bg-indigo-300/40 rounded-full blur-3xl opacity-[0.15] max-sm:opacity-[0.06] max-sm:blur-2xl motion-safe:animate-tv-shimmer max-sm:motion-safe:animate-none motion-reduce:opacity-10" style={{ animationDelay: '2.5s' }} />
                </div>
                <div className="relative z-10 isolate">
                    <div className="flex flex-row justify-between items-center mb-1.5 sm:mb-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <h1 className="text-sm sm:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg tracking-tight truncate">{topSection.workCentreName}</h1>
                            {topSection.styleName && topSection.workCentreName !== 'Overall Performance' && (
                                <span className="text-xs sm:text-sm font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full truncate">
                                    {topSection.styleCode} — {topSection.styleName}
                                </span>
                            )}
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
                        <div className="text-right rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 ring-1 bg-slate-950/50 backdrop-blur-md ring-white/30 sm:bg-white/10 flex-shrink-0 max-w-[min(100%,42rem)]">
                            <p className="text-[9px] sm:text-sm font-medium tabular-nums whitespace-nowrap leading-tight">
                                <span className="text-sky-200 font-bold">{productiveMinsLeft}m left</span>
                                <span className="text-white/35 mx-1 sm:mx-1.5" aria-hidden>·</span>
                                <span className="text-white font-semibold">
                                    {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <span className="text-white/35 mx-1 sm:mx-1.5" aria-hidden>·</span>
                                <span className="text-blue-100">
                                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <span className="text-white/35 mx-1 sm:mx-1.5" aria-hidden>·</span>
                                <span className="text-blue-100/90 text-[8px] sm:text-xs">
                                    Last update:{' '}
                                    {lastUpdatedAt
                                        ? lastUpdatedAt.toLocaleTimeString('en-US', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              second: '2-digit',
                                          })
                                        : 'Waiting...'}
                                </span>
                            </p>
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
                            <div className="text-white text-[9px] sm:text-xs mb-0.5 font-medium truncate">Target</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">{topSection.target}</div>
                        </div>
                        {/* ── Input (line input machine, e.g. 01 Quarter Zig Zag) ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-[50ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <ArrowDownToLine className="h-4 w-4 sm:h-7 sm:w-7 text-[#67E8F9] mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white text-[9px] sm:text-xs mb-0.5 font-medium truncate">Input</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">
                                {formatInput(topSection.input)}
                            </div>
                        </div>
                        {/* ── Input % ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-75 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <ArrowDownToLine className="h-4 w-4 sm:h-7 sm:w-7 text-[#FCD34D] mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white text-[9px] sm:text-xs mb-0.5 font-medium truncate">Input %</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">
                                {overallInputPercent}%
                            </div>
                        </div>
                        {/* ── Output ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-100 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <TrendingUp className="h-4 w-4 sm:h-7 sm:w-7 text-[#4ADE80] mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white text-[9px] sm:text-xs mb-0.5 font-medium truncate">Output</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">{topSection.output}</div>
                        </div>
                        {/* ── Output % ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-150 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <Activity className="h-4 w-4 sm:h-7 sm:w-7 text-[#FDA4AF] mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white text-[9px] sm:text-xs mb-0.5 font-medium truncate">Output %</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">
                                {topSection.outputPercent}%
                            </div>
                        </div>
                        {/* ── WIP (MES formula) — replaces emoji slot, emoji moves inline ── */}
                        <div className="bg-white/25 max-sm:bg-white/40 backdrop-blur-md rounded-md sm:rounded-lg p-1.5 sm:p-3 text-center shadow-lg min-w-0 motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:delay-200 max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:opacity-100 motion-reduce:animate-none">
                            <PackageOpen className="h-4 w-4 sm:h-7 sm:w-7 text-[#FCA5A5] mx-auto mb-0.5 sm:mb-1 drop-shadow-md" />
                            <div className="text-white text-[9px] sm:text-xs mb-0.5 font-medium truncate">WIP</div>
                            <div className="text-white text-sm sm:text-2xl font-bold drop-shadow-md tabular-nums leading-none">
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

            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 overflow-hidden min-w-0">
            <div className="sm:col-span-3 min-h-0 h-full flex flex-col motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:80ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
            <div className="h-full min-h-0 flex flex-col bg-white rounded-xl shadow-lg border border-gray-100 ring-1 ring-slate-200/60 overflow-hidden">
                <div className="flex-shrink-0 border-b border-gray-100 px-3 sm:px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                    <div className="flex items-center min-w-0 flex-1 overflow-hidden gap-2">
                    {detailCarouselIndex >= 2 ? (
                        <div className="flex items-center min-w-0 flex-1 gap-2 sm:gap-4 text-sm sm:text-base font-bold leading-tight overflow-hidden">
                            <span className="text-blue-600 truncate min-w-0" title={DETAIL_CAROUSEL_LABELS[detailCarouselIndex] || currentLineName}>
                                {DETAIL_CAROUSEL_LABELS[detailCarouselIndex] || currentLineName}
                            </span>
                            <span className="h-4 w-px shrink-0 bg-slate-300" aria-hidden />
                            <TvMachinePaceLegend />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <h3
                                className="font-bold text-blue-600 truncate"
                                style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.3px' }}
                            >
                                {detailCarouselIndex === 0
                                    ? 'LINE PERFORMANCE'
                                    : detailCarouselIndex === 1
                                    ? 'All Lines - Hourly Output'
                                    : `${DETAIL_CAROUSEL_LABELS[detailCarouselIndex]} - Machines`}
                            </h3>
                        </div>
                    )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {dashboardAgeSec !== null && dashboardAgeSec > 30 && detailCarouselIndex === 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Stale</span>
                        )}
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
                                <th className="px-2 py-1.5 text-left font-bold text-gray-500">ARTICLE</th>
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
                                        <td className="px-2 py-2 truncate max-w-[100px]" title={line.style_name || ''}>
                                            {line.style_code ? (
                                                <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-sm">
                                                    {line.style_code}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-2 py-2 text-center font-bold text-blue-600 tabular-nums">{line.target}</td>
                                        {/* INPUT — live Heel Grip Machine quantity for this line */}
                                        <td className="px-2 py-2 text-center font-bold text-cyan-600 tabular-nums">
                                            {formatInput(line.input)}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${getEfficiencyBgClass(lineInputPercent)}`}>{lineInputPercent}%</span>
                                        </td>
                                        <td className="px-2 py-2 text-center font-bold text-green-600 tabular-nums">{line.output}</td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm ${getEfficiencyBgClass(Number(line.output_percentage))}`}>{line.output_percentage}%</span>
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
                                workCentreId={'all'}
                                workCentreName={'All Lines'}
                                showProgress={false}
                                progress={progress}
                                date={currentDate}
                                fitContainer
                                hideTitle
                            />
                        </div>
                        {/* Plan pace slide — hidden from carousel; Full line card on machine pace covers line-level plan */}
                        {/* <div className="min-w-full h-full flex flex-col min-h-0 overflow-hidden bg-slate-100">
                            {planPaceSnapshot ? (
                                <TvPlanPacePanel
                                    snapshot={planPaceSnapshot}
                                    lineName={currentLineName}
                                />
                            ) : (
                                <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500 text-sm sm:text-base font-medium">
                                    No production plan target set for today — add planning to show speed vs plan.
                                </div>
                            )}
                        </div> */}
                        {workCentres.map((wc: any) => {
                            const wcPace = allLinesMachinePace[wc.id];
                            const wcRows = wcPace?.rows || [];
                            const wcSnapshots = wcRows.map((row: any) =>
                                buildMachinePaceSnapshot(
                                    String(row.machine_id),
                                    row.machine_name || row.machine_centre_name || String(row.machine_id),
                                    Number(row.total_output_pairs || 0),
                                    Number(row.target_mins_per_box || 0),
                                    currentTime
                                )
                            );
                            const wcLinePerf = linePerformanceRows.find((l: any) => Number(l.work_centre_id) === Number(wc.id));
                            const wcTarget = Number(wcLinePerf?.target ?? 0);
                            const wcOutput = Number(wcLinePerf?.output ?? 0);
                            // Compute expectedNow and projectedEod for work-centre full-line card
                            let wcExpectedNow: number | undefined;
                            let wcProjectedEod: number | undefined;
                            if (wcTarget > 0) {
                                const { totalProductiveMins, elapsedProductiveMins } = getProductiveShiftTotals(currentTime);
                                const elapsedMins = Math.max(0, elapsedProductiveMins);
                                if (elapsedMins > 0 && totalProductiveMins > 0) {
                                    wcExpectedNow = Math.round((wcTarget * elapsedMins) / totalProductiveMins);
                                    wcProjectedEod = Math.round((wcOutput / elapsedMins) * totalProductiveMins);
                                }
                            }
                            return (
                                <div key={wc.id} className="min-w-full h-full flex flex-col min-h-0 overflow-hidden bg-slate-100">
                                    <TvMachinePacePanel
                                        machines={wcSnapshots}
                                        linePlan={{
                                            lineName: wc.name,
                                            dailyTarget: wcTarget,
                                            lineOutput: wcOutput,
                                            expectedNow: wcExpectedNow,
                                            projectedEod: wcProjectedEod,
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="px-3 mt-2 sm:px-4 pb-3 flex-shrink-0">
                    <div className="w-full rounded-full h-1.5 bg-gray-200 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-blue-500 transition-[width] duration-100 motion-reduce:transition-none"
                            style={{ width: `${detailCarouselProgress}%` }}
                        />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        {detailCarouselIndex >= 2 && lineRecoveryStats && lineRecoveryStats.gapToTarget > 0 && lineRecoveryStats.pairsPerHrNeeded != null ? (
                            <div className="inline-flex flex-wrap items-center gap-2 sm:gap-2.5 rounded-lg bg-gradient-to-r from-amber-100 via-amber-50 to-orange-50 px-2.5 sm:px-3 py-1.5 ring-2 ring-amber-400/80 shadow-md min-w-0">
                                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-amber-950 whitespace-nowrap">
                                    Speed to hit today’s plan (pairs/hr)
                                </span>
                                <span className="hidden sm:block h-5 w-px bg-amber-300/80 shrink-0" aria-hidden />
                                <div className="inline-flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 ring-1 ring-slate-300 shadow-sm">
                                        <span className="text-[8px] sm:text-[9px] font-bold uppercase text-slate-600">Current</span>
                                        <span className="text-xs sm:text-sm font-black tabular-nums text-slate-900">
                                            {formatPairsPerHour(lineRecoveryStats.currentPairsPerHr)}
                                        </span>
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2 py-1 ring-2 ring-amber-600 shadow-sm">
                                        <span className="text-[8px] sm:text-[9px] font-bold uppercase text-amber-50">Required</span>
                                        <span className="text-xs sm:text-sm font-black tabular-nums text-white">
                                            {formatPairsPerHour(lineRecoveryStats.pairsPerHrNeeded)}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ) : detailCarouselIndex >= 2 && linePaceTarget > 0 ? (
                            <span className="inline-flex items-center rounded-lg bg-emerald-100 px-2.5 py-1 text-[9px] sm:text-[10px] font-bold text-emerald-800 ring-2 ring-emerald-300 shadow-sm">
                                On track for today’s target
                            </span>
                        ) : (
                            <span className="text-[8px] sm:text-[9px] text-transparent select-none" aria-hidden>
                                —
                            </span>
                        )}
                        <div className="flex items-center gap-2.5 ml-auto shrink-0">
                            <div className="flex items-center gap-1.5" role="tablist" aria-label="Dashboard views">
                                {DETAIL_CAROUSEL_LABELS.map((label, i) => (
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
                            <p className="text-[9px] sm:text-[10px] text-blue-500 font-semibold tabular-nums whitespace-nowrap">
                                Auto-switch in {Math.max(0, Math.ceil((DETAIL_CAROUSEL_MS / 1000) * (1 - detailCarouselProgress / 100)))}s
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <div className="sm:col-span-1 min-h-0 h-full flex flex-col motion-safe:opacity-0 motion-safe:animate-tv-section-in motion-safe:[animation-delay:140ms] max-sm:opacity-100 max-sm:motion-safe:animate-none motion-reduce:animate-none motion-reduce:opacity-100">
                <div className="h-full min-h-0 flex flex-col rounded-xl shadow-lg p-2 sm:p-3 border border-gray-200 bg-gradient-to-b from-white to-slate-50 ring-1 ring-slate-200/60 overflow-hidden">
                    <div className="flex-shrink-0 mb-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <p className="text-[10px] sm:text-[11px] font-extrabold tracking-wide text-orange-900 truncate">
                                {insightSlideLabels[insightSlides[insightCarouselIndex]] || 'Time loss'}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[8px] sm:text-[9px] font-semibold text-orange-600 tabular-nums">
                                    {Math.max(0, Math.ceil((INSIGHT_CAROUSEL_MS / 1000) * (1 - insightCarouselProgress / 100)))}s
                                </span>
                                <div className="w-12 rounded-full h-1 bg-gray-200 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-orange-400 transition-[width] duration-100 motion-reduce:transition-none"
                                        style={{ width: `${insightCarouselProgress}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-1" role="tablist" aria-label="Insight slides">
                                    {insightSlides.map((kind, index) => (
                                        <button
                                            key={kind}
                                            type="button"
                                            role="tab"
                                            aria-selected={insightCarouselIndex === index}
                                            aria-label={insightSlideLabels[kind] || kind}
                                            onClick={() => {
                                                setInsightCarouselIndex(index);
                                                setInsightCarouselProgress(0);
                                            }}
                                            className={`h-2 rounded-full transition-all duration-300 ${
                                                insightCarouselIndex === index ? 'w-5 bg-orange-500' : 'w-2 bg-slate-300 hover:bg-slate-400'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="relative flex-1 min-h-0 w-full overflow-hidden">
                            <div
                                className="flex h-full w-full transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                                style={{ transform: `translateX(-${insightCarouselIndex * 100}%)` }}
                            >
                                {insightSlides.map((kind) => (
                                <div key={kind} className="flex-[0_0_100%] w-full h-full min-h-0 flex flex-col text-center px-1 py-0.5">
                                {kind.startsWith('time_loss_') && (() => {
                                    const wcId = Number(kind.replace('time_loss_', ''));
                                    const lineData = perLineTimeLosses[wcId];
                                    const rows = lineData?.losses || [];
                                    const lineName = lineData?.lineName || '';
                                    const netMins = rows.reduce((sum: number, row: any) => sum + Number(row.net_mins || 0), 0);
                                    return (<>
                                    {rows.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-0.5 overflow-auto pr-0.5 min-h-0 flex-1">
                                            {rows.slice(0, 8).map((row: any) => (
                                                <div
                                                    key={`${row.machine_id}-${row.machine_name}`}
                                                    className={`rounded px-1.5 py-0.5 flex items-center justify-between ${
                                                        Number(row.net_mins || 0) > 0
                                                            ? 'border border-emerald-200 bg-emerald-50/70'
                                                            : 'border border-red-200 bg-white'
                                                    }`}
                                                >
                                                    <span
                                                        className={`text-[9px] sm:text-[10px] font-bold truncate pr-1 text-left rounded px-1 py-px leading-tight ${
                                                            Number(row.net_mins || 0) > 0
                                                                ? 'text-emerald-900 bg-emerald-100 border border-emerald-300'
                                                                : 'text-slate-900 bg-amber-50/60 border border-amber-100'
                                                        }`}
                                                    >
                                                        {row.machine_name || `Machine ${row.machine_id}`}
                                                    </span>
                                                    {(() => {
                                                        const net = Number(row.net_mins || 0);
                                                        const tone =
                                                            net > 0
                                                                ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
                                                                : 'text-red-700 bg-red-50 border border-red-200';
                                                        return (
                                                            <span className={`text-[9px] sm:text-[10px] font-black tabular-nums shrink-0 px-1 py-px rounded leading-tight ${tone}`}>
                                                                {formatDurationString(net)}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            ))}
                                            <div className="rounded border border-red-300 bg-gradient-to-r from-red-50 to-red-100 px-1.5 py-0.5 flex items-center justify-between">
                                                <span className="text-[9px] sm:text-[10px] font-extrabold text-red-900 uppercase tracking-wide leading-tight">Total</span>
                                                <span
                                                    className={`text-[9px] sm:text-[10px] font-black tabular-nums bg-white/80 px-1 py-px rounded leading-tight ${
                                                        netMins > 0 ? 'text-emerald-800' : netMins < 0 ? 'text-red-800' : 'text-gray-700'
                                                    }`}
                                                >
                                                    {formatDurationString(netMins)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center">
                                            <p className="text-[9px] sm:text-[10px] text-gray-400">No time loss data for {lineName}</p>
                                        </div>
                                    )}
                                </>);
                                })()}

                                {kind === 'rework' && (
                                    <div className="h-full min-h-0 flex flex-col overflow-hidden">
                                        <div className="mb-2 shrink-0 rounded-lg bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 px-2.5 py-1.5 text-white shadow-sm">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap text-center">
                                                <p className="text-[11px] sm:text-xs font-extrabold tracking-wide">{currentLineName}</p>
                                                <span className="text-[10px] text-white/50">|</span>
                                                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-50">Rework / Rejection</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-auto pr-0.5">
                                            {reworkEntries.slice(0, 6).map((row: any, index: number) =>
                                                renderReworkCard(row, index, reworkEntries.length === 1)
                                            )}
                                        </div>
                                        <div className="shrink-0 mt-1.5 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-100 via-amber-50 to-orange-100 px-2.5 py-2 shadow-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-950 uppercase tracking-wide">Line total</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-yellow-200/90 px-2 py-0.5 text-[10px] sm:text-[11px] font-black tabular-nums text-yellow-950 ring-1 ring-yellow-300">
                                                        <RotateCcw className="h-3 w-3" aria-hidden />
                                                        {totalReworkQty}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-red-200/90 px-2 py-0.5 text-[10px] sm:text-[11px] font-black tabular-nums text-red-950 ring-1 ring-red-300">
                                                        <XCircle className="h-3 w-3" aria-hidden />
                                                        {totalRejectionQty}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {kind === 'breakdown' && (
                                        <div className="h-full min-h-0 flex flex-col gap-1.5 overflow-auto px-0.5">
                                            {breakdownList.slice(0, 4).map((item: any, index: number) =>
                                                renderStoppageCard(item, 'breakdown', index, breakdownList.length === 1, breakdownList.length > 1)
                                            )}
                                        </div>
                                )}
                                </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};
