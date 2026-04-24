import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, Play, CheckCircle, Loader2, X, RefreshCw, RotateCcw, AlertTriangle, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { StoppageReasonModal } from './StoppageReasonModal';

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
    const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001`;
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
            } catch {}
        };
        fetchMachineName();
    }, [machineId, API_BASE]);

    React.useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await apiFetch(`${API_BASE}/api/mobile-session/active-for/${machineId}`);
                const json = await res.json();
                if (json.success && json.data?.emp_code) {
                    clearInterval(interval);
                    onSessionActive(json.data.emp_code, json.data.session_id);
                }
            } catch {}
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
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);
    const [showStoppageModal, setShowStoppageModal] = useState(false);
    const overTargetToastShownRef = React.useRef(false);
    const hasUserInteractedRef = React.useRef(false);
    const alertAudioContextRef = React.useRef<AudioContext | null>(null);
    const alertToneIntervalRef = React.useRef<number | null>(null);
    const alertToneTimeoutRef = React.useRef<number | null>(null);
    const startReminderAnchorRef = React.useRef<number | null>(null);
    const [machineBusyRecord, setMachineBusyRecord] = useState<{ emp_id: string | number; employee_name?: string; machine_id: string } | null>(null);
    const [isSessionAuthorizedController, setIsSessionAuthorizedController] = useState(false);
    const [hasTabSessionBinding, setHasTabSessionBinding] = useState(false);
    
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
    const stopAlertSound = React.useCallback(() => {
        if (alertToneIntervalRef.current) {
            window.clearInterval(alertToneIntervalRef.current);
            alertToneIntervalRef.current = null;
        }
        if (alertToneTimeoutRef.current) {
            window.clearTimeout(alertToneTimeoutRef.current);
            alertToneTimeoutRef.current = null;
        }
        if (alertAudioContextRef.current) {
            alertAudioContextRef.current.close().catch(() => {});
            alertAudioContextRef.current = null;
        }
    }, []);

    const playAlertSound = React.useCallback(() => {
        try {
            if (!hasUserInteractedRef.current) return;
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;

            stopAlertSound();
            const audioCtx: AudioContext = new AudioCtx();
            alertAudioContextRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }

            const playBeep = () => {
                const now = audioCtx.currentTime;
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(900, now);

                gainNode.gain.setValueAtTime(0.0001, now);
                gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.start(now);
                oscillator.stop(now + 0.17);
            };

            playBeep();
            alertToneIntervalRef.current = window.setInterval(playBeep, 320);
            alertToneTimeoutRef.current = window.setTimeout(() => {
                stopAlertSound();
            }, 3000);
        } catch (error) {
            console.warn('Alert sound playback blocked or unavailable:', error);
        }
    }, [stopAlertSound]);

    useEffect(() => {
        return () => stopAlertSound();
    }, [stopAlertSound]);

    // Unlock alert sound after first user gesture (browser autoplay policies).
    useEffect(() => {
        const unlockAudio = () => {
            hasUserInteractedRef.current = true;
            if (alertAudioContextRef.current?.state === 'suspended') {
                alertAudioContextRef.current.resume().catch(() => {});
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
    }, []);

    useEffect(() => {
        if (!productionData || productionData.button_status !== 1 || productionData.is_paused) {
            overTargetToastShownRef.current = false;
            stopAlertSound();
            return;
        }
        const targetMins = Number(productionData.target_mins || 0);
        if (targetMins <= 0) {
            stopAlertSound();
            return;
        }
        const actualMins = actualTimeCounter / 60;
        const exceeded = actualMins > targetMins;
        if (!exceeded) {
            overTargetToastShownRef.current = false;
            stopAlertSound();
            return;
        }
        if (overTargetToastShownRef.current) return;
        overTargetToastShownRef.current = true;
        playAlertSound();
        toast.error('Target time exceeded — tap FINISH when your cycle is complete.', {
            duration: 8000,
            id: 'mobile-over-target',
        });
    }, [
        productionData?.id,
        productionData?.button_status,
        productionData?.is_paused,
        productionData?.target_mins,
        actualTimeCounter,
        playAlertSound,
        stopAlertSound,
    ]);

    // Repeating reminder every 10 minutes when production is not running.
    // Covers cases like: cycle finished but operator forgets RESET/START.
    useEffect(() => {
        if (!productionData || initializing || loading) {
            startReminderAnchorRef.current = null;
            return;
        }

        const needsStartReminder =
            (productionData.button_status === 3 && !productionData.is_paused) ||
            productionData.button_status === 2;

        if (!needsStartReminder) {
            startReminderAnchorRef.current = null;
            return;
        }

        if (startReminderAnchorRef.current === null) {
            startReminderAnchorRef.current = Date.now();
        }

        const REMINDER_MS = 10 * 60 * 1000;

        const tick = () => {
            if (startReminderAnchorRef.current === null) return;
            const elapsed = Date.now() - startReminderAnchorRef.current;
            if (elapsed < REMINDER_MS) return;

            playAlertSound();
            toast.error(
                productionData.button_status === 2
                    ? 'Cycle completed. Tap RESET, then START for next cycle.'
                    : 'Production not started. Tap START to begin cycle.',
                {
                    duration: 8000,
                    id: 'mobile-start-reminder',
                }
            );
            startReminderAnchorRef.current = Date.now();
        };

        const intervalId = window.setInterval(tick, 30000);
        return () => window.clearInterval(intervalId);
    }, [
        productionData?.id,
        productionData?.button_status,
        productionData?.is_paused,
        initializing,
        loading,
        playAlertSound,
    ]);

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
                    return;
                } else {
                    setTotalOutputToday(0);
                    setAvgEfficiencyToday('0');
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
            await fetchSummaryData(productionData.machine_id);
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
                        const [empRes, macRes, wcRes, planningRes, initRes] = await Promise.all([
                            apiFetch(`${API_BASE}/api/masters/employees`).then(r => r.json()),
                            apiFetch(`${API_BASE}/api/masters/machine_centres`).then(r => r.json()),
                            apiFetch(`${API_BASE}/api/masters/work_centres`).then(r => r.json()),
                            apiFetch(`${API_BASE}/api/production-planning`).then(r => r.json()),
                            apiFetch(`${API_BASE}/api/mobile-production/init/${effectiveMachineId}/${urlEmpId}`).then(r => r.json())
                        ]);

                        const employee = empRes.data?.find((e: any) =>
                            e.id === parseInt(activeRecord.emp_id) ||
                            e.code === activeRecord.emp_id ||
                            e.emp_id === activeRecord.emp_id
                        );
                        const machine = macRes.data?.find((m: any) => (m.machine_id === effectiveMachineId || m.code === urlMachineId));
                        const workCentre = wcRes.data?.find((wc: any) => wc.id === activeRecord.work_centre_id);

                        // Get target_pairs from planning if not set
                        let targetPairs = activeRecord.target_pairs || 0;
                        if (targetPairs === 0) {
                            const matchingPlans = planningRes.data?.filter((p: any) => p.work_centre_id === activeRecord.work_centre_id) || [];
                            const planning = matchingPlans.sort((a: any, b: any) => 
                                new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime()
                            )[0];
                            targetPairs = planning?.target_pairs_per_tray || 0;
                        }

                        // Always refresh target_mins from latest routing for this machine/work-centre.
                        // This prevents stale unfinished records (e.g. old 16.6) from overriding current routing.
                        const refreshedTargetMins =
                            initRes?.success && typeof initRes?.data?.targetMins !== 'undefined'
                                ? Number(initRes.data.targetMins)
                                : Number(activeRecord.target_mins || 0);

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
                            target_mins: refreshedTargetMins,
                            target_pairs: targetPairs,
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

                        const { employee, machine, workCentre, targetMins, targetPairs, existingRecord } = result.data;

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
                            target_mins: targetMins,
                            target_pairs: targetPairs,
                            start_time: null,
                            finish_time: null,
                            idle_start_time: null,
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
                    const sessionRes = await apiFetch(`${API_BASE}/api/mobile-session/latest-active`);
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
    }, [location.pathname, location.search, API_BASE, navigate, urlMachineId, urlEmpId, sessionToken]);


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

    const handleStart = async () => {
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
                const result = await withRetry(async () => {
                    const response = await apiFetch(`${API_BASE}/api/mobile-production`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...productionData, button_status: 1 })
                    });
                    const data = await response.json();
                    if (!data.success) throw new Error(data.message || 'Failed to start');
                    return data;
                });
                setProductionData({ ...productionData!, id: result.data.id, button_status: 1, is_paused: false });
                setActualTimeCounter(0);
                runningSinceMsRef.current = Date.now();
                toast.success('Production started');
            } catch (error) {
                // UI stays in idle state — no sync issue since we never updated state
                toast.error('Failed to start production. Check network and try again.');
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
        if (!productionData?.id) return;
        setShowFinishConfirm(true);
    };

    const confirmFinish = async () => {
        if (!productionData?.id) return;
        setShowFinishConfirm(false);
        setLoading(true);
        const outputPairs = productionData.target_pairs || 0;
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
                        // Ghost cycle or validation error - store message and stop retrying
                        if (data.message?.includes('Cannot finish') || data.message?.includes('Minimum cycle time')) {
                            validationErrorMsg = data.message;
                            throw new Error('VALIDATION_ERROR'); // Stop retrying
                        }
                        throw new Error(data.message || 'Failed');
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
                // Show simple toast for validation errors
                toast.error(validationErrorMsg, { duration: 5000, id: 'validation-error' });
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
            // After FINISH, reset to initial state without database record
            const resetData: ProductionData = {
                ...productionData,
                id: undefined, // Remove ID so next START creates new record
                output_pairs: 0,
                actual_time: 0,
                button_status: 3,
                is_paused: false,
                start_time: null,
                finish_time: null,
                idle_start_time: null
            };
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

    const handleLogout = () => {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('app_authenticated');
            localStorage.removeItem('mobile_authenticated');
            localStorage.removeItem('user_info');
        }
        navigate('/');
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

        // Paused/Idle state
        if (productionData.is_paused || productionData.button_status === 3) {
            return { label: 'Idle', color: 'text-gray-700', bgColor: 'bg-gray-400' };
        }

        // Use efficiency from summary table
        const efficiency = parseFloat(avgEfficiencyToday || '0');
        if (efficiency < 70) {
            return { label: 'Low', color: 'text-white', bgColor: 'bg-red-500' };
        } else if (efficiency < 90) {
            return { label: 'Average', color: 'text-white', bgColor: 'bg-orange-500' };
        }
        return { label: 'On-track', color: 'text-white', bgColor: 'bg-green-500' };
    };

    const getStatusText = () => {
        return calculateStatus().label;
    };

    const getStatusColor = () => {
        return calculateStatus().color;
    };

    const getStatusBgColor = () => {
        return calculateStatus().bgColor;
    };

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

    const isTargetTimeExceeded =
        !!productionData &&
        productionData.button_status === 1 &&
        !productionData.is_paused &&
        Number(productionData.target_mins || 0) > 0 &&
        actualTimeCounter / 60 > Number(productionData.target_mins || 0);

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
                    {/* Full-screen flashing alert overlay when time exceeds target */}
                    {isTargetTimeExceeded && (
                        <div
                            className="fixed inset-0 z-40 pointer-events-none animate-pulse bg-red-600/35"
                            aria-hidden
                        />
                    )}
                    {/* Finish Confirmation Dialog */}
                    {showFinishConfirm && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                                <div className="mb-6">
                                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-10 h-10 text-blue-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Finish Production?</h2>
                                    <p className="text-gray-600">Are you sure you want to complete this production cycle?</p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowFinishConfirm(false)}
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-6 rounded-xl font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmFinish}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
                                    >
                                        Finish
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stoppage Reason Modal */}
                    {showStoppageModal && (
                        <StoppageReasonModal
                            onConfirm={confirmPause}
                            onCancel={() => setShowStoppageModal(false)}
                        />
                    )}

                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl shadow-xl">
                        <button
                            onClick={() => setHeaderExpanded(!headerExpanded)}
                            className="relative w-full p-4 hover:bg-white/5 transition-colors"
                        >
                            <div className="flex flex-col items-center justify-center gap-2 w-full text-center">
                                <h1 className="text-xl md:text-2xl font-bold">MACHINE CENTRE PRODUCTION</h1>
                                {!headerExpanded && (
                                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full animate-pulse">Tap to view details</span>
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
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm px-4 pb-4">
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Process Name</p>
                                        <p className="font-semibold truncate">{machineName || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Line Name</p>
                                        <p className="font-semibold truncate">{productionData.work_centre_name || `WC-${productionData.work_centre_id}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Machine ID</p>
                                        <p className="font-semibold truncate">{resolvedMachineId || productionData.machine_id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Operator</p>
                                        <p className="font-semibold truncate">
                                            {formatOperatorDisplay(employeeName, productionData.emp_id)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                    <div className="min-w-0">
                                        <p className="text-xs opacity-80">Date & Time</p>
                                        <p className="font-semibold text-xs">{currentTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-300/50 rounded-lg p-2 transition-colors"
                                >
                                    <LogOut className="h-4 w-4 text-red-100" />
                                    <span className="text-sm font-semibold text-white">Logout</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Metrics Section */}
                    <div className="bg-white shadow-xl p-4 md:p-6 border-x border-gray-200">
                        <h2 className="text-base md:text-lg font-bold text-gray-800 mb-3 md:mb-4 uppercase tracking-wide">Production Status</h2>
                        
                        {/* Progress Bar — red when actual time exceeds target */}
                        {productionData.button_status === 1 && !productionData.is_paused && productionData.target_mins > 0 && (
                            <div className="mb-4">
                                {isTargetTimeExceeded && (
                                    <div role="alert" className="mb-3 flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2.5 text-center shadow-md">
                                        <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" aria-hidden />
                                        <p className="text-sm font-bold text-red-800">Target time exceeded — tap <span className="whitespace-nowrap">FINISH</span> when done</p>
                                    </div>
                                )}
                                <div
                                    className={`rounded-lg p-1 transition-shadow duration-300 ${
                                        isTargetTimeExceeded
                                            ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-white shadow-[0_0_0_3px_rgba(239,68,68,0.35)]'
                                            : ''
                                    }`}
                                >
                                    <div className="flex justify-between text-xs text-gray-600 mb-1 px-0.5">
                                        <span>Progress</span>
                                        <span className={isTargetTimeExceeded ? 'font-bold text-red-600' : ''}>
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
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-6 rounded-xl border-2 border-blue-200 shadow-sm">
                                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Target Time</p>
                                <p className="text-3xl md:text-5xl font-bold text-blue-900">{Number(productionData.target_mins || 0).toFixed(1)}</p>
                                <p className="text-xs text-blue-600 mt-1">mins</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 md:p-6 rounded-xl border-2 border-purple-200 shadow-sm relative">
                                {productionData.button_status === 1 && !productionData.is_paused && (
                                    <div className="absolute top-2 right-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                    </div>
                                )}
                                <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Actual Time</p>
                                <p className="text-3xl md:text-5xl font-bold text-purple-900">
                                    <span>{Math.floor(actualTimeCounter / 60)}</span><span className="text-2xl md:text-3xl">m</span>
                                    <span className="text-2xl md:text-3xl font-bold text-purple-700 ml-2"><span>{actualTimeCounter % 60}</span>s</span>
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 md:p-6 rounded-xl border-2 border-green-200 shadow-sm">
                                <p className="text-xs font-semibold text-green-700 uppercase mb-1">Target Pairs / BIN</p>
                                <p className="text-3xl md:text-5xl font-bold text-green-900"><span>{productionData.target_pairs || 0}</span></p>
                                <p className="text-xs text-green-600 mt-1">pairs</p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-6 rounded-xl border-2 border-orange-200 shadow-sm relative">
                                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Total Output</p>
                                {loadingSummary ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto my-4" />
                                ) : (
                                    <>
                                        <p className="text-3xl md:text-5xl font-bold text-orange-900"><span>{totalOutputToday}</span></p>
                                        <p className="text-xs text-orange-600 mt-1">pairs (today)</p>
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
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 md:p-6 rounded-xl border-2 border-indigo-200 shadow-sm">
                                <p className="text-xs font-semibold text-indigo-700 uppercase mb-1">Avg Efficiency</p>
                                {loadingSummary ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto my-4" />
                                ) : (
                                    <>
                                        <p className="text-3xl md:text-5xl font-bold text-indigo-900"><span>{avgEfficiencyToday}</span>%</p>
                                        <p className="text-xs text-indigo-600 mt-1">percentage</p>
                                    </>
                                )}
                            </div>
                            <div className={`p-4 md:p-6 rounded-xl border-2 shadow-sm ${getStatusBgColor()} ${getStatusColor()}`}>
                                <p className="text-xs font-semibold uppercase mb-1 opacity-90">Status</p>
                                <p className="text-3xl md:text-5xl font-bold"><span>{getStatusText()}</span></p>
                                <p className="text-xs mt-1 opacity-90">current</p>
                            </div>
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="bg-white shadow-xl rounded-b-2xl p-4 md:p-6 border-x border-b border-gray-200">
                        <div className="flex gap-3 md:gap-4">
                            {productionData.button_status === 3 || productionData.button_status === 2 ? (
                                <>
                                    <button
                                        onClick={handleStart}
                                        disabled={loading || productionData.button_status === 2}
                                        title={productionData.button_status === 2 ? "Cycle finished. Click RESET to start a new cycle." : ""}
                                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-green-700 hover:to-green-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Play className="h-5 w-5" /><span>START</span></>}
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-gray-600 hover:to-gray-700 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw className="h-5 w-5" /><span>RESET</span>
                                    </button>
                                </>
                            ) : productionData.button_status === 1 && !productionData.is_paused ? (
                                <>
                                    <button
                                        onClick={handleFinish}
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-blue-700 hover:to-blue-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-5 w-5" /><span>FINISH</span></>}
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                        </>
                </div>
            )}
        </div>
    );
};
