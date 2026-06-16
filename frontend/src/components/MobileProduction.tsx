import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, Play, CheckCircle, Loader2, X, RefreshCw, RotateCcw, AlertTriangle, Bell, BellOff, Hand } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { classifyLateCycleCategory, computeCycleNetLostMins } from '../utils/cycleLostMins';
import { computeShiftTargetPairs, getProductiveShiftTotals, isWithinShiftHours } from '../utils/shiftPaceUtils';
import { LateCyclesTodayModal } from './LateCyclesTodayModal';
import { StoppageReasonModal } from './StoppageReasonModal';

const formatPairsPerHour = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '—';
    const rounded = Math.round(value * 10) / 10;
    const num = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${num}/hr`;
};

interface ProductionData {
    id?: number;
    prod_date: string;
    work_centre_id: number;
    work_centre_name?: string;
    machine_id: string;
    emp_id: number;
    output_pairs: number;
    target_mins: any;
    target_pairs: any;
    start_time: string | null;
    finish_time: string | null;
    idle_start_time: string | null;
    idle_stop_time: string | null;
    actual_time: number;
    button_status: number; // 1=Running, 2=Finished, 3=Paused
    updated_at?: string;
    is_paused?: boolean;
}

const normalizePauseState = <T extends ProductionData>(record: T): T => {
    // Pause state is deprecated: treat any in-progress paused record as running.
    if (record.button_status === 3 && record.start_time) {
        return {
            ...record,
            button_status: 1,
            is_paused: false,
        };
    }
    return record;
};

const FRIDAY_INDEX = 5; // Sunday=0 ... Friday=5
/** Mon–Thu, Sat (and Sun): lunch 1:30 PM – 2:00 PM */
const DEFAULT_LUNCH_START_MINUTES = 13 * 60 + 30; // 1:30 PM
const DEFAULT_LUNCH_END_MINUTES = 14 * 60; // 2:00 PM
/** Friday only: lunch 12:30 PM – 1:00 PM */
const FRIDAY_LUNCH_START_MINUTES = 12 * 60 + 30; // 12:30 PM
const FRIDAY_LUNCH_END_MINUTES = 13 * 60; // 1:00 PM

/** Default pairs per BIN when no session preference (matches historical mobile default). */
const MOBILE_PAIRS_PER_BIN = 6;

type IdleReminderConfig = {
    idle_interval_secs: number;
    idle_interval_mins: number;
    idle_interval_secs_part: number;
    alarm_duration_secs: number;
    finish_grace_mins: number;
};

const DEFAULT_IDLE_REMINDER: IdleReminderConfig = {
    idle_interval_secs: 40,
    idle_interval_mins: 0,
    idle_interval_secs_part: 40,
    alarm_duration_secs: 12,
    finish_grace_mins: 0,
};

const normalizeIdleReminderConfig = (raw?: Partial<IdleReminderConfig> | null): IdleReminderConfig => {
    let totalSecs = Number(raw?.idle_interval_secs);
    if (!Number.isFinite(totalSecs) || totalSecs < 15) {
        const mins = Number(raw?.idle_interval_mins);
        const part = Number(raw?.idle_interval_secs_part);
        if (Number.isFinite(mins) || Number.isFinite(part)) {
            totalSecs = (Number.isFinite(mins) ? Math.max(0, mins) : 0) * 60
                + (Number.isFinite(part) ? Math.max(0, part) : 0);
        } else {
            totalSecs = DEFAULT_IDLE_REMINDER.idle_interval_secs;
        }
    }
    totalSecs = Math.min(7200, Math.max(15, Math.round(totalSecs)));
    return {
        idle_interval_secs: totalSecs,
        idle_interval_mins: Math.floor(totalSecs / 60),
        idle_interval_secs_part: totalSecs % 60,
        alarm_duration_secs: Math.min(60, Math.max(3, Number(raw?.alarm_duration_secs) || DEFAULT_IDLE_REMINDER.alarm_duration_secs)),
        finish_grace_mins: Math.min(60, Math.max(0, Number(raw?.finish_grace_mins) || DEFAULT_IDLE_REMINDER.finish_grace_mins)),
    };
};

const formatIdleIntervalLabel = (cfg: IdleReminderConfig) => {
    if (cfg.idle_interval_secs < 60) return `${cfg.idle_interval_secs} seconds`;
    if (cfg.idle_interval_secs_part === 0) return `${cfg.idle_interval_mins} minutes`;
    return `${cfg.idle_interval_mins} min ${cfg.idle_interval_secs_part} sec`;
};
/** Allowed target pairs per cycle; must match server finish clamp (1–12). */
const MOBILE_TARGET_PAIR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function clampMobileTargetPairs(value: unknown): number {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return MOBILE_PAIRS_PER_BIN;
    return Math.min(12, Math.max(1, n));
}

const getMinutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

const isLunchBreakTime = (d: Date) => {
    const minutes = getMinutesOfDay(d);
    if (d.getDay() === FRIDAY_INDEX) {
        return minutes >= FRIDAY_LUNCH_START_MINUTES && minutes < FRIDAY_LUNCH_END_MINUTES;
    }
    return minutes >= DEFAULT_LUNCH_START_MINUTES && minutes < DEFAULT_LUNCH_END_MINUTES;
};

const getIdleMsExcludingLunch = (anchorMs: number, nowMs: number) => {
    if (!Number.isFinite(anchorMs) || !Number.isFinite(nowMs) || nowMs <= anchorMs) return 0;
    const anchor = new Date(anchorMs);
    const now = new Date(nowMs);
    const elapsed = nowMs - anchorMs;

    if (
        anchor.getFullYear() === now.getFullYear() &&
        anchor.getMonth() === now.getMonth() &&
        anchor.getDate() === now.getDate()
    ) {
        const lunchStartMinutes = anchor.getDay() === FRIDAY_INDEX
            ? FRIDAY_LUNCH_START_MINUTES
            : DEFAULT_LUNCH_START_MINUTES;
        const lunchEndMinutes = anchor.getDay() === FRIDAY_INDEX
            ? FRIDAY_LUNCH_END_MINUTES
            : DEFAULT_LUNCH_END_MINUTES;
        const lunchStart = new Date(anchor);
        lunchStart.setHours(Math.floor(lunchStartMinutes / 60), lunchStartMinutes % 60, 0, 0);
        const lunchEnd = new Date(anchor);
        lunchEnd.setHours(Math.floor(lunchEndMinutes / 60), lunchEndMinutes % 60, 0, 0);
        const overlapStart = Math.max(anchorMs, lunchStart.getTime());
        const overlapEnd = Math.min(nowMs, lunchEnd.getTime());
        const overlap = Math.max(0, overlapEnd - overlapStart);
        return Math.max(0, elapsed - overlap);
    }
    return elapsed;
};

// Tries each candidate URL in order, shows first one that loads
const QRImageWithFallback: React.FC<{ candidates: string[]; machineId: string }> = ({ candidates, machineId }) => {
    const [idx, setIdx] = React.useState(0);
    if (idx >= candidates.length) {
        return <p className="text-gray-400 text-sm">No QR image found for machine {machineId}</p>;
    }
    return (
        <img
            src={candidates[idx]}
            alt={`QR Code Machine ${machineId}`}
            className="mx-auto max-w-xs rounded-lg"
            onError={() => setIdx(i => i + 1)}
        />
    );
};

// Shows QR and polls for active session
const QRWaitScreen: React.FC<{
    machineId: string;
    urlMachineId: string;
    qrCandidates: string[];
    onSessionActive: (empCode: string, sessionId?: string) => void;
}> = ({ machineId, urlMachineId, qrCandidates, onSessionActive }) => {
    const [machineName, setMachineName] = React.useState<string>('');

    React.useEffect(() => {
        const fetchMachineName = async () => {
            try {
                const res = await apiFetch(`${API_BASE}/api/masters/machine_centres`);
                const json = await res.json();
                if (json.success && json.data) {
                    const record = json.data.find((m: any) => m.machine_id === machineId);
                    if (record) setMachineName(record.machine_name || record.name || '');
                }
            } catch (error) {
                console.warn('Failed to fetch machine name for QR wait screen:', error);
            }
        };
        fetchMachineName();
    }, [machineId]);

    React.useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const ts = Date.now();
                const res = await apiFetch(`${API_BASE}/api/mobile-session/active-for/${machineId}?_=${ts}`, {
                    cache: 'no-store'
                });
                const json = await res.json();
                if (json.success && json.data?.emp_code) {
                    clearInterval(interval);
                    onSessionActive(json.data.emp_code, json.data.session_id);
                }
            } catch (error) {
                console.warn('Session polling failed while waiting for employee scan:', error);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [machineId, onSessionActive]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-md p-6 text-center max-w-sm w-full">
                <h1 className="text-xl font-bold text-gray-900 mb-1">Machine {machineId}</h1>
                {machineName && (
                    <p className="text-base font-semibold text-blue-600 mb-1">{machineName}</p>
                )}
                <p className="text-sm text-gray-500 mb-4">Scan QR code to start production</p>
                <QRImageWithFallback candidates={qrCandidates} machineId={machineId} />
                <p className="text-xs text-gray-400 mt-4 animate-pulse">Waiting for employee scan...</p>
            </div>
        </div>
    );
};

export const MobileProduction: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Session State
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active'>('waiting');

    // Production State
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [productionData, setProductionData] = useState<ProductionData | null>(null);
    const [qrData, setQrData] = useState('');
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [actualTimeCounter, setActualTimeCounter] = useState(0);
    const actualTimeCounterRef = React.useRef(0);
    const runningSinceMsRef = React.useRef<number | null>(null);
    const [employeeName, setEmployeeName] = useState('');
    const [machineName, setMachineName] = useState('');
    const [headerExpanded, setHeaderExpanded] = useState(false);
    const isInitializingRef = React.useRef(false);
    const isCreatingRecordRef = React.useRef(false); // Prevent duplicate record creation on double-click
    const [totalOutputToday, setTotalOutputToday] = useState(0);
    const [avgEfficiencyToday, setAvgEfficiencyToday] = useState('0');
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [dailyTargetPairs, setDailyTargetPairs] = useState<number | null>(null);
    /** Routing mins/pairs per bin (6-pr baseline) used for shift day target — not scaled by operator dropdown. */
    const [routingMinsPerBin, setRoutingMinsPerBin] = React.useState(0);
    const [routingPairsPerBin, setRoutingPairsPerBin] = React.useState(MOBILE_PAIRS_PER_BIN);
    const [showStoppageModal, setShowStoppageModal] = useState(false);
    const [idleReminderEnabled, setIdleReminderEnabled] = useState(true);
    const [idleReminderConfig, setIdleReminderConfig] = useState<IdleReminderConfig>(DEFAULT_IDLE_REMINDER);
    const idleReminderConfigRef = React.useRef<IdleReminderConfig>(DEFAULT_IDLE_REMINDER);
    const applyIdleReminderConfig = React.useCallback((raw?: Partial<IdleReminderConfig> | null) => {
        const next = normalizeIdleReminderConfig(raw);
        const prevSecs = idleReminderConfigRef.current.idle_interval_secs;
        idleReminderConfigRef.current = next;
        setIdleReminderConfig(next);
        if (next.idle_interval_secs !== prevSecs) {
            lastStartReminderBucketRef.current = 0;
        }
    }, []);
    const [startReminderDue, setStartReminderDue] = useState(false);
    const overTargetToastShownRef = React.useRef(false);
    const pendingOverTargetAlarmRef = React.useRef(false);
    const pendingStartReminderAlarmRef = React.useRef(false);
    const lastStartReminderBucketRef = React.useRef(0);
    const hasUserInteractedRef = React.useRef(false);
    const alertAudioContextRef = React.useRef<AudioContext | null>(null);
    const alertSoundTimeoutsRef = React.useRef<number[]>([]);
    const activeAlertModeRef = React.useRef<'start' | 'finish' | null>(null);
    const startReminderAnchorRef = React.useRef<number | null>(null);
    const lastFinishedCycleMsRef = React.useRef<number | null>(null);
    const previousButtonStatusRef = React.useRef<number | null>(null);
    const [machineBusyRecord, setMachineBusyRecord] = useState<{ emp_id: string | number; employee_name?: string; machine_id: string } | null>(null);
    const [isSessionAuthorizedController, setIsSessionAuthorizedController] = useState(false);
    const [hasTabSessionBinding, setHasTabSessionBinding] = useState(false);
    const [showTimingPopup, setShowTimingPopup] = useState(false);
    const [timingCycles, setTimingCycles] = useState<Array<{ id: number; cycle: number; start_time: string; finish_time: string | null; target_mins: number; actual_mins: number; start_gap_mins: number; extra_mins: number; early_mins: number; lost_mins: number; output_pairs?: number }>>([]);
    const [timingLoading, setTimingLoading] = useState(false);
    const [timingTotalCycles, setTimingTotalCycles] = useState(0);
    const [selectedTargetPairs, setSelectedTargetPairs] = useState(MOBILE_PAIRS_PER_BIN);
    const baseTargetMinsRef = React.useRef(0);
    /** Routing mins column is per bin (6 pairs after mins_6_prs_box migration). */
    const baseTargetPairsRef = React.useRef(MOBILE_PAIRS_PER_BIN);
    
    // Pull-to-refresh state
    const [pullRefreshing, setPullRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = React.useRef(0);
    const touchStartX = React.useRef(0);
    const isPulling = React.useRef(false);

    const formatOperatorDisplay = (name?: string, code?: string | number) => {
        const safeName = (name || '').toString().trim();
        const safeCode = (code ?? '').toString().trim();
        if (safeName && safeCode) return `${safeName} (${safeCode})`;
        if (safeName) return safeName;
        if (safeCode) return safeCode;
        return 'N/A';
    };

    const getScaledTargetMins = React.useCallback((pairs: number) => {
        const baseMins = Number(baseTargetMinsRef.current || 0);
        const basePairs = Number(baseTargetPairsRef.current || MOBILE_PAIRS_PER_BIN);
        if (baseMins <= 0 || basePairs <= 0) return 0;
        return Number(((baseMins * pairs) / basePairs).toFixed(1));
    }, []);

    // Parse URL params at component level for rendering access
    const pathParts = location.pathname.split('/');
    const queryParams = new URLSearchParams(location.search);
    let urlMachineId = pathParts.length >= 4 && pathParts[1] === 'mobile' ? decodeURIComponent(pathParts[2]) : null;
    let urlEmpId = pathParts.length >= 4 && pathParts[1] === 'mobile' ? decodeURIComponent(pathParts[3]) : null;
    
    // Handle /mobile/MAC-001 case (machine only, no employee)
    if (pathParts.length === 3 && pathParts[1] === 'mobile' && !pathParts[2].startsWith('line')) {
        urlMachineId = decodeURIComponent(pathParts[2]);
        urlEmpId = null;
    }
    
    if (!urlMachineId) urlMachineId = queryParams.get('machine');
    if (!urlEmpId) urlEmpId = queryParams.get('employee');
    const sessionToken = queryParams.get('session');

    // Map URL slugs to actual machine_ids stored in DB
    // Format: { urlSlug: actualMachineId }
    const slugToMachineId: Record<string, string> = {
        'stitching-01': '01',
    };
    const resolvedMachineId = urlMachineId && slugToMachineId[urlMachineId]
        ? slugToMachineId[urlMachineId]
        : urlMachineId;
    const effectiveMachineId = resolvedMachineId || urlMachineId || '';

    const fetchIdleReminderSettings = React.useCallback(async (machineId?: string) => {
        const mid = machineId || effectiveMachineId;
        if (!mid) return;
        try {
            const res = await apiFetch(
                `${API_BASE}/api/idle-reminder-settings/machine/${encodeURIComponent(mid)}?_=${Date.now()}`,
                { cache: 'no-store' }
            );
            const json = await res.json();
            if (json.success && json.data) {
                applyIdleReminderConfig(json.data);
            }
        } catch (error) {
            console.warn('Failed to load idle reminder settings:', error);
        }
    }, [effectiveMachineId, applyIdleReminderConfig]);

    useEffect(() => {
        if (!effectiveMachineId || sessionStatus !== 'active') return;
        void fetchIdleReminderSettings(effectiveMachineId);
    }, [effectiveMachineId, sessionStatus, fetchIdleReminderSettings]);

    useEffect(() => {
        const refreshSettings = () => {
            if (document.visibilityState === 'visible' && effectiveMachineId) {
                void fetchIdleReminderSettings(effectiveMachineId);
            }
        };
        document.addEventListener('visibilitychange', refreshSettings);
        window.addEventListener('focus', refreshSettings);
        return () => {
            document.removeEventListener('visibilitychange', refreshSettings);
            window.removeEventListener('focus', refreshSettings);
        };
    }, [effectiveMachineId, fetchIdleReminderSettings]);

    const targetPairsSessionKey = React.useMemo(() => {
        if (!effectiveMachineId || !urlEmpId) return null;
        return `mobile_target_pairs_${effectiveMachineId}_${urlEmpId}`;
    }, [effectiveMachineId, urlEmpId]);

    const writeSessionTargetPairs = React.useCallback(
        (pairs: number) => {
            if (!targetPairsSessionKey || typeof sessionStorage === 'undefined') return;
            sessionStorage.setItem(targetPairsSessionKey, String(clampMobileTargetPairs(pairs)));
        },
        [targetPairsSessionKey]
    );

    const initializeTargetPairBaseline = React.useCallback(
        (
            refreshedBaseMins: number,
            _planningTrayPairs: number,
            opts?: {
                resumeRecordTargetMins?: number | null;
                resumeRecordTargetPairs?: number | null;
                pairsPerRoutingBin?: number;
            }
        ): { scaledTargetMins: number; targetPairs: number } => {
            const safeBase = Number(refreshedBaseMins || 0);
            const routingBin =
                opts?.pairsPerRoutingBin != null && opts.pairsPerRoutingBin > 0
                    ? opts.pairsPerRoutingBin
                    : MOBILE_PAIRS_PER_BIN;
            baseTargetPairsRef.current = routingBin;
            baseTargetMinsRef.current = safeBase > 0 ? safeBase : 0;
            if (safeBase > 0) {
                setRoutingMinsPerBin(safeBase);
                setRoutingPairsPerBin(routingBin);
            }

            let next = MOBILE_PAIRS_PER_BIN;
            const resumePairsRaw = opts?.resumeRecordTargetPairs;
            const resumePairs =
                resumePairsRaw != null && Number.isFinite(Number(resumePairsRaw)) && Number(resumePairsRaw) > 0
                    ? clampMobileTargetPairs(resumePairsRaw)
                    : null;
            const resumeTm = opts?.resumeRecordTargetMins;
            if (resumePairs != null) {
                let pairs = resumePairs;
                // target_pairs = 12 in the DB is the planning/routing baseline, NOT an operator choice.
                // Always treat it as the default (6) unless sessionStorage has a confirmed operator selection.
                if (pairs === 12) {
                    const sessionStored = targetPairsSessionKey && typeof sessionStorage !== 'undefined'
                        ? sessionStorage.getItem(targetPairsSessionKey)
                        : null;
                    pairs = sessionStored != null && sessionStored !== ''
                        ? clampMobileTargetPairs(Number(sessionStored))
                        : MOBILE_PAIRS_PER_BIN;
                }
                next = pairs;
            } else if (targetPairsSessionKey && typeof sessionStorage !== 'undefined') {
                const raw = sessionStorage.getItem(targetPairsSessionKey);
                if (raw != null && raw !== '') {
                    next = clampMobileTargetPairs(Number(raw));
                }
            }

            setSelectedTargetPairs(next);
            writeSessionTargetPairs(next);
            return { scaledTargetMins: getScaledTargetMins(next), targetPairs: next };
        },
        [getScaledTargetMins, targetPairsSessionKey, writeSessionTargetPairs]
    );

    const handleTargetPairsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!productionData) return;
        const next = clampMobileTargetPairs(Number(e.target.value));
        setSelectedTargetPairs(next);
        writeSessionTargetPairs(next);
        const scaled = getScaledTargetMins(next);
        // Local + session only while this screen is open; START/FINISH send the chosen pairs to the API.
        setProductionData({ ...productionData, target_mins: scaled, target_pairs: next });
    };

    const dailyPaceSnapshot = React.useMemo(() => {
        const now = currentTime;
        const { totalProductiveMins, elapsedProductiveMins, remainingProductiveMins } =
            getProductiveShiftTotals(now);
        if (totalProductiveMins <= 0) return null;

        const minsPerBin = routingMinsPerBin > 0 ? routingMinsPerBin : Number(productionData?.target_mins || 0);
        const pairsPerBin =
            routingPairsPerBin > 0 ? routingPairsPerBin : MOBILE_PAIRS_PER_BIN;

        let daily = computeShiftTargetPairs(minsPerBin, pairsPerBin, totalProductiveMins);
        if (daily <= 0 && dailyTargetPairs != null && dailyTargetPairs > 0) {
            daily = dailyTargetPairs;
        }
        if (daily <= 0) return null;

        const elapsedMins = Math.max(0, elapsedProductiveMins);
        const expected =
            elapsedMins > 0 ? Math.round((daily * elapsedMins) / totalProductiveMins) : 0;
        const actual = totalOutputToday;
        const gap = actual - expected;
        const projectedEod =
            elapsedMins > 0 ? Math.round((actual / elapsedMins) * totalProductiveMins) : 0;
        const gapToTarget = Math.max(0, daily - actual);
        const currentPairsPerHr =
            elapsedMins > 0 ? Math.round((actual / elapsedMins) * 60 * 10) / 10 : 0;
        const pairsPerHrNeeded =
            remainingProductiveMins > 0 && gapToTarget > 0
                ? Math.round((gapToTarget / remainingProductiveMins) * 60 * 10) / 10
                : 0;
        return {
            expected,
            daily,
            gap,
            projectedEod,
            remainingMins: Math.round(remainingProductiveMins),
            totalProductiveMins: Math.round(totalProductiveMins),
            gapToTarget,
            currentPairsPerHr,
            pairsPerHrNeeded,
        };
    }, [
        currentTime,
        dailyTargetPairs,
        totalOutputToday,
        routingMinsPerBin,
        routingPairsPerBin,
        productionData?.target_mins,
    ]);

    const outputExpectedNow = dailyPaceSnapshot?.expected ?? 0;
    // Physical box count is always 6 pairs/box; cycle dropdown (1–12) is for target time / finish qty only.
    const binsCompletedToday = Math.floor(totalOutputToday / MOBILE_PAIRS_PER_BIN);
    const boxesExpectedNow = Math.floor(outputExpectedNow / MOBILE_PAIRS_PER_BIN);
    const formatBoxesDisplay = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    const outputPaceEfficiencyPct =
        outputExpectedNow > 0 ? Math.round((totalOutputToday / outputExpectedNow) * 100) : 0;

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Timer logic - increment actual_time counter every second when running
    useEffect(() => {
        actualTimeCounterRef.current = actualTimeCounter;
    }, [actualTimeCounter]);

    const recomputeActualTimeCounter = React.useCallback(() => {
        if (!productionData) return;

        const savedSeconds = Math.max(0, Math.floor(Number(productionData.actual_time || 0) * 60));
        const isRunning = productionData.button_status === 1 && !productionData.is_paused;

        if (isRunning) {
            let startMs = runningSinceMsRef.current;
            if (productionData.start_time) {
                const parsed = new Date(productionData.start_time).getTime();
                if (!Number.isNaN(parsed)) startMs = parsed;
            }
            if (startMs) {
                const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
                const next = Math.max(savedSeconds, elapsedSeconds);
                setActualTimeCounter((prev) => (prev === next ? prev : next));
                return;
            }
        }

        // Keep displayed time monotonic if DB minutes are behind local seconds.
        setActualTimeCounter((prev) => {
            const next = Math.max(savedSeconds, prev);
            return prev === next ? prev : next;
        });
    }, [
        productionData?.id,
        productionData?.actual_time,
        productionData?.button_status,
        productionData?.is_paused,
        productionData?.start_time,
    ]);

    useEffect(() => {
        recomputeActualTimeCounter();
        if (!productionData || productionData.button_status !== 1 || productionData.is_paused) return;

        const counterInterval = window.setInterval(recomputeActualTimeCounter, 1000);
        return () => window.clearInterval(counterInterval);
    }, [
        productionData?.id,
        productionData?.button_status,
        productionData?.is_paused,
        recomputeActualTimeCounter,
    ]);

    // Browser timers are throttled while tab is locked/backgrounded.
    // Recalculate immediately on resume so Actual Time catches up without manual refresh.
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState !== 'hidden') {
                recomputeActualTimeCounter();
            }
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        window.addEventListener('focus', refresh);
        window.addEventListener('pageshow', refresh);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('focus', refresh);
            window.removeEventListener('pageshow', refresh);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [recomputeActualTimeCounter]);

    // One-time toast when target time is first exceeded (red progress bar) — reminds operator to tap FINISH
    const stopAlertSound = React.useCallback((onlyMode?: 'start' | 'finish') => {
        if (onlyMode && activeAlertModeRef.current !== onlyMode) return;
        activeAlertModeRef.current = null;
        if (alertSoundTimeoutsRef.current.length > 0) {
            alertSoundTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
            alertSoundTimeoutsRef.current = [];
        }
        if (alertAudioContextRef.current) {
            alertAudioContextRef.current.close().catch(() => {});
            alertAudioContextRef.current = null;
        }
    }, []);

    const playAlarmReminderBackground = React.useCallback((durationMs = 12000) => {
        try {
            if (!hasUserInteractedRef.current) return;
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;

            const audioCtx = new AudioCtx();
            alertAudioContextRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }

            const tone1 = audioCtx.createOscillator();
            const tone2 = audioCtx.createOscillator();
            const tone3 = audioCtx.createOscillator();
            const tone1Gain = audioCtx.createGain();
            const tone2Gain = audioCtx.createGain();
            const tone3Gain = audioCtx.createGain();
            const masterGain = audioCtx.createGain();

            tone1.type = 'square';
            tone2.type = 'square';
            tone3.type = 'triangle';
            tone1.frequency.setValueAtTime(880, audioCtx.currentTime);
            tone2.frequency.setValueAtTime(1175, audioCtx.currentTime);
            tone3.frequency.setValueAtTime(1760, audioCtx.currentTime);

            // Maxed output profile (will clip by design for highest perceived loudness).
            tone1Gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
            tone2Gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
            tone3Gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
            masterGain.gain.setValueAtTime(1.6, audioCtx.currentTime);

            tone1.connect(tone1Gain);
            tone2.connect(tone2Gain);
            tone3.connect(tone3Gain);
            tone1Gain.connect(masterGain);
            tone2Gain.connect(masterGain);
            tone3Gain.connect(masterGain);
            masterGain.connect(audioCtx.destination);

            tone1.start();
            tone2.start();
            tone3.start();

            const pulseRing = () => {
                const now = audioCtx.currentTime;
                const pulseOn = 0.22;
                const sequenceGap = 0.35;
                const pairGap = 0.95;
                const steps = [0, sequenceGap, pairGap, pairGap + sequenceGap];

                steps.forEach((offset) => {
                    const start = now + offset;
                    const end = start + pulseOn;
                    tone1Gain.gain.cancelScheduledValues(start);
                    tone2Gain.gain.cancelScheduledValues(start);
                    tone3Gain.gain.cancelScheduledValues(start);
                    tone1Gain.gain.setValueAtTime(0.0001, start);
                    tone2Gain.gain.setValueAtTime(0.0001, start);
                    tone3Gain.gain.setValueAtTime(0.0001, start);
                    tone1Gain.gain.exponentialRampToValueAtTime(1.55, start + 0.012);
                    tone2Gain.gain.exponentialRampToValueAtTime(1.45, start + 0.012);
                    tone3Gain.gain.exponentialRampToValueAtTime(1.2, start + 0.012);
                    tone1Gain.gain.exponentialRampToValueAtTime(0.0001, end);
                    tone2Gain.gain.exponentialRampToValueAtTime(0.0001, end);
                    tone3Gain.gain.exponentialRampToValueAtTime(0.0001, end);
                });
            };

            pulseRing();
            const repeatId = window.setInterval(pulseRing, 2300);
            alertSoundTimeoutsRef.current.push(repeatId);

            const stopAlarmId = window.setTimeout(() => {
                window.clearInterval(repeatId);
                const stopAt = audioCtx.currentTime + 0.08;
                tone1Gain.gain.cancelScheduledValues(audioCtx.currentTime);
                tone2Gain.gain.cancelScheduledValues(audioCtx.currentTime);
                tone3Gain.gain.cancelScheduledValues(audioCtx.currentTime);
                tone1Gain.gain.setValueAtTime(Math.max(tone1Gain.gain.value, 0.0001), audioCtx.currentTime);
                tone2Gain.gain.setValueAtTime(Math.max(tone2Gain.gain.value, 0.0001), audioCtx.currentTime);
                tone3Gain.gain.setValueAtTime(Math.max(tone3Gain.gain.value, 0.0001), audioCtx.currentTime);
                tone1Gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
                tone2Gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
                tone3Gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
                tone1.stop(stopAt + 0.02);
                tone2.stop(stopAt + 0.02);
                tone3.stop(stopAt + 0.02);
            }, durationMs);
            alertSoundTimeoutsRef.current.push(stopAlarmId);

            const closeId = window.setTimeout(() => {
                if (alertAudioContextRef.current === audioCtx) {
                    audioCtx.close().catch(() => {});
                    alertAudioContextRef.current = null;
                    activeAlertModeRef.current = null;
                }
            }, durationMs + 300);
            alertSoundTimeoutsRef.current.push(closeId);
        } catch {
            // Ignore playback failures (autoplay/device restrictions)
        }
    }, []);

    const playAlertSound = React.useCallback((mode: 'start' | 'finish') => {
        try {
            stopAlertSound();
            activeAlertModeRef.current = mode;
            const ALARM_DURATION_MS = idleReminderConfigRef.current.alarm_duration_secs * 1000;
            playAlarmReminderBackground(ALARM_DURATION_MS);
        } catch (error) {
            activeAlertModeRef.current = null;
            console.warn('Alert sound playback blocked or unavailable:', error);
        }
    }, [playAlarmReminderBackground, stopAlertSound]);

    useEffect(() => {
        return () => stopAlertSound();
    }, [stopAlertSound]);

    // Unlock alert sound after first user gesture (browser autoplay policies).
    useEffect(() => {
        const unlockAudio = () => {
            hasUserInteractedRef.current = true;
            if (pendingOverTargetAlarmRef.current && !overTargetToastShownRef.current && productionData) {
                const targetMins = Number(productionData.target_mins || 0);
                const exceeded =
                    productionData.button_status === 1 &&
                    !productionData.is_paused &&
                    targetMins > 0 &&
                    actualTimeCounter / 60 > targetMins &&
                    isWithinShiftHours(new Date());
                if (!exceeded) {
                    pendingOverTargetAlarmRef.current = false;
                } else {
                    overTargetToastShownRef.current = true;
                    pendingOverTargetAlarmRef.current = false;
                    playAlertSound('finish');
                }
            }

            if (pendingStartReminderAlarmRef.current && productionData && idleReminderEnabled) {
                const isRunning = productionData.button_status === 1 && !productionData.is_paused;
                if (isRunning) {
                    pendingStartReminderAlarmRef.current = false;
                    return;
                }
                pendingStartReminderAlarmRef.current = false;
                playAlertSound('start');
                toast.dismiss('mobile-start-reminder');
            }
        };

        window.addEventListener('pointerdown', unlockAudio, { passive: true });
        window.addEventListener('touchstart', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio, { passive: true });

        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, [productionData, actualTimeCounter, playAlertSound, idleReminderEnabled]);

    // If the threshold was crossed while hidden/backgrounded, fire alarm when tab becomes visible again.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            if (pendingOverTargetAlarmRef.current && !overTargetToastShownRef.current && hasUserInteractedRef.current && productionData) {
                const targetMins = Number(productionData.target_mins || 0);
                const exceeded =
                    productionData.button_status === 1 &&
                    !productionData.is_paused &&
                    targetMins > 0 &&
                    actualTimeCounter / 60 > targetMins &&
                    isWithinShiftHours(new Date());
                if (!exceeded) {
                    pendingOverTargetAlarmRef.current = false;
                } else {
                    overTargetToastShownRef.current = true;
                    pendingOverTargetAlarmRef.current = false;
                    playAlertSound('finish');
                }
            }

            if (pendingStartReminderAlarmRef.current && hasUserInteractedRef.current && productionData && idleReminderEnabled) {
                const isRunning = productionData.button_status === 1 && !productionData.is_paused;
                if (isRunning) {
                    pendingStartReminderAlarmRef.current = false;
                    return;
                }
                pendingStartReminderAlarmRef.current = false;
                playAlertSound('start');
                toast.dismiss('mobile-start-reminder');
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [productionData, actualTimeCounter, playAlertSound, idleReminderEnabled]);

    useEffect(() => {
        if (!isWithinShiftHours(new Date())) {
            pendingOverTargetAlarmRef.current = false;
            stopAlertSound('finish');
            return;
        }
        if (!productionData || productionData.button_status !== 1 || productionData.is_paused) {
            overTargetToastShownRef.current = false;
            pendingOverTargetAlarmRef.current = false;
            // Idle state: do not stop the start-idle reminder alarm (only clear over-target finish alarm).
            stopAlertSound('finish');
            return;
        }
        const targetMins = Number(productionData.target_mins || 0);
        if (targetMins <= 0) {
            pendingOverTargetAlarmRef.current = false;
            stopAlertSound('finish');
            return;
        }
        const actualMins = actualTimeCounter / 60;
        const exceeded = actualMins > targetMins;
        if (!exceeded) {
            overTargetToastShownRef.current = false;
            pendingOverTargetAlarmRef.current = false;
            stopAlertSound('finish');
            return;
        }
        if (overTargetToastShownRef.current) return;
        if (hasUserInteractedRef.current) {
            overTargetToastShownRef.current = true;
            pendingOverTargetAlarmRef.current = false;
            playAlertSound('finish');
        } else {
            pendingOverTargetAlarmRef.current = true;
        }
    }, [
        currentTime,
        productionData?.id,
        productionData?.button_status,
        productionData?.is_paused,
        productionData?.target_mins,
        actualTimeCounter,
        playAlertSound,
        stopAlertSound,
    ]);

    // Repeating reminder every 10 minutes whenever production is not running.
    // Covers cases like: cycle finished, paused, or never started.
    useEffect(() => {
        if (!effectiveMachineId || !urlEmpId) return;
        let cancelled = false;

        const localDate = new Date();
        const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

        // If current row already has finish_time, prefer that and avoid extra fetch.
        if (productionData?.finish_time) {
            const localFinishMs = new Date(productionData.finish_time).getTime();
            if (Number.isFinite(localFinishMs) && localFinishMs > 0) {
                lastFinishedCycleMsRef.current = localFinishMs;
            }
            return;
        }

        const fetchLatestFinishedCycle = async () => {
            try {
                const res = await apiFetch(`${API_BASE}/api/mobile-production/machine/${effectiveMachineId}/date/${today}`);
                const json = await res.json();
                if (!json?.success || !Array.isArray(json.data) || cancelled) return;

                const latestFinished = json.data
                    .filter((row: any) =>
                        String(row.emp_id) === String(urlEmpId) &&
                        Number(row.button_status) === 2 &&
                        !!row.finish_time
                    )
                    .sort((a: any, b: any) => new Date(b.finish_time).getTime() - new Date(a.finish_time).getTime())[0];

                if (!latestFinished?.finish_time || cancelled) return;
                const finishMs = new Date(latestFinished.finish_time).getTime();
                if (Number.isFinite(finishMs) && finishMs > 0) {
                    lastFinishedCycleMsRef.current = finishMs;
                    // If reminder hasn't started yet, align anchor immediately.
                    if (startReminderAnchorRef.current === null) {
                        startReminderAnchorRef.current = finishMs;
                    }
                }
            } catch {
                // Non-fatal fallback: reminder will use local anchor if lookup fails.
            }
        };

        fetchLatestFinishedCycle();
        return () => {
            cancelled = true;
        };
    }, [API_BASE, effectiveMachineId, urlEmpId, productionData?.finish_time]);

    useEffect(() => {
        const currentStatus = productionData?.button_status ?? null;
        const previousStatus = previousButtonStatusRef.current;
        previousButtonStatusRef.current = currentStatus;

        // Fresh transition into FINISH starts a new idle gap window.
        if (currentStatus === 2 && previousStatus !== 2) {
            const finishMs = productionData?.finish_time ? new Date(productionData.finish_time).getTime() : NaN;
            const anchor = Number.isFinite(finishMs) && finishMs > 0 ? finishMs : Date.now();
            startReminderAnchorRef.current = anchor;
            lastFinishedCycleMsRef.current = anchor;
            pendingStartReminderAlarmRef.current = false;
        }
    }, [productionData?.button_status, productionData?.finish_time]);

    useEffect(() => {
        if (!productionData || initializing || loading || !idleReminderEnabled) {
            startReminderAnchorRef.current = null;
            pendingStartReminderAlarmRef.current = false;
            lastStartReminderBucketRef.current = 0;
            setStartReminderDue(false);
            return;
        }

        const isRunning = productionData.button_status === 1 && !productionData.is_paused;
        const needsStartReminder = !isRunning;

        if (!needsStartReminder) {
            startReminderAnchorRef.current = null;
            pendingStartReminderAlarmRef.current = false;
            lastStartReminderBucketRef.current = 0;
            setStartReminderDue(false);
            stopAlertSound('start');
            return;
        }

        if (startReminderAnchorRef.current === null) {
            // For finished state, use current row finish_time (or now) to enforce full idle interval.
            // For other idle states, fall back to latest finished cycle snapshot if available.
            if (productionData.button_status === 2) {
                const finishMs = productionData.finish_time ? new Date(productionData.finish_time).getTime() : NaN;
                startReminderAnchorRef.current =
                    Number.isFinite(finishMs) && finishMs > 0 ? finishMs : Date.now();
            } else {
                const fallbackFinish = lastFinishedCycleMsRef.current;
                startReminderAnchorRef.current = fallbackFinish && fallbackFinish > 0 ? fallbackFinish : Date.now();
            }
            lastStartReminderBucketRef.current = 0;
        }

        const REMINDER_MS = idleReminderConfig.idle_interval_secs * 1000;

        const tick = () => {
            if (startReminderAnchorRef.current === null) return;
            if (isLunchBreakTime(new Date()) || !isWithinShiftHours(new Date())) {
                setStartReminderDue(false);
                pendingStartReminderAlarmRef.current = false;
                return;
            }
            const elapsed = getIdleMsExcludingLunch(startReminderAnchorRef.current, Date.now());
            if (elapsed < REMINDER_MS) {
                setStartReminderDue(false);
                return;
            }

            const reminderBucket = Math.floor(elapsed / REMINDER_MS);
            if (reminderBucket <= lastStartReminderBucketRef.current) return;
            lastStartReminderBucketRef.current = reminderBucket;
            setStartReminderDue(true);
            if (hasUserInteractedRef.current) {
                pendingStartReminderAlarmRef.current = false;
                playAlertSound('start');
            } else {
                pendingStartReminderAlarmRef.current = true;
            }
            toast.dismiss('mobile-start-reminder');
        };

        // Fire once exactly when 10-minute threshold is reached, then repeat every 10 minutes.
        const elapsed = Date.now() - (startReminderAnchorRef.current ?? Date.now());
        const firstDelay = Math.max(0, REMINDER_MS - elapsed);
        const firstTimeoutId = window.setTimeout(() => {
            tick();
        }, firstDelay);
        const intervalId = window.setInterval(tick, REMINDER_MS);

        // Browser timers can be delayed in background tabs; catch up immediately on visibility/focus.
        const catchUpTick = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', catchUpTick);
        window.addEventListener('focus', catchUpTick);

        return () => {
            window.clearTimeout(firstTimeoutId);
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', catchUpTick);
            window.removeEventListener('focus', catchUpTick);
        };
    }, [
        productionData?.id,
        productionData?.button_status,
        productionData?.is_paused,
        initializing,
        loading,
        idleReminderEnabled,
        idleReminderConfig,
        playAlertSound,
        stopAlertSound,
    ]);

    const toggleIdleReminder = React.useCallback(() => {
        setIdleReminderEnabled((prev) => {
            const next = !prev;
            if (!next) {
                startReminderAnchorRef.current = null;
                stopAlertSound();
                toast('Idle reminder muted');
            } else {
                // Recompute anchor from current production state in reminder effect.
                startReminderAnchorRef.current = null;
                toast.success(`Idle reminder enabled (every ${formatIdleIntervalLabel(idleReminderConfigRef.current)})`);
            }
            return next;
        });
    }, [stopAlertSound]);

    // Sync actual_time to database periodically (source-of-truth correction).
    useEffect(() => {
        if (!productionData?.id || productionData.button_status !== 1 || productionData.is_paused) return;
        
        const syncInterval = setInterval(async () => {
            const actualMins = Math.floor(actualTimeCounterRef.current / 60);
            try {
                await apiFetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actual_time: actualMins })
                });
                setProductionData(prev => prev ? { ...prev, actual_time: actualMins } : null);
            } catch (error) {
                console.error('Timer sync error:', error);
            }
        }, 30000); // Every 30 seconds
        
        return () => clearInterval(syncInterval);
    }, [productionData?.id, productionData?.button_status, productionData?.is_paused, API_BASE]);

    // Fetch summary data from machine_centre_summary table
    const fetchSummaryData = async (machineId: string, expectedMinTotal?: number) => {
        setLoadingSummary(true);
        try {
            // Use local date instead of UTC
            const today = new Date();
            const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            // Retry logic: if expectedMinTotal provided, verify we got at least that much
            let retries = expectedMinTotal ? 10 : 1; // Increased to 10 retries for finish operations
            let lastResult = null;
            
            while (retries > 0) {
                // Add cache-busting timestamp to prevent browser caching stale data
                const timestamp = Date.now();
                const response = await apiFetch(`${API_BASE}/api/mobile-production/summary/${machineId}/date/${localDate}?_=${timestamp}`);
                const result = await response.json();
                lastResult = result;
                
                if (result.success && result.data) {
                    const totalOutput = result.data.total_output_pairs || 0;
                    
                    // If we have an expected minimum and haven't reached it, retry after delay
                    // CRITICAL FIX: Continue retrying even on last iteration if expected not met
                    if (expectedMinTotal && totalOutput < expectedMinTotal) {
                        if (retries > 1) {
                            console.log(`Summary not updated yet: ${totalOutput} < ${expectedMinTotal}, retrying... (${retries-1} left)`);
                            await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay
                            retries--;
                            continue;
                        } else {
                            // Final retry - still not updated, this is an error condition
                            console.error(`Summary update failed: expected ${expectedMinTotal} but got ${totalOutput} after all retries`);
                            toast.error('Output not updated. Please pull down to refresh.');
                            // Don't update with stale data - keep previous value
                            setLoadingSummary(false);
                            throw new Error(`Summary not updated: expected ${expectedMinTotal}, got ${totalOutput}`);
                        }
                    }
                    
                    setTotalOutputToday(totalOutput);
                    setAvgEfficiencyToday(parseFloat(result.data.avg_efficiency_percent || 0).toFixed(1));
                    const dtp = result.data.daily_target_pairs;
                    setDailyTargetPairs(
                        dtp !== null && dtp !== undefined && Number.isFinite(Number(dtp)) && Number(dtp) > 0
                            ? Number(dtp)
                            : null
                    );
                    return;
                } else {
                    setTotalOutputToday(0);
                    setAvgEfficiencyToday('0');
                    setDailyTargetPairs(null);
                    return;
                }
            }
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoadingSummary(false);
        }
    };

    // Pull-to-refresh handlers
    const handlePullRefresh = async () => {
        if (!productionData?.machine_id || pullRefreshing) return;
        setPullRefreshing(true);
        try {
            await Promise.all([
                fetchSummaryData(productionData.machine_id),
                fetchIdleReminderSettings(productionData.machine_id),
            ]);
            toast.success('Data refreshed');
        } catch {
            toast.error('Failed to refresh');
        } finally {
            setPullRefreshing(false);
            setPullDistance(0);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        // Only allow pull-to-refresh when at top of page
        if (window.scrollY > 0) return;
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
        isPulling.current = true;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling.current) return;
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const deltaY = currentY - touchStartY.current;
        const deltaX = Math.abs(currentX - touchStartX.current);
        
        // Only pull down, not horizontal scroll
        if (deltaY > 0 && deltaX < deltaY && window.scrollY === 0) {
            // Resistance: harder to pull as distance increases
            const resistance = 0.4;
            const newDistance = Math.min(deltaY * resistance, 100);
            setPullDistance(newDistance);
            e.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        if (!isPulling.current) return;
        isPulling.current = false;
        
        if (pullDistance > 60) {
            // Trigger refresh
            handlePullRefresh();
        } else {
            // Snap back
            setPullDistance(0);
        }
    };

    useEffect(() => {
        if (productionData?.machine_id) {
            fetchSummaryData(productionData.machine_id);
        }
    }, [productionData?.machine_id]);

    // Session Initialization and Polling
    useEffect(() => {
        if (urlMachineId && urlEmpId) {
            const resolveAndInitialize = async () => {
                setLoading(true);
                setInitializing(true);
                try {
                    // Add minimum delay to show loader
                    const [_, __] = await Promise.all([
                        (async () => {
                            // Check for latest unfinished production record (date-agnostic) to preserve state across refresh/day rollover
                    const existingRes = await apiFetch(`${API_BASE}/api/mobile-production/machine/${effectiveMachineId}/latest-unfinished`);
                    const existingData = await existingRes.json();

                    let isAuthorized = false;
                    try {
                        const activeSessionRes = await apiFetch(`${API_BASE}/api/mobile-session/active-for/${effectiveMachineId}`);
                        const activeSessionData = await activeSessionRes.json();
                        const bindingKey = `mobile_control_session_${effectiveMachineId}_${urlEmpId}`;
                        const boundSession = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(bindingKey) : null;
                        setHasTabSessionBinding(!!boundSession && !!sessionToken && String(boundSession) === String(sessionToken));
                        if (activeSessionData.success && activeSessionData.data) {
                            const activeSession = activeSessionData.data;
                            isAuthorized =
                                !!sessionToken &&
                                String(activeSession.emp_code) === String(urlEmpId) &&
                                String(activeSession.session_id) === String(sessionToken);
                        }
                    } catch {
                        isAuthorized = false;
                        setHasTabSessionBinding(false);
                    }
                    setIsSessionAuthorizedController(isAuthorized);
                    
                    // Use unfinished record if present.
                    // If it belongs to a different operator, keep dashboard visible but lock controls.
                    const rawUnfinished = existingData.data;
                    const isOtherOperatorRecord = rawUnfinished && String(rawUnfinished.emp_id) !== String(urlEmpId);
                    const activeRecord = rawUnfinished || null;
                    setMachineBusyRecord(isOtherOperatorRecord ? rawUnfinished : null);

                    if (activeRecord) {
                        // Use the unfinished record ONLY if it's truly in progress (button_status = 1 or 3)
                        // If button_status = 2 (finished), create new record instead
                        const [empRes, macRes, wcRes, initRes] = await Promise.all([
                            apiFetch(`${API_BASE}/api/masters/employees`).then(r => r.json()),
                            apiFetch(`${API_BASE}/api/masters/machine_centres`).then(r => r.json()),
                            apiFetch(`${API_BASE}/api/masters/work_centres`).then(r => r.json()),
                            apiFetch(`${API_BASE}/api/mobile-production/init/${effectiveMachineId}/${urlEmpId}`).then(r => r.json())
                        ]);

                        const employee = empRes.data?.find((e: any) =>
                            e.id === parseInt(activeRecord.emp_id) ||
                            e.code === activeRecord.emp_id ||
                            e.emp_id === activeRecord.emp_id
                        );
                        const machine = macRes.data?.find((m: any) => (m.machine_id === effectiveMachineId || m.code === urlMachineId));
                        const workCentre = wcRes.data?.find((wc: any) => wc.id === activeRecord.work_centre_id);

                        // Prefer pairs saved on the open cycle; do not substitute planning tray (often 12) as mobile default.
                        const targetPairsFromDb = Number(activeRecord.target_pairs || 0);

                        // Always refresh target_mins from latest routing for this machine/work-centre.
                        // This prevents stale unfinished records (e.g. old 16.6) from overriding current routing.
                        const refreshedTargetMins =
                            initRes?.success && typeof initRes?.data?.targetMins !== 'undefined'
                                ? Number(initRes.data.targetMins)
                                : Number(activeRecord.target_mins || 0);
                        const { scaledTargetMins, targetPairs: binPairs } = initializeTargetPairBaseline(
                            refreshedTargetMins,
                            MOBILE_PAIRS_PER_BIN,
                            {
                                resumeRecordTargetMins: Number(activeRecord.target_mins ?? 0) || null,
                                resumeRecordTargetPairs: targetPairsFromDb > 0 ? targetPairsFromDb : null,
                                pairsPerRoutingBin: Number(initRes?.data?.pairsPerBin) || MOBILE_PAIRS_PER_BIN,
                            }
                        );
                        if (initRes?.success && initRes?.data?.idleReminder) {
                            applyIdleReminderConfig(initRes.data.idleReminder);
                        }

                        setSessionStatus('active');
                        setQrData(effectiveMachineId);
                        setEmployeeName(
                            employee?.name ||
                            employee?.emp_name ||
                            initRes?.data?.employee?.name ||
                            ''
                        );
                        // Get machine centre name from machine centres data
                        const machineRes = await apiFetch(`${API_BASE}/api/masters/machine_centres`);
                        const machineData = await machineRes.json();
                        let machineCentreName = machine?.machine_name || machine?.name || urlMachineId;
                        if (machineData.success) {
                            const machineRecord = machineData.data.find((m: any) => m.machine_id === effectiveMachineId);
                            if (machineRecord) {
                                machineCentreName = machineRecord.machine_name || machineRecord.name;
                            }
                        }
                        setMachineName(machineCentreName);
                        const normalizedRecord = normalizePauseState(activeRecord);
                        setProductionData({
                            ...normalizedRecord,
                            target_mins: scaledTargetMins,
                            target_pairs: binPairs,
                            work_centre_name: workCentre?.work_centre_name || workCentre?.name
                        });
                        runningSinceMsRef.current = normalizedRecord.start_time
                            ? new Date(normalizedRecord.start_time).getTime()
                            : null;
                        // Restore counter: saved actual_time + elapsed seconds since start_time (recovers unsaved seconds on refresh)
                        const savedSeconds = (normalizedRecord.actual_time || 0) * 60;
                        const elapsedSinceStart = normalizedRecord.start_time && normalizedRecord.button_status === 1
                            ? Math.floor((Date.now() - new Date(normalizedRecord.start_time).getTime()) / 1000)
                            : 0;
                        // Use whichever is larger — DB value or live elapsed (in case of clock drift)
                        setActualTimeCounter(Math.max(savedSeconds, elapsedSinceStart));
                        // Fetch summary data immediately after setting production data
                        await fetchSummaryData(effectiveMachineId);
                        toast.success('Loaded existing session');
                    } else {
                        // Create new session - use optimized endpoint
                        const response = await apiFetch(`${API_BASE}/api/mobile-production/init/${effectiveMachineId}/${urlEmpId}`);
                        const result = await response.json();

                        if (!result.success) {
                            toast.error(result.message || 'Failed to initialize');
                            return;
                        }

                        const { employee, machine, workCentre, targetMins, existingRecord, pairsPerBin, idleReminder } = result.data;
                        if (idleReminder) applyIdleReminderConfig(idleReminder);
                        const { scaledTargetMins, targetPairs: binPairs } = initializeTargetPairBaseline(
                            Number(targetMins || 0),
                            MOBILE_PAIRS_PER_BIN,
                            existingRecord
                                ? {
                                      resumeRecordTargetMins: Number(existingRecord.target_mins ?? 0) || null,
                                      resumeRecordTargetPairs:
                                          Number(existingRecord.target_pairs || 0) > 0
                                              ? Number(existingRecord.target_pairs)
                                              : null,
                                      pairsPerRoutingBin: Number(pairsPerBin) || MOBILE_PAIRS_PER_BIN,
                                  }
                                : { pairsPerRoutingBin: Number(pairsPerBin) || MOBILE_PAIRS_PER_BIN }
                        );

                        setSessionStatus('active');
                        setQrData(effectiveMachineId);
                        setEmployeeName(employee.name);
                        // Get machine centre name from machine centres data
                        const machineRes = await apiFetch(`${API_BASE}/api/masters/machine_centres`);
                        const machineData = await machineRes.json();
                        let machineCentreName = machine.machine_name || machine.name;
                        if (machineData.success) {
                            const machineRecord = machineData.data.find((m: any) => m.machine_id === effectiveMachineId);
                            if (machineRecord) {
                                machineCentreName = machineRecord.machine_name || machineRecord.name;
                            }
                        }
                        setMachineName(machineCentreName);

                        // Don't create record on page load - just set up UI
                        // Record will be created when START is clicked
                        const localDate = new Date();
                        const prodDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                        const defaultData: ProductionData = {
                            prod_date: prodDate,
                            work_centre_id: workCentre.id,
                            work_centre_name: workCentre.name,
                            machine_id: effectiveMachineId,
                            emp_id: employee.id,
                            output_pairs: 0,
                            target_mins: scaledTargetMins,
                            target_pairs: binPairs,
                            start_time: null,
                            finish_time: null,
                            idle_start_time: null,
                            idle_stop_time: null,
                            actual_time: 0,
                            button_status: 3,
                            is_paused: false
                        };
                        setProductionData(defaultData);
                        runningSinceMsRef.current = null;
                        // Fetch summary data immediately after setting production data
                        await fetchSummaryData(effectiveMachineId);
                        toast.success('Ready to start production');
                    }
                        })(),
                        new Promise(resolve => setTimeout(resolve, 500))
                    ]);
                } catch (e) {
                    toast.error('Failed to load setup data');
                } finally {
                    setLoading(false);
                    setInitializing(false);
                }
            };
            resolveAndInitialize();
            return;
        }

        // GLOBAL POLLING MODE - WhatsApp Web style (when no machine/employee specified)
        if (!urlMachineId && !urlEmpId) {
            const globalSyncInterval = setInterval(async () => {
                try {
                    const ts = Date.now();
                    const sessionRes = await apiFetch(`${API_BASE}/api/mobile-session/latest-active?_=${ts}`, {
                        cache: 'no-store'
                    });
                    const sessionJson = await sessionRes.json();

                    if (sessionJson.success && sessionJson.data && sessionJson.data.redirect_url) {
                        clearInterval(globalSyncInterval);
                        toast.success(`Redirecting to active session...`);
                        navigate(sessionJson.data.redirect_url);
                    }
                } catch (e) {
                    console.error('Global polling error:', e);
                }
            }, 5000); // 5 second polling as requested
            return () => clearInterval(globalSyncInterval);
        }
    }, [location.pathname, location.search, API_BASE, navigate, urlMachineId, urlEmpId, sessionToken, initializeTargetPairBaseline, effectiveMachineId]);


    // Retry helper — retries up to maxRetries times with exponential backoff
    const withRetry = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 500 * attempt)); // 500ms, 1s, 1.5s
                }
            }
        }
        throw lastError;
    };

    const getReadableErrorMessage = (error: unknown, fallback: string) => {
        if (error instanceof Error && error.message) {
            const msg = error.message.trim();
            if (msg && msg !== 'Failed') return msg;
        }
        return fallback;
    };

    const getLocalDateString = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    const formatLocalDateTime = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    };

    const toLocalDateTimePayloadValue = (value: any) => {
        if (value === null || value === undefined || value === '') return null;
        if (value instanceof Date) return formatLocalDateTime(value);
        const raw = String(value).trim();
        if (!raw) return null;

        // Keep local date-only values unchanged.
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        // Local datetime without timezone: normalize separator/seconds only.
        if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw) && !/(Z|[+-]\d{2}:\d{2})$/i.test(raw)) {
            const normalized = raw.replace('T', ' ');
            return normalized.length === 16 ? `${normalized}:00` : normalized;
        }

        // Timezone-bearing or other parseable datetime -> convert to local wall-clock string.
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) return formatLocalDateTime(parsed);
        return raw;
    };

    const handleStart = async () => {
        toast.dismiss('mobile-action-hint');
        // If no production data ID (first time) or after FINISH, create new record
        if (!productionData?.id || productionData.button_status === 2) {
            if (!urlEmpId) {
                toast.error('Employee information missing');
                return;
            }
            
            // Prevent double-click: check if already creating
            if (isCreatingRecordRef.current) {
                console.log('Record creation already in progress, ignoring duplicate click');
                return;
            }
            isCreatingRecordRef.current = true;
            
            setLoading(true);
            try {
                const pairsAtStart = clampMobileTargetPairs(selectedTargetPairs);
                const scaledAtStart = getScaledTargetMins(pairsAtStart);
                const result = await withRetry(async () => {
                    const payload = {
                        ...productionData,
                        target_mins: scaledAtStart,
                        target_pairs: pairsAtStart,
                        output_pairs: 0,
                        // Always stamp new cycle with current local date from browser session.
                        // This avoids stale in-memory prod_date causing false duplicate conflicts.
                        prod_date: getLocalDateString(),
                        start_time: toLocalDateTimePayloadValue(productionData?.start_time),
                        finish_time: toLocalDateTimePayloadValue(productionData?.finish_time),
                        idle_start_time: toLocalDateTimePayloadValue(productionData?.idle_start_time),
                        idle_stop_time: toLocalDateTimePayloadValue(productionData?.idle_stop_time),
                        button_status: 1
                    };
                    const response = await apiFetch(`${API_BASE}/api/mobile-production`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (!data.success) {
                        const err = new Error(data.message || data.error || 'Failed to start') as Error & {
                            status?: number;
                            responseData?: any;
                        };
                        err.status = response.status;
                        err.responseData = data;
                        throw err;
                    }
                    return data;
                });
                setProductionData({
                    ...productionData!,
                    id: result.data.id,
                    button_status: 1,
                    is_paused: false,
                    target_mins: scaledAtStart,
                    target_pairs: pairsAtStart,
                });
                setActualTimeCounter(0);
                runningSinceMsRef.current = Date.now();
                toast.success('Production started');
            } catch (error) {
                const err = error as Error & {
                    status?: number;
                    responseData?: any;
                };
                const existingId = err?.responseData?.data?.existing_id;
                const isActiveConflict =
                    (err?.status === 409 ||
                    (err?.message || '').toLowerCase().includes('active production record already exists')) &&
                    !(err?.responseData?.message || err?.message || '').toLowerCase().includes('manual');

                // Auto-recover from race/conflict: attach to already-created active record
                // instead of requiring manual refresh.
                if (isActiveConflict && existingId) {
                    try {
                        const existingRes = await apiFetch(`${API_BASE}/api/mobile-production/${existingId}`);
                        const existingJson = await existingRes.json();
                        if (existingJson.success && existingJson.data) {
                            const existingRecord = normalizePauseState(existingJson.data);
                            setProductionData((prev) => prev ? ({
                                ...prev,
                                id: existingRecord.id,
                                button_status: existingRecord.button_status,
                                is_paused: existingRecord.is_paused || false,
                                start_time: existingRecord.start_time,
                                finish_time: existingRecord.finish_time,
                                idle_start_time: existingRecord.idle_start_time,
                                actual_time: existingRecord.actual_time ?? prev.actual_time,
                            }) : prev);
                            runningSinceMsRef.current = existingRecord.start_time
                                ? new Date(existingRecord.start_time).getTime()
                                : null;
                            recomputeActualTimeCounter();
                            toast.success('Production already started. Resumed existing active cycle.');
                            return;
                        }
                    } catch (recoveryError) {
                        console.warn('Failed to recover existing active production record:', recoveryError);
                    }
                }

                // UI stays in idle state — no sync issue since we never updated state
                const message = getReadableErrorMessage(
                    error,
                    'Failed to start production. Check network and try again.'
                );
                toast.error(message);
            } finally {
                setLoading(false);
                isCreatingRecordRef.current = false; // Reset flag
            }
            return;
        }
        
        if (!productionData?.id) return;
        const prevStatus = productionData.button_status;
        setLoading(true);
        try {
            await withRetry(async () => {
                const response = await apiFetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ button_status: 1, emp_id: productionData.emp_id, session_id: sessionToken })
                });
                const data = await response.json();
                if (!data.success) throw new Error(data.message || 'Failed');
                return data;
            });
            setProductionData({ ...productionData, button_status: 1, is_paused: false });
            runningSinceMsRef.current = Date.now();
            toast.success('Production started');
        } catch (error) {
            // Reconcile: re-fetch from DB to get true state (date-agnostic)
            try {
                const res = await apiFetch(`${API_BASE}/api/mobile-production/machine/${productionData.machine_id}/latest-unfinished`);
                const data = await res.json();
                const record = data.data;
                if (record && record.id === productionData.id) {
                    const normalizedRecord = normalizePauseState(record);
                    setProductionData(prev => ({ ...prev!, button_status: normalizedRecord.button_status, is_paused: normalizedRecord.is_paused || false }));
                }
            } catch { /* keep previous state */ }
            toast.error('Failed to start. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePause = async () => {
        if (!productionData?.id) return;
        setShowStoppageModal(true);
    };

    const confirmPause = async (reason: string) => {
        if (!productionData?.id) return;
        setShowStoppageModal(false);
        setLoading(true);
        try {
            await withRetry(async () => {
                const response = await apiFetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ button_status: 3, stoppage_reason: reason, emp_id: productionData.emp_id, session_id: sessionToken })
                });
                const data = await response.json();
                if (!data.success) throw new Error(data.message || 'Failed');
                return data;
            });
            setProductionData({ ...productionData, is_paused: true, button_status: 3 });
            runningSinceMsRef.current = null;
            toast.success(`Stopped: ${reason}`);
        } catch (error) {
            // Don't change UI state — production stays running
            toast.error('Failed to stop. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        toast.dismiss('mobile-action-hint');
        if (!productionData?.id) return;
        setLoading(true);
        const outputPairs = clampMobileTargetPairs(selectedTargetPairs);
        const maxFinishRetries = 5;
        let finishSuccess = false;
        let finishResult: any;
        let lastError: any;
        let validationErrorMsg: string | null = null;
        
        // CRITICAL: Retry loop with verification - keeps trying until DB confirms update or max retries
        for (let attempt = 1; attempt <= maxFinishRetries; attempt++) {
            try {
                finishResult = await withRetry(async () => {
                    const response = await apiFetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ button_status: 2, output_pairs: outputPairs, emp_id: productionData.emp_id, session_id: sessionToken })
                    });
                    const data = await response.json();
                    if (!data.success) {
                        // Business rule / validation — show API message, do not retry
                        validationErrorMsg =
                            data.message || data.error || 'Could not finish this cycle.';
                        throw new Error('VALIDATION_ERROR');
                    }
                    return data;
                }, 3);
                
                // VERIFY: Double-check the record was actually updated by fetching it
                await new Promise(r => setTimeout(r, 200)); // Brief delay for DB consistency
                const verifyRes = await apiFetch(`${API_BASE}/api/mobile-production/${productionData.id}`);
                const verifyData = await verifyRes.json();
                
                if (verifyData.success && verifyData.data?.button_status === 2) {
                    // VERIFIED: DB actually has the finished status
                    finishSuccess = true;
                    break; // Exit retry loop
                } else {
                    // DB doesn't reflect the update - retry
                    throw new Error('DB verification failed');
                }
            } catch (err) {
                lastError = err;
                console.error(`Finish attempt ${attempt} failed:`, err);
                // If validation error, stop retrying immediately
                if ((err as Error).message === 'VALIDATION_ERROR') {
                    break;
                }
                if (attempt < maxFinishRetries) {
                    toast.loading(`Retrying finish... (${attempt}/${maxFinishRetries})`, { id: 'finish-retry', duration: 1500 });
                    await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
                }
            }
        }
        
        toast.dismiss('finish-retry');
        
        if (!finishSuccess) {
            // Check if it was a validation error (ghost cycle, etc.)
            if (validationErrorMsg) {
                toast.error(validationErrorMsg, { duration: 8000, id: 'validation-error' });
                setLoading(false);
                return;
            }

            // CRITICAL FAILURE: DB may not have the finished record
            // Block user from starting new cycle until resolved
            toast.error(
                <div className="text-left">
                    <p className="font-bold">⚠️ CRITICAL: Finish may not be saved!</p>
                    <p className="text-sm mt-1">Do not start new cycle until resolved.</p>
                    <button 
                        onClick={async () => {
                            // Manual retry
                            toast.loading('Checking...', { id: 'manual-check' });
                            try {
                                const res = await apiFetch(`${API_BASE}/api/mobile-production/${productionData.id}`);
                                const data = await res.json();
                                if (data.success && data.data?.button_status === 2) {
                                    toast.success('✅ Cycle is finished! Click RESET to continue.', { id: 'manual-check', duration: 5000 });
                                } else {
                                    toast.error('❌ Cycle still running. Tap FINISH again.', { id: 'manual-check', duration: 5000 });
                                }
                            } catch {
                                toast.error('Network error. Try again.', { id: 'manual-check' });
                            }
                        }}
                        className="mt-2 w-full px-3 py-2 bg-red-600 text-white rounded font-semibold"
                    >
                        Tap to Verify Status
                    </button>
                </div>,
                { duration: 30000, id: 'finish-critical-error' }
            );
            setLoading(false);
            return;
        }
        
        // SUCCESS: Update local state and show success
        setProductionData({ ...productionData, button_status: 2, output_pairs: outputPairs });
        runningSinceMsRef.current = null;
        
        if (finishResult?.data?.summary_updated && finishResult?.data?.total_output_pairs !== undefined) {
            setTotalOutputToday(finishResult.data.total_output_pairs);
            // Root cause fix: this branch previously skipped summary re-fetch,
            // so avgEfficiencyToday stayed stale until manual refresh.
            await fetchSummaryData(productionData.machine_id, finishResult.data.total_output_pairs);
            toast.success(`✅ Production finished! Total: ${finishResult.data.total_output_pairs} pairs from ${finishResult.data.total_cycles} cycles`);
        } else {
            // Fetch summary even if backend didn't return it
            await fetchSummaryData(productionData.machine_id);
            toast.success('✅ Production finished - Click RESET for next cycle');
        }
        
        setLoading(false);
    };

    const handleReset = async () => {
        if (!productionData) return;
        
        if (productionData.button_status === 2) {
            // After FINISH, reset to initial state without database record.
            // Keep Target Pairs / BIN selection (e.g. 6) for the next cycle.
            const pairs = clampMobileTargetPairs(selectedTargetPairs);
            const resetTargetMins = getScaledTargetMins(pairs);
            const resetData: ProductionData = {
                ...productionData,
                id: undefined, // Remove ID so next START creates new record
                prod_date: getLocalDateString(),
                output_pairs: 0,
                target_pairs: pairs,
                target_mins: resetTargetMins,
                actual_time: 0,
                button_status: 3,
                is_paused: false,
                start_time: null,
                finish_time: null,
                idle_start_time: null
            };
            setSelectedTargetPairs(pairs);
            writeSessionTargetPairs(pairs);
            setProductionData(resetData);
            setActualTimeCounter(0);
            runningSinceMsRef.current = null;
            toast.success('Ready for next cycle - Click START to begin');
        } else {
            setActualTimeCounter(0);
            setProductionData({ ...productionData, actual_time: 0, button_status: 3, is_paused: false });
            runningSinceMsRef.current = null;
            toast.success('Timer reset');
        }
    };

    const calculateEfficiency = () => {
        if (!productionData || !productionData.target_mins || productionData.target_mins === 0) return 0;
        // Only calculate after FINISH (button_status === 2)
        if (productionData.button_status !== 2) return 0;
        const actualMins = actualTimeCounter / 60; // Use live counter in seconds, convert to minutes
        if (actualMins === 0) return 0;
        return parseFloat(((actualMins / productionData.target_mins) * 100).toFixed(1));
    };

    const calculateStatus = () => {
        if (!productionData) return { label: 'On-track', color: 'text-white', bgColor: 'bg-green-500' };

        // Paused/Idle state (including finished cycles waiting for reset/start).
        if (productionData.is_paused || productionData.button_status === 3 || productionData.button_status === 2) {
            return { label: 'Idle', color: 'text-gray-700', bgColor: 'bg-gray-400' };
        }

        // Use the same efficiency shown on the screen: Output actual / pace.
        // Thresholds match the efficiency circle:
        //  - <70%  => Low
        //  - 70-99 => Average
        //  - 100%+ => On-track
        const efficiency =
            outputExpectedNow > 0 ? outputPaceEfficiencyPct : parseFloat(avgEfficiencyToday || '0');

        if (efficiency < 70) {
            return { label: 'Low', color: 'text-white', bgColor: 'bg-red-500' };
        } else if (efficiency < 100) {
            return { label: 'Average', color: 'text-white', bgColor: 'bg-orange-500' };
        }
        return { label: 'On-track', color: 'text-white', bgColor: 'bg-green-500' };
    };

    const fetchTimingCycles = React.useCallback(async () => {
        if (!effectiveMachineId) return;
        setTimingLoading(true);
        try {
            const today = new Date();
            const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const params = new URLSearchParams({ date: localDate });
            if (sessionToken) params.set('session', sessionToken);
            const res = await apiFetch(
                `${API_BASE}/api/mobile-production/machine/${encodeURIComponent(effectiveMachineId)}/daily-cycles?${params.toString()}`
            );
            const json = await res.json();
            if (!res.ok || !json.success || !Array.isArray(json.events)) {
                setTimingTotalCycles(0);
                setTimingCycles([]);
                if (!res.ok || json?.message) {
                    console.warn('Late boxes fetch failed:', json?.message || res.status);
                }
                return;
            }
            const allMachineCycles = json.events
                .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            const mapped = allMachineCycles
                .map((e: any, idx: number) => ({ ...e, cycleNumber: idx + 1 }))
                .map((e: any) => {
                    const target_mins = Number(e.target_mins || 0);
                    const startMs = new Date(e.start_time).getTime();
                    const finishMs = e.finish_time ? new Date(e.finish_time).getTime() : NaN;
                    const actual_mins = Number.isFinite(finishMs) && Number.isFinite(startMs)
                        ? Math.max(0, (finishMs - startMs) / 60000)
                        : Number(e.actual_mins || 0);
                    const start_gap_mins = Math.max(0, Number(e.inactive_mins || 0));
                    const extra_mins = Math.max(0, actual_mins - target_mins);
                    const early_mins = Math.max(0, target_mins - actual_mins);
                    const lost_mins = computeCycleNetLostMins(start_gap_mins, target_mins, actual_mins);
                    return {
                        id: e.id,
                        cycle: e.cycleNumber,
                        start_time: e.start_time,
                        finish_time: e.finish_time,
                        target_mins,
                        actual_mins,
                        start_gap_mins,
                        extra_mins,
                        early_mins,
                        lost_mins,
                        output_pairs: Number(e.output_pairs || 0),
                    };
                });
            setTimingTotalCycles(allMachineCycles.length);
            setTimingCycles(mapped);
        } catch { /* non-fatal */ } finally {
            setTimingLoading(false);
        }
    }, [API_BASE, effectiveMachineId, sessionToken]);

    const getStatusText = () => {
        return calculateStatus().label;
    };

    const getStatusColor = () => {
        return calculateStatus().color;
    };

    const getStatusBgColor = () => {
        return calculateStatus().bgColor;
    };

    const isShiftHoursActive = isWithinShiftHours(currentTime);
    const isTargetTimeExceeded =
        isShiftHoursActive &&
        !!productionData &&
        productionData.button_status === 1 &&
        !productionData.is_paused &&
        Number(productionData.target_mins || 0) > 0 &&
        actualTimeCounter / 60 > Number(productionData.target_mins || 0);
    const normalizedButtonStatus = Number(productionData?.button_status ?? 0);
    const showStartPressHint =
        !!productionData &&
        (normalizedButtonStatus === 3 || normalizedButtonStatus === 2 || productionData.is_paused || normalizedButtonStatus === 0);
    const showFinishPressHint =
        isTargetTimeExceeded;
    const isLunchBreakActive = isLunchBreakTime(currentTime);
    const idleMinutes = (() => {
        if (!productionData) return 0;
        const isRunning = productionData.button_status === 1 && !productionData.is_paused;
        if (isRunning || startReminderAnchorRef.current === null || isLunchBreakActive || !isShiftHoursActive) return 0;
        const elapsedMs = getIdleMsExcludingLunch(startReminderAnchorRef.current, currentTime.getTime());
        return Math.max(0, Math.floor(elapsedMs / 60000));
    })();
    const showStartButtonPressHint =
        !!productionData &&
        (normalizedButtonStatus === 3 || productionData.is_paused || normalizedButtonStatus === 0);
    const showResetButtonPressHint =
        !!productionData &&
        normalizedButtonStatus === 2;
    // Deterministic cue selection while START/RESET controls are visible.
    const showStartPrimaryCue = normalizedButtonStatus !== 2;
    const showResetPrimaryCue = normalizedButtonStatus === 2;
    const showIdlePill =
        idleMinutes > 0 && showStartPressHint && isShiftHoursActive && !isLunchBreakActive;

    const controlBtnBase =
        'relative flex min-h-[3.75rem] flex-1 touch-manipulation select-none items-center justify-center gap-2.5 overflow-hidden rounded-2xl border text-base font-extrabold uppercase tracking-[0.12em] shadow-md transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed md:min-h-[4.25rem] md:gap-3 md:text-xl';
    const controlBtnCue =
        'ring-2 ring-amber-300 ring-offset-2 ring-offset-white shadow-[0_0_24px_rgba(251,191,36,0.4)]';
    const pacePillClass =
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 shadow-sm sm:px-3 sm:py-3';
    const pacePillLabelClass =
        'text-[11px] font-bold uppercase tracking-[0.14em] leading-none sm:text-xs';
    const pacePillValueClass =
        'text-base font-black tabular-nums leading-none tracking-tight sm:text-lg';
    const actionStripBelowButtons =
        dailyPaceSnapshot || showIdlePill ? (
            <div
                className={`mt-4 overflow-hidden rounded-2xl border shadow-sm ${
                    showIdlePill
                        ? 'border-red-200/90 bg-gradient-to-br from-red-50 via-orange-50/60 to-white'
                        : 'border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-slate-50'
                }`}
            >
              
                <div className="flex w-full flex-nowrap items-stretch gap-2 p-2 sm:gap-2.5 sm:p-2.5">
                    {dailyPaceSnapshot && (
                        <>
                            <span className={`${pacePillClass} border-slate-200 bg-white`}>
                                <span className={`${pacePillLabelClass} text-slate-500`}>Current</span>
                                <span className={`${pacePillValueClass} text-slate-800`}>
                                    {formatPairsPerHour(dailyPaceSnapshot.currentPairsPerHr)}
                                </span>
                            </span>
                            <span
                                className={`${pacePillClass} border-amber-400/40 bg-gradient-to-b from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/20`}
                            >
                                <span className={`${pacePillLabelClass} text-amber-50/95`}>Required</span>
                                <span className={`${pacePillValueClass} text-white drop-shadow-sm`}>
                                    {formatPairsPerHour(dailyPaceSnapshot.pairsPerHrNeeded)}
                                </span>
                            </span>
                        </>
                    )}
                    {showIdlePill && (
                        <span
                            className={`${pacePillClass} border-red-400/40 bg-gradient-to-b from-red-500 to-red-600 text-white shadow-md shadow-red-500/25`}
                        >
                            <span className={`${pacePillLabelClass} text-red-50/95`}>Idle</span>
                            <span className={`${pacePillValueClass} text-white drop-shadow-sm`}>
                                {idleMinutes} m
                            </span>
                        </span>
                    )}
                </div>
            </div>
        ) : null;

    // --- RENDER ---

    // Show QR code when machine is selected but no employee yet — poll for session in background
    if (urlMachineId && !urlEmpId) {
        const qrCandidates = [
            `/assets/qrcode-Stitching-line-${resolvedMachineId}.jpeg`,
            `/assets/qrcode-${resolvedMachineId}.jpeg`,
            `/assets/qrcode-${urlMachineId}.jpeg`,
        ];
        return (
            <QRWaitScreen
                machineId={effectiveMachineId}
                urlMachineId={urlMachineId}
                qrCandidates={qrCandidates}
                onSessionActive={(empCode, sessionId) => {
                    const machine = encodeURIComponent(urlMachineId);
                    const emp = encodeURIComponent(empCode);
                    const token = sessionId ? encodeURIComponent(sessionId) : '';
                    if (sessionId && typeof sessionStorage !== 'undefined') {
                        sessionStorage.setItem(`mobile_control_session_${urlMachineId}_${empCode}`, sessionId);
                    }
                    navigate(`/mobile/${machine}/${emp}${token ? `?session=${token}` : ''}`);
                }}
            />
        );
    }

    // WAITING STATE
    if (sessionStatus === 'waiting' && !productionData) {
        // Build correct base URL with subfolder for GitHub Pages
        const baseUrl = window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        const activationUrl = sessionId
            ? `${baseUrl}/line_setup_form?session=${sessionId}${qrData ? `&machine=${qrData}` : ''}`
            : '';

        return (
            <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center z-50">
                <div className="text-center">
                    <RefreshCw className="h-16 w-16 animate-spin text-white mx-auto mb-4" />
                    <p className="text-white text-lg font-semibold">
                        {urlMachineId && !urlEmpId
                            ? `Waiting for supervisor scan on ${urlMachineId}...`
                            : !urlMachineId && !urlEmpId
                                ? 'Waiting for QR scan from another device...'
                                : 'Waiting for connection...'
                        }
                    </p>
                </div>
            </div>
        );
    }

    const currentLoggedInUser = (() => {
        try {
            if (typeof localStorage === 'undefined') return null;
            const raw = localStorage.getItem('user_info');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    const currentUserCode =
        currentLoggedInUser?.code ||
        currentLoggedInUser?.emp_code ||
        currentLoggedInUser?.emp_id ||
        '';

    const isLoggedInOperatorOwner =
        !!currentLoggedInUser &&
        currentLoggedInUser?.role === 'Machine Centre User' &&
        String(currentUserCode) === String(urlEmpId || '') &&
        (
            !currentLoggedInUser?.machine_id ||
            String(currentLoggedInUser.machine_id) === String(effectiveMachineId)
        );

    const controlsLockedByOtherOperator = !!machineBusyRecord;
    const controlsLockedBySession = !(isSessionAuthorizedController && hasTabSessionBinding);
    const controlsLockedByLoggedInUser = !isLoggedInOperatorOwner;
    const controlsLocked = controlsLockedByOtherOperator || controlsLockedBySession || controlsLockedByLoggedInUser;

    // DASHBOARD STATE
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-1 md:p-2">
            {/* Initial Loading Screen */}
            {initializing && (
                <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                        <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Production...</h2>
                        <p className="text-sm text-gray-600">Please wait</p>
                    </div>
                </div>
            )}

            {/* Loading Screen */}
            {loading && !productionData && (
                <div className="flex items-center justify-center h-screen">
                    <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Setting up...</h2>
                        <p className="text-sm text-gray-500">Please wait</p>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {(!loading || productionData) && productionData && (
                <div 
                    className="w-full px-2 relative"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Pull-to-refresh indicator */}
                    {pullDistance > 0 && (
                        <div 
                            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-transform"
                            style={{ 
                                transform: `translateY(${Math.min(pullDistance, 80)}px)`,
                                opacity: Math.min(pullDistance / 60, 1)
                            }}
                        >
                            <div className="bg-white rounded-full shadow-lg p-3 flex items-center gap-2">
                                <RefreshCw className={`h-5 w-5 text-blue-600 ${pullRefreshing ? 'animate-spin' : ''}`} />
                                <span className="text-sm font-medium text-gray-700">
                                    {pullRefreshing ? 'Refreshing...' : pullDistance > 60 ? 'Release to refresh' : 'Pull down to refresh'}
                                </span>
                            </div>
                        </div>
                    )}
                        <>
                    {/* Late Cycles Timing Popup */}
                    <LateCyclesTodayModal
                        open={showTimingPopup}
                        loading={timingLoading}
                        cycles={timingCycles}
                        totalCycles={timingTotalCycles}
                        onClose={() => setShowTimingPopup(false)}
                        onRefresh={fetchTimingCycles}
                    />

                    {/* Full-screen flashing alert overlay when time exceeds target */}
                    {isTargetTimeExceeded && (
                        <div
                            className="fixed inset-0 z-40 pointer-events-none animate-pulse bg-red-600/35"
                            aria-hidden
                        />
                    )}
                    {/* Stoppage Reason Modal */}
                    {showStoppageModal && (
                        <StoppageReasonModal
                            onConfirm={confirmPause}
                            onCancel={() => setShowStoppageModal(false)}
                        />
                    )}

                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl shadow-xl relative">
                        <button
                            onClick={() => setHeaderExpanded(!headerExpanded)}
                            className="relative w-full p-4 hover:bg-white/5 transition-colors"
                        >
                            <div className="flex flex-col items-center justify-center gap-2 w-full text-center pl-10 pr-8 md:pl-0 md:pr-0">
                                {!headerExpanded && (
                                    <span className="text-xs md:text-sm font-semibold bg-white/20 px-3 py-1.5 rounded-full">
                                        Tap to view details · Status:{' '}
                                        <span className={`inline-block px-2 py-0.5 rounded-full ${getStatusBgColor()} ${getStatusColor()}`}>
                                            {getStatusText()}
                                        </span>
                                    </span>
                                )}
                            </div>
                            <svg
                                className={`absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 transition-transform ${headerExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {headerExpanded && (
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm px-4 pb-3">
                                <div className="col-span-2 md:col-span-6 text-center leading-tight">
                                    <h1 className="text-xl md:text-2xl font-bold tracking-tight">MACHINE CENTRE PRODUCTION</h1>
                                </div>
                                <div className="col-span-2 md:col-span-6 flex items-center justify-between gap-2">
                                    <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wide bg-white/15 px-2 py-1 rounded-md">
                                        Production Status
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => { setShowTimingPopup(v => !v); if (!showTimingPopup) fetchTimingCycles(); }}
                                        className="relative shrink-0 touch-manipulation p-1.5 md:p-2 rounded-lg bg-white hover:bg-white/90 text-red-500 active:opacity-90"
                                        title="View late cycles"
                                    >
                                        <Bell className="h-4 w-4" />
                                        {timingCycles.some((c) => classifyLateCycleCategory(c) === 'net_loss') && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                        )}
                                    </button>
                                </div>
                                {loadingSummary && !dailyPaceSnapshot ? (
                                    <div className="col-span-2 md:col-span-6 text-center text-xs text-white/80 py-1">
                                        Loading daily speed…
                                    </div>
                                ) : dailyPaceSnapshot ? (
                                    <div className="col-span-2 md:col-span-6 grid w-full min-w-0 grid-cols-1 gap-2 md:grid-cols-2 md:gap-2 text-center">
                                        <div
                                            className={`w-full min-w-0 rounded-xl px-3 py-2.5 sm:px-3 sm:py-2 md:px-3 md:py-2 border shadow-md ring-1 ${
                                                dailyPaceSnapshot.projectedEod >= dailyPaceSnapshot.daily
                                                    ? 'bg-emerald-600/20 border-emerald-300/55 ring-emerald-400/30'
                                                    : 'bg-red-950/50 border-red-400/45 ring-red-500/35'
                                            }`}
                                            title={`Actual output vs expected by now at routing standard (${dailyPaceSnapshot.totalProductiveMins} productive mins, lunch excluded). Projected EOD = (actual ÷ elapsed productive mins) × shift productive mins.`}
                                        >
                                            <p className="text-[11px] sm:text-xs uppercase opacity-90 font-semibold tracking-wide text-white">
                                                Actual vs speed
                                            </p>
                                            <div
                                                className="mt-1.5 md:mt-1 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1"
                                                aria-label={`${totalOutputToday} pairs produced, ${dailyPaceSnapshot.expected} expected by now`}
                                            >
                                                <div className="flex items-baseline justify-center gap-2 sm:gap-2.5 flex-nowrap tabular-nums">
                                                    <span className="text-[1.65rem] leading-none sm:text-2xl md:text-3xl font-bold text-emerald-300 drop-shadow-sm min-w-0">
                                                        {totalOutputToday}
                                                    </span>
                                                    <span className="text-xl sm:text-lg md:text-2xl font-semibold text-white/50 shrink-0 leading-none pb-0.5 sm:pb-0">
                                                        /
                                                    </span>
                                                    <span className="text-[1.65rem] leading-none sm:text-2xl md:text-3xl font-bold tabular-nums text-white min-w-0">
                                                        {dailyPaceSnapshot.expected}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline justify-center gap-1.5 border-t border-white/20 pt-1.5 mt-0.5 w-full min-[400px]:border-t-0 min-[400px]:border-l min-[400px]:border-white/25 min-[400px]:pt-0 min-[400px]:mt-0 min-[400px]:pl-4 min-[400px]:w-auto min-[400px]:basis-auto">
                                                    <span
                                                        className={`text-[10px] sm:text-[11px] uppercase tracking-wide ${
                                                            dailyPaceSnapshot.projectedEod >= dailyPaceSnapshot.daily ? 'text-white/65' : 'text-white/85'
                                                        }`}
                                                    >
                                                        {dailyPaceSnapshot.projectedEod >= dailyPaceSnapshot.daily ? '▲ On track' : '▼ Short by'}
                                                    </span>
                                                    {dailyPaceSnapshot.projectedEod < dailyPaceSnapshot.daily && (
                                                        <span className="text-[1.35rem] leading-none sm:text-2xl md:text-3xl font-bold tabular-nums text-white drop-shadow-sm">
                                                            {dailyPaceSnapshot.daily - dailyPaceSnapshot.projectedEod}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[10px] sm:text-[11px] opacity-80 mt-1 md:mt-0.5 max-w-full mx-auto break-words px-0.5 leading-snug">
                                                pairs now · EOD projection {dailyPaceSnapshot.projectedEod} · {dailyPaceSnapshot.remainingMins}m left
                                            </p>
                                        </div>
                                        <div className="w-full min-w-0 rounded-xl bg-white/10 px-3 py-2.5 sm:px-3 sm:py-2 md:px-2 md:py-2 border border-white/25 shadow-md ring-1 ring-white/10">
                                            <p className="text-[11px] sm:text-xs uppercase opacity-80 font-semibold tracking-wide">Shift target</p>
                                            <p className="text-[1.65rem] leading-none sm:text-2xl md:text-3xl font-bold tabular-nums text-sky-100 mt-1.5 md:mt-1">
                                                {dailyPaceSnapshot.daily}
                                            </p>
                                            <p className="text-[10px] sm:text-[11px] opacity-75 mt-1 md:mt-0.5">
                                                pairs @ routing ({dailyPaceSnapshot.totalProductiveMins}m shift)
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="col-span-2 md:col-span-6 text-center text-xs text-white/70 px-2 py-2 rounded-lg bg-white/5 border border-white/10">
                                        No routing target time for this machine — shift target and speed are unavailable.
                                    </div>
                                )}
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 ring-1 ring-inset ring-white/5">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Operator</p>
                                        <p className="font-semibold truncate">
                                            {formatOperatorDisplay(employeeName, productionData.emp_id)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 ring-1 ring-inset ring-white/5">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Machine ID</p>
                                        <p className="font-semibold truncate">{resolvedMachineId || productionData.machine_id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 ring-1 ring-inset ring-white/5">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Line Name</p>
                                        <p className="font-semibold truncate">{productionData.work_centre_name || `WC-${productionData.work_centre_id}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 shadow-[inset_3px_0_0_0_rgba(56,189,248,0.35)]">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Process Name</p>
                                        <p className="font-semibold truncate">{machineName || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 shadow-[inset_3px_0_0_0_rgba(56,189,248,0.35)]">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Bins Completed (Today)</p>
                                        <p className="font-semibold truncate">
                                            {loadingSummary
                                                ? '...'
                                                : Number.isInteger(totalOutputToday / MOBILE_PAIRS_PER_BIN)
                                                    ? totalOutputToday / MOBILE_PAIRS_PER_BIN
                                                    : (totalOutputToday / MOBILE_PAIRS_PER_BIN).toFixed(2)}
                                        </p>
                                        <p className="text-[11px] opacity-80">
                                            ~bins at {MOBILE_PAIRS_PER_BIN} pr/box (standard)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 shadow-[inset_3px_0_0_0_rgba(56,189,248,0.35)]">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Date & Time</p>
                                        <p className="font-semibold text-xs">{currentTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleIdleReminder}
                                    className={`col-span-2 flex touch-manipulation select-none items-center justify-center gap-2 rounded-lg px-2 py-2 transition-colors border active:opacity-90 ${
                                        idleReminderEnabled
                                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-300/60'
                                            : 'bg-gray-500/20 hover:bg-gray-500/30 border-gray-300/60'
                                    }`}
                                    title={idleReminderEnabled ? 'Turn OFF idle reminder sound' : 'Turn ON idle reminder sound'}
                                >
                                    {idleReminderEnabled ? <Bell className="h-4 w-4 text-emerald-100" /> : <BellOff className="h-4 w-4 text-gray-100" />}
                                    <span className="text-sm font-semibold text-white text-center leading-tight">
                                        {idleReminderEnabled ? 'Idle Reminder ON' : 'Idle Reminder OFF'}
                                        {idleReminderEnabled && (
                                            <span className="block text-[10px] font-normal opacity-90">
                                                every {formatIdleIntervalLabel(idleReminderConfig)}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Metrics Section */}
                    <div className="bg-white shadow-xl border-x border-gray-200 px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3">
                        {/* Progress Bar — red when actual time exceeds target */}
                        {productionData.button_status === 1 && !productionData.is_paused && productionData.target_mins > 0 && (
                            <div className="mb-4">
                                <div
                                    className={`rounded-lg p-1 transition-shadow duration-300 ${
                                        isTargetTimeExceeded
                                            ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-white shadow-[0_0_0_3px_rgba(239,68,68,0.35)]'
                                            : ''
                                    }`}
                                >
                                    <div className="flex justify-between gap-2 text-xs text-gray-600 mb-1 px-0.5">
                                        <span className="font-medium leading-tight text-gray-700">
                                            Cycle time progress
                                                </span>
                                        <span className={`shrink-0 tabular-nums ${isTargetTimeExceeded ? 'font-bold text-red-600' : ''}`}>
                                            {Math.min(100, Math.round((actualTimeCounter / 60 / Number(productionData.target_mins)) * 100))}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${
                                                isTargetTimeExceeded ? 'bg-red-500' : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(100, (actualTimeCounter / 60 / Number(productionData.target_mins)) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-6 rounded-xl border-2 border-blue-200 shadow-sm text-center">
                                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Target Time</p>
                                <p className="text-3xl md:text-5xl font-bold text-blue-900">{Number(productionData.target_mins || 0).toFixed(1)}  <span className="text-xl font-bold text-blue-600 mt-1">m</span></p>
                               
                            </div>
                            <div
                                className={`bg-gradient-to-br from-purple-50 to-purple-100 p-4 md:p-6 rounded-xl border-2 border-purple-200 shadow-sm relative ${
                                    productionData.button_status === 1 && !productionData.is_paused
                                        ? 'animate-cycle-active-blink'
                                        : ''
                                }`}
                            >
                                {productionData.button_status === 1 && !productionData.is_paused && (
                                    <div className="absolute top-2 right-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                    </div>
                                )}
                                <p className="text-xs font-semibold text-purple-700 uppercase mb-1 text-center">Actual Time</p>
                                <p className="text-3xl md:text-5xl font-bold text-purple-900 text-center">
                                    <span>{Math.floor(actualTimeCounter / 60)}</span><span className="text-2xl md:text-3xl">m</span>
                                    <span className="text-2xl md:text-3xl font-bold text-purple-700 ml-2"><span>{actualTimeCounter % 60}</span>s</span>
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 md:p-6 rounded-xl border-2 border-green-200 shadow-sm text-center">
                                <p className="text-xs font-semibold text-green-700 uppercase mb-1">
                                    Pairs/box <span className="font-normal normal-case text-green-600">(1–12)</span>
                                </p>
                                <select
                                    value={selectedTargetPairs}
                                    aria-label="Target pairs per bin for this cycle"
                                    disabled={loading}
                                    onChange={handleTargetPairsChange}
                                    className="w-full text-2xl md:text-3xl font-bold text-green-900 border border-green-300 rounded-lg px-2 py-1 bg-white cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                                >
                                    {MOBILE_TARGET_PAIR_OPTIONS.map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                               
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-6 rounded-xl border-2 border-orange-200 shadow-sm relative text-center">
                                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Output</p>
                                {loadingSummary ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto my-4" />
                                ) : (
                                    <>
                                        <div className="flex items-baseline justify-center gap-2 tabular-nums">
                                            <span className={`text-3xl md:text-5xl font-bold ${totalOutputToday < outputExpectedNow ? 'text-red-700' : 'text-orange-900'}`}>
                                                {totalOutputToday}
                                            </span>
                                            <span className="text-xl md:text-3xl font-semibold text-orange-400">/</span>
                                            <span className="text-3xl md:text-5xl font-bold text-orange-900">{outputExpectedNow}</span>
                                        </div>
                                      
                                    </>
                                )}
                                {/* Refresh button for manual update */}
                                <button
                                    onClick={() => productionData?.machine_id && fetchSummaryData(productionData.machine_id)}
                                    disabled={loadingSummary}
                                    className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white rounded-full shadow-sm transition-all disabled:opacity-50"
                                    title="Refresh output"
                                >
                                    <RefreshCw className={`h-4 w-4 text-orange-600 ${loadingSummary ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="bg-gradient-to-br from-cyan-50 to-sky-100 p-4 md:p-6 rounded-xl border-2 border-cyan-200 shadow-sm text-center">
                                <p className="text-xs font-semibold text-cyan-700 uppercase mb-1">Boxes</p>
                                {loadingSummary ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-cyan-600 mx-auto my-4" />
                                ) : (
                                    <>
                                        <div className="flex items-baseline justify-center gap-2 tabular-nums">
                                            <span
                                                className={`text-3xl md:text-5xl font-bold ${
                                                    binsCompletedToday < boxesExpectedNow ? 'text-red-700' : 'text-cyan-900'
                                                }`}
                                            >
                                                {formatBoxesDisplay(binsCompletedToday)}
                                            </span>
                                            <span className="text-xl md:text-3xl font-semibold text-cyan-400">/</span>
                                            <span className="text-3xl md:text-5xl font-bold text-cyan-900">
                                                {formatBoxesDisplay(boxesExpectedNow)}
                                            </span>
                                        </div>
                                      
                                    </>
                                )}
                            </div>
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 md:p-6 rounded-xl border-2 border-indigo-200 shadow-sm text-center">
                                <p className="text-xs font-semibold text-indigo-700 uppercase mb-1">Efficiency</p>
                                {loadingSummary ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto my-4" />
                                ) : (
                                    <>
                                        <p
                                            className={`text-3xl md:text-5xl font-bold mt-1 ${
                                                outputPaceEfficiencyPct >= 100
                                                    ? 'text-green-700'
                                                    : outputPaceEfficiencyPct >= 70
                                                      ? 'text-amber-700'
                                                      : 'text-red-700'
                                            }`}
                                        >
                                            <span>{outputPaceEfficiencyPct}</span>%
                                        </p>
                                       
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="rounded-b-2xl border-x border-b border-gray-200 bg-white px-4 pb-4 pt-1 shadow-xl md:px-6 md:pb-6 md:pt-2">
                        <div className="flex gap-3 md:gap-4">
                            {normalizedButtonStatus === 3 || normalizedButtonStatus === 2 ? (
                                <>
                                    <button
                                        onClick={handleStart}
                                        disabled={loading || normalizedButtonStatus === 2}
                                        title={normalizedButtonStatus === 2 ? 'Cycle finished. Click RESET to start a new cycle.' : ''}
                                        className={`${controlBtnBase} border-emerald-700/30 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-emerald-900/20 hover:from-emerald-600 hover:to-emerald-800 disabled:border-slate-300 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none ${
                                            showStartButtonPressHint ? controlBtnCue : ''
                                        }`}
                                    >
                                        {showStartButtonPressHint && (
                                            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
                                        )}
                                        {loading ? (
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        ) : (
                                            <>
                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 md:h-10 md:w-10">
                                                    <Play className="h-5 w-5 fill-current md:h-5 md:w-5" />
                                                </span>
                                                <span>Start</span>
                                                {showStartPrimaryCue && (
                                                    <Hand
                                                        className="h-7 w-7 animate-bounce text-amber-200 drop-shadow-md md:h-8 md:w-8"
                                                        strokeWidth={2.5}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={loading}
                                        className={`${controlBtnBase} ${
                                            showResetPrimaryCue
                                                ? 'border-emerald-700/30 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-emerald-900/20 hover:from-emerald-600 hover:to-emerald-800'
                                                : 'border-slate-400/40 bg-gradient-to-b from-slate-500 to-slate-600 text-white shadow-slate-900/15 hover:from-slate-600 hover:to-slate-700'
                                        } disabled:opacity-50 ${showResetButtonPressHint ? controlBtnCue : ''}`}
                                    >
                                        {showResetButtonPressHint && (
                                            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
                                        )}
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 md:h-10 md:w-10">
                                            <RotateCcw className="h-5 w-5 md:h-5 md:w-5" />
                                        </span>
                                        <span>Reset</span>
                                        {showResetPrimaryCue && (
                                            <Hand
                                                className="h-7 w-7 animate-bounce text-amber-200 drop-shadow-md md:h-8 md:w-8"
                                                strokeWidth={2.5}
                                            />
                                        )}
                                    </button>
                                </>
                            ) : normalizedButtonStatus === 1 && !productionData.is_paused ? (
                                <button
                                    onClick={handleFinish}
                                    className={`${controlBtnBase} border-blue-700/30 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-blue-900/20 hover:from-blue-600 hover:to-blue-800 ${
                                        showFinishPressHint ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-white shadow-[0_0_24px_rgba(248,113,113,0.35)]' : ''
                                    }`}
                                >
                                    {showFinishPressHint && (
                                        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
                                    )}
                                    {loading ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        <>
                                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 md:h-10 md:w-10">
                                                <CheckCircle className="h-5 w-5 md:h-5 md:w-5" />
                                            </span>
                                            <span>Finish</span>
                                            {showFinishPressHint && (
                                                <Hand
                                                    className="h-7 w-7 animate-bounce text-amber-200 drop-shadow-md md:h-8 md:w-8"
                                                    strokeWidth={2.5}
                                                />
                                            )}
                                        </>
                                    )}
                                </button>
                            ) : null}
                        </div>
                        {actionStripBelowButtons}
                    </div>
                        </>
                </div>
            )}
        </div>
    );
};
