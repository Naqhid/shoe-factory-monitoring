import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, Play, Pause, CheckCircle, Loader2, X, RefreshCw, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL as API_BASE } from '../services/api';

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
    const [employeeName, setEmployeeName] = useState('');
    const [machineName, setMachineName] = useState('');
    const isInitializingRef = React.useRef(false);
    const [totalOutputToday, setTotalOutputToday] = useState(0);
    const [avgEfficiencyToday, setAvgEfficiencyToday] = useState('0');
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    // Parse URL params at component level for rendering access
    const pathParts = location.pathname.split('/');
    const queryParams = new URLSearchParams(location.search);
    let urlMachineId = pathParts.length >= 4 && pathParts[1] === 'mobile' ? decodeURIComponent(pathParts[2]) : null;
    let urlEmpId = pathParts.length >= 4 && pathParts[1] === 'mobile' ? decodeURIComponent(pathParts[3]) : null;
    if (!urlMachineId) urlMachineId = queryParams.get('machine');
    if (!urlEmpId) urlEmpId = queryParams.get('employee');

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Timer logic - increment actual_time counter every second when running
    useEffect(() => {
        if (!productionData || productionData.button_status !== 1 || productionData.is_paused) return;
        
        const counterInterval = setInterval(() => {
            setActualTimeCounter(prev => prev + 1);
        }, 1000); // Every 1 second
        
        return () => clearInterval(counterInterval);
    }, [productionData?.button_status, productionData?.is_paused]);

    // Sync actual_time to database every minute
    useEffect(() => {
        if (!productionData?.id || productionData.button_status !== 1 || productionData.is_paused) return;
        
        const syncInterval = setInterval(async () => {
            const actualMins = Math.floor(actualTimeCounter / 60);
            try {
                await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actual_time: actualMins })
                });
                setProductionData(prev => prev ? { ...prev, actual_time: actualMins } : null);
            } catch (error) {
                console.error('Timer sync error:', error);
            }
        }, 60000); // Every 1 minute
        
        return () => clearInterval(syncInterval);
    }, [productionData?.id, productionData?.button_status, productionData?.is_paused, actualTimeCounter, API_BASE]);

    // Fetch summary data from machine_centre_summary table
    const fetchSummaryData = async (machineId: string) => {
        setLoadingSummary(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`${API_BASE}/api/mobile-production/summary/${machineId}/date/${today}`);
            const result = await response.json();
            if (result.success && result.data) {
                setTotalOutputToday(result.data.total_output_pairs || 0);
                setAvgEfficiencyToday(parseFloat(result.data.avg_efficiency_percent || 0).toFixed(1));
            } else {
                setTotalOutputToday(0);
                setAvgEfficiencyToday('0');
            }
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoadingSummary(false);
        }
    };

    useEffect(() => {
        if (productionData?.machine_id) {
            fetchSummaryData(productionData.machine_id);
        }
    }, [productionData?.output_pairs, productionData?.machine_id]);

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
                            // Check for existing production record for today that's not finished
                    const today = new Date().toISOString().split('T')[0];
                    const existingRes = await fetch(`${API_BASE}/api/mobile-production/machine/${urlMachineId}/date/${today}`);
                    const existingData = await existingRes.json();
                    
                    // Find the most recent unfinished record (button_status !== 2)
                    const unfinishedRecord = existingData.data?.find((r: any) => r.button_status !== 2);
                    
                    if (unfinishedRecord) {
                        // Use the unfinished record ONLY if it's truly in progress (button_status = 1 or 3)
                        // If button_status = 2 (finished), create new record instead
                        const [empRes, macRes, wcRes, planningRes] = await Promise.all([
                            fetch(`${API_BASE}/api/masters/employees`).then(r => r.json()),
                            fetch(`${API_BASE}/api/masters/machine_centres`).then(r => r.json()),
                            fetch(`${API_BASE}/api/masters/work_centres`).then(r => r.json()),
                            fetch(`${API_BASE}/api/production-planning`).then(r => r.json())
                        ]);

                        const employee = empRes.data?.find((e: any) => e.id === parseInt(unfinishedRecord.emp_id));
                        const machine = macRes.data?.find((m: any) => (m.machine_id === urlMachineId || m.code === urlMachineId));
                        const workCentre = wcRes.data?.find((wc: any) => wc.id === unfinishedRecord.work_centre_id);

                        // Get target_pairs from planning if not set
                        let targetPairs = unfinishedRecord.target_pairs || 0;
                        if (targetPairs === 0) {
                            const matchingPlans = planningRes.data?.filter((p: any) => p.work_centre_id === unfinishedRecord.work_centre_id) || [];
                            const planning = matchingPlans.sort((a: any, b: any) => 
                                new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime()
                            )[0];
                            targetPairs = planning?.target_pairs_per_tray || 0;
                        }

                        setSessionStatus('active');
                        setQrData(urlMachineId);
                        setEmployeeName(employee?.name || employee?.emp_name || '');
                        setMachineName(machine?.name || urlMachineId);
                        setProductionData({
                            ...unfinishedRecord,
                            target_pairs: targetPairs,
                            work_centre_name: workCentre?.work_centre_name || workCentre?.name
                        });
                        setActualTimeCounter(unfinishedRecord.actual_time * 60);
                        toast.success('Loaded existing session');
                    } else {
                        // Create new session - use optimized endpoint
                        const response = await fetch(`${API_BASE}/api/mobile-production/init/${urlMachineId}/${urlEmpId}`);
                        const result = await response.json();

                        if (!result.success) {
                            toast.error(result.message || 'Failed to initialize');
                            return;
                        }

                        const { employee, machine, workCentre, targetMins, targetPairs, existingRecord } = result.data;

                        setSessionStatus('active');
                        setQrData(urlMachineId);
                        setEmployeeName(employee.name);
                        setMachineName(machine.name);

                        // Don't create record on page load - just set up UI
                        // Record will be created when START is clicked
                        const defaultData: ProductionData = {
                            prod_date: new Date().toISOString().split('T')[0],
                            work_centre_id: workCentre.id,
                            work_centre_name: workCentre.name,
                            machine_id: urlMachineId,
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

        // AUTO-DETECTION / POLLING MODE for specific machine
        if (urlMachineId && !urlEmpId) {
            setQrData(urlMachineId);
            const syncInterval = setInterval(async () => {
                try {
                    const sessionRes = await fetch(`${API_BASE}/api/mobile-session/active-for/${urlMachineId}`);
                    const sessionJson = await sessionRes.json();

                    if (sessionJson.success && sessionJson.data && sessionJson.data.emp_id) {
                        clearInterval(syncInterval);
                        toast.success(`Session Active: ${sessionJson.data.emp_name}`);
                        navigate(`/mobile/${encodeURIComponent(urlMachineId)}/${encodeURIComponent(sessionJson.data.emp_id)}`);
                    }
                } catch (e) { }
            }, 1000); // 1 second polling
            return () => clearInterval(syncInterval);
        }

        // GLOBAL POLLING MODE - WhatsApp Web style (when no machine/employee specified)
        if (!urlMachineId && !urlEmpId) {
            const globalSyncInterval = setInterval(async () => {
                try {
                    const sessionRes = await fetch(`${API_BASE}/api/mobile-session/latest-active`);
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
    }, [location.pathname, API_BASE, navigate, urlMachineId, urlEmpId]);


    const initializeProduction = async (machineId: string, empCode: string, workCentreId: number = 1, targetMins?: number, targetPairs?: number, workCentreName?: string) => {
        if (isInitializingRef.current) return;
        isInitializingRef.current = true;
        setLoading(true);
        try {
            // Always fetch from optimized endpoint to get latest data
            const initResponse = await fetch(`${API_BASE}/api/mobile-production/init/${machineId}/${empCode}`);
            const initResult = await initResponse.json();
            if (!initResult.success) {
                toast.error(initResult.message || 'Failed to initialize');
                return;
            }
            // Use fetched values, override with provided values if they exist
            targetMins = targetMins || initResult.data.targetMins;
            targetPairs = targetPairs || initResult.data.targetPairs;
            workCentreName = workCentreName || initResult.data.workCentre.name;
            workCentreId = initResult.data.machine.work_centre_id || workCentreId;

            const empRes = await fetch(`${API_BASE}/api/masters/employees/emp_id/${empCode}`);
            const empData = await empRes.json();
            if (!empData.success || !empData.data) {
                toast.error(`Employee ${empCode} not found`);
                return;
            }

            const newData: ProductionData = {
                prod_date: new Date().toISOString().split('T')[0],
                work_centre_id: workCentreId,
                work_centre_name: workCentreName || `WC-${workCentreId}`,
                machine_id: machineId,
                emp_id: empData.data.id,
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

            const response = await fetch(`${API_BASE}/api/mobile-production`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            });

            const result = await response.json();
            if (result.success) {
                setProductionData({ ...newData, id: result.data.id });
                setActualTimeCounter(0);
                toast.success('Production initialized');
            }
        } catch (error) {
            console.error('Error initializing production:', error);
            toast.error('Failed to initialize production');
        } finally {
            setLoading(false);
            isInitializingRef.current = false;
        }
    };

    const handleStart = async () => {
        // If no production data ID (first time) or after FINISH, create new record
        if (!productionData?.id || productionData.button_status === 2) {
            if (!urlEmpId) {
                toast.error('Employee information missing');
                return;
            }
            
            setLoading(true);
            try {
                // Create new production record in database
                const response = await fetch(`${API_BASE}/api/mobile-production`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...productionData,
                        button_status: 1 // Start immediately
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    setProductionData({ ...productionData!, id: result.data.id, button_status: 1, is_paused: false });
                    setActualTimeCounter(0);
                    toast.success('Production started');
                } else {
                    toast.error('Failed to start production');
                }
            } catch (error) {
                toast.error('Failed to start production');
            } finally {
                setLoading(false);
            }
            return;
        }
        
        if (!productionData?.id) return;
        
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ button_status: 1 })
            });
            const result = await response.json();
            if (result.success) {
                setProductionData({ ...productionData, button_status: 1, is_paused: false });
                toast.success('Production started');
            }
        } catch (error) {
            toast.error('Failed to start production');
        } finally {
            setLoading(false);
        }
    };

    const handlePause = async () => {
        if (!productionData?.id) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ button_status: 3 })
            });
            const result = await response.json();
            if (result.success) {
                setProductionData({ ...productionData, is_paused: true, button_status: 3 });
                toast.success('Production paused');
            }
        } catch (error) {
            toast.error('Failed to pause production');
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
        try {
            const outputPairs = productionData.target_pairs || 0;
            const response = await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    button_status: 2,
                    output_pairs: outputPairs
                })
            });
            const result = await response.json();
            if (result.success) {
                setProductionData({ ...productionData, button_status: 2, output_pairs: outputPairs });
                toast.success('Production finished - Click RESET for next cycle');
            }
        } catch (error) {
            toast.error('Failed to finish production');
        } finally {
            setLoading(false);
        }
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
            toast.success('Ready for next cycle - Click START to begin');
        } else {
            setActualTimeCounter(0);
            setProductionData({ ...productionData, actual_time: 0, button_status: 3, is_paused: false });
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
        
        // Paused/Idle state
        if (productionData.is_paused || productionData.button_status === 3) {
            return { label: 'Idle', color: 'text-gray-700', bgColor: 'bg-gray-400' };
        }
        
        // Use efficiency from summary table
        const efficiency = parseFloat(avgEfficiencyToday || '0');
        if (efficiency < 80) {
            return { label: 'Low', color: 'text-white', bgColor: 'bg-red-500' };
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

    // WAITING STATE
    if (sessionStatus === 'waiting' && !productionData) {
        // Build correct base URL with subfolder for GitHub Pages
        const baseUrl = window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        const activationUrl = sessionId
            ? `${baseUrl}/line_setup_form?session=${sessionId}${qrData ? `&machine=${qrData}` : ''}`
            : '';

        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-sm text-gray-400 mb-8 flex items-center justify-center gap-2">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        {urlMachineId && !urlEmpId
                            ? `Waiting for supervisor scan on ${urlMachineId}...`
                            : !urlMachineId && !urlEmpId
                                ? 'Waiting for QR scan from another device...'
                                : 'Waiting for connection...'
                        }
                    </div>
                </div>
            </div>
        );
    }

    // DASHBOARD STATE
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6">
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
                <div className="max-w-4xl mx-auto">
                        <>
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

                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl shadow-xl p-4 md:p-6">
                        <h1 className="text-xl md:text-2xl font-bold text-center mb-3">MACHINE CENTRE PRODUCTION</h1>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
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
                                    <p className="font-semibold truncate">{productionData.machine_id}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                <div className="min-w-0">
                                    <p className="text-xs opacity-80">Operator</p>
                                    <p className="font-semibold truncate">{employeeName || productionData.emp_id}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                <div className="min-w-0">
                                    <p className="text-xs opacity-80">Date & Time</p>
                                    <p className="font-semibold text-xs">{currentTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Section */}
                    <div className="bg-white shadow-xl p-4 md:p-6 border-x border-gray-200">
                        <h2 className="text-base md:text-lg font-bold text-gray-800 mb-3 md:mb-4 uppercase tracking-wide">Production Metrics</h2>
                        
                        {/* Progress Bar */}
                        {productionData.button_status === 1 && !productionData.is_paused && productionData.target_mins > 0 && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Progress</span>
                                    <span>{Math.min(100, Math.round((actualTimeCounter / 60 / productionData.target_mins) * 100))}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${
                                            (actualTimeCounter / 60) > productionData.target_mins 
                                                ? 'bg-red-500' 
                                                : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(100, (actualTimeCounter / 60 / productionData.target_mins) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-6 rounded-xl border-2 border-blue-200 shadow-sm">
                                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Target Time</p>
                                <p className="text-3xl md:text-5xl font-bold text-blue-900">{(productionData.target_mins || 0).toFixed(1)}</p>
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
                                    {Math.floor(actualTimeCounter / 60)}<span className="text-2xl md:text-3xl">m</span>
                                    <span className="text-2xl md:text-3xl font-bold text-purple-700 ml-2">{actualTimeCounter % 60}s</span>
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 md:p-6 rounded-xl border-2 border-green-200 shadow-sm">
                                <p className="text-xs font-semibold text-green-700 uppercase mb-1">Target Pairs</p>
                                <p className="text-3xl md:text-5xl font-bold text-green-900">{productionData.target_pairs || 0}</p>
                                <p className="text-xs text-green-600 mt-1">pairs</p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-6 rounded-xl border-2 border-orange-200 shadow-sm">
                                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Total Output</p>
                                {loadingSummary ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto my-4" />
                                ) : (
                                    <>
                                        <p className="text-3xl md:text-5xl font-bold text-orange-900">{totalOutputToday}</p>
                                        <p className="text-xs text-orange-600 mt-1">pairs (today)</p>
                                    </>
                                )}
                            </div>
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 md:p-6 rounded-xl border-2 border-indigo-200 shadow-sm">
                                <p className="text-xs font-semibold text-indigo-700 uppercase mb-1">Avg Efficiency</p>
                                {loadingSummary ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto my-4" />
                                ) : (
                                    <>
                                        <p className="text-3xl md:text-5xl font-bold text-indigo-900">{avgEfficiencyToday}%</p>
                                        <p className="text-xs text-indigo-600 mt-1">percentage</p>
                                    </>
                                )}
                            </div>
                            <div className={`p-4 md:p-6 rounded-xl border-2 shadow-sm ${getStatusBgColor()} ${getStatusColor()}`}>
                                <p className="text-xs font-semibold uppercase mb-1 opacity-90">Status</p>
                                <p className="text-3xl md:text-5xl font-bold">{getStatusText()}</p>
                                <p className="text-xs mt-1 opacity-90">current</p>
                            </div>
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="bg-white shadow-xl rounded-b-2xl p-4 md:p-6 border-x border-b border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            {productionData.button_status === 3 || productionData.button_status === 2 ? (
                                <>
                                    <button
                                        onClick={handleStart}
                                        disabled={loading || productionData.button_status === 2}
                                        className="md:col-span-2 bg-gradient-to-r from-green-600 to-green-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-green-700 hover:to-green-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Play className="h-5 w-5" />START</>}
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="bg-gradient-to-r from-gray-500 to-gray-600 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-gray-600 hover:to-gray-700 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw className="h-5 w-5" />RESET
                                    </button>
                                </>
                            ) : productionData.button_status === 1 && !productionData.is_paused ? (
                                <>
                                    <button
                                        onClick={handlePause}
                                        disabled={loading}
                                        className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-yellow-600 hover:to-yellow-700 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Pause className="h-5 w-5" />PAUSE</>}
                                    </button>
                                    <button
                                        onClick={handleFinish}
                                        disabled={loading}
                                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-blue-700 hover:to-blue-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-5 w-5" />FINISH</>}
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="bg-gradient-to-r from-gray-500 to-gray-600 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-gray-600 hover:to-gray-700 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw className="h-5 w-5" />RESET
                                    </button>
                                </>
                            ) : productionData.is_paused ? (
                                <>
                                    <button
                                        onClick={handleStart}
                                        disabled={loading}
                                        className="md:col-span-2 bg-gradient-to-r from-green-600 to-green-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-green-700 hover:to-green-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Play className="h-5 w-5" />RESUME</>}
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="bg-gradient-to-r from-gray-500 to-gray-600 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-gray-600 hover:to-gray-700 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw className="h-5 w-5" />RESET
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
