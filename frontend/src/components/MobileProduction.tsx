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
    target_mins: number;
    target_pairs: number;
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
    const [productionData, setProductionData] = useState<ProductionData | null>(null);
    const [qrData, setQrData] = useState('');
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [actualTimeCounter, setActualTimeCounter] = useState(0);
    const [employeeName, setEmployeeName] = useState('');
    const [machineName, setMachineName] = useState('');
    const [showTestHelpers, setShowTestHelpers] = useState(false);

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

    // Session Initialization and Polling
    useEffect(() => {
        if (urlMachineId && urlEmpId) {
            const resolveAndInitialize = async () => {
                setLoading(true);
                try {
                    // First check if there's an existing session in database
                    const existingSessionRes = await fetch(`${API_BASE}/api/machine-centre/status/${urlMachineId}`);
                    const existingSession = await existingSessionRes.json();
                    
                    if (existingSession.success && existingSession.data) {
                        // Load existing session
                        const [empRes, macRes, wcRes] = await Promise.all([
                            fetch(`${API_BASE}/api/masters/employees`).then(r => r.json()),
                            fetch(`${API_BASE}/api/masters/machine_centres`).then(r => r.json()),
                            fetch(`${API_BASE}/api/masters/work_centres`).then(r => r.json())
                        ]);

                        const employee = empRes.data?.find((e: any) => e.id === existingSession.data.emp_id);
                        const machine = macRes.data?.find((m: any) => (m.machine_id === urlMachineId || m.code === urlMachineId));
                        const workCentre = wcRes.data?.find((wc: any) => wc.id === existingSession.data.work_centre_id);

                        setSessionStatus('active');
                        setQrData(urlMachineId);
                        setEmployeeName(employee?.name || employee?.emp_name || '');
                        setMachineName(machine?.name || urlMachineId);
                        setProductionData({
                            ...existingSession.data,
                            work_centre_name: workCentre?.work_centre_name || workCentre?.name
                        });
                        setActualTimeCounter(existingSession.data.actual_time * 60); // Convert mins to seconds
                    } else {
                        // Create new session
                        const [empRes, macRes] = await Promise.all([
                            fetch(`${API_BASE}/api/masters/employees`).then(r => r.json()),
                            fetch(`${API_BASE}/api/masters/machine_centres`).then(r => r.json())
                        ]);

                        const employee = empRes.data?.find((e: any) => e.code === urlEmpId);
                        const machine = macRes.data?.find((m: any) => (m.machine_id === urlMachineId || m.code === urlMachineId));

                        if (!employee) {
                            toast.error(`Employee ${urlEmpId} not found`);
                            return;
                        }

                        setSessionStatus('active');
                        setQrData(urlMachineId);
                        setEmployeeName(employee.name);
                        setMachineName(machine?.name || urlMachineId);

                        initializeProduction(urlMachineId, urlEmpId, machine?.work_centre_id || 1);
                    }
                } catch (e) {
                    toast.error('Failed to load setup data');
                } finally {
                    setLoading(false);
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


    const initializeProduction = async (machineId: string, empCode: string, workCentreId: number = 1) => {
        setLoading(true);
        try {
            // Fetch employee, work centre, production routing, and production planning data
            const [empRes, wcRes, routingRes, planningRes] = await Promise.all([
                fetch(`${API_BASE}/api/masters/employees/emp_id/${empCode}`).then(r => r.json()),
                fetch(`${API_BASE}/api/masters/work_centres`).then(r => r.json()),
                fetch(`${API_BASE}/api/production-routing`).then(r => r.json()),
                fetch(`${API_BASE}/api/production-planning`).then(r => r.json())
            ]);

            if (!empRes.success || !empRes.data) {
                toast.error(`Employee ${empCode} not found`);
                return;
            }

            const empDbId = empRes.data.id;
            const workCentre = wcRes.data?.find((wc: any) => wc.id === workCentreId);
            const workCentreName = workCentre?.work_centre_name || workCentre?.name || `WC-${workCentreId}`;

            // Find routing - get most recent and fetch its lines
            const mostRecentRouting = routingRes.data?.sort((a: any, b: any) => 
                new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
            )[0];
            
            let mins12Prs = 16.6;
            if (mostRecentRouting?.id) {
                const linesRes = await fetch(`${API_BASE}/api/production-routing/${mostRecentRouting.id}`);
                const linesData = await linesRes.json();
                if (linesData.success && linesData.data?.lines?.length > 0) {
                    // Sum all mins_12_prs_box from all lines
                    mins12Prs = linesData.data.lines.reduce((sum: number, line: any) => 
                        sum + (parseFloat(line.mins_12_prs_box) || 0), 0
                    );
                }
            } // Use mins_12_prs field directly

            // Find most recent planning for this work centre
            const matchingPlans = planningRes.data?.filter((p: any) => p.work_centre_id === workCentreId) || [];
            const planning = matchingPlans.sort((a: any, b: any) => 
                new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime()
            )[0];
            const pairsPerTray = planning?.target_pairs_per_tray || 0;

            const newData: ProductionData = {
                prod_date: new Date().toISOString().split('T')[0],
                work_centre_id: workCentreId,
                work_centre_name: workCentreName,
                machine_id: machineId,
                emp_id: empDbId,
                output_pairs: 0,
                target_mins: mins12Prs,
                target_pairs: pairsPerTray,
                start_time: null,
                finish_time: null,
                idle_start_time: null,
                actual_time: 0,
                button_status: 3, // Start in stopped state
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
        }
    };

    const handleStart = async () => {
        if (!productionData?.id) return;
        setLoading(true);
        try {
            // Use mobile-production endpoint instead
            const endpoint = productionData.button_status === 3 ? 'start' : 'resume';
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
        setLoading(true);
        try {
            // Auto-set output to target pairs
            const outputPairs = productionData.target_pairs || 12;
            const response = await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    button_status: 2,
                    output_pairs: productionData.output_pairs + outputPairs
                })
            });
            const result = await response.json();
            if (result.success) {
                setProductionData({ ...productionData, button_status: 2, output_pairs: productionData.output_pairs + outputPairs });
                toast.success('Production finished');
            }
        } catch (error) {
            toast.error('Failed to finish production');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        setActualTimeCounter(0);
        if (productionData) {
            try {
                const [planningRes, routingRes] = await Promise.all([
                    fetch(`${API_BASE}/api/production-planning`),
                    fetch(`${API_BASE}/api/production-routing`)
                ]);
                const [planningData, routingData] = await Promise.all([planningRes.json(), routingRes.json()]);
                
                // Get latest planning
                const matchingPlans = planningData.data?.filter((p: any) => p.work_centre_id === productionData.work_centre_id) || [];
                const planning = matchingPlans.sort((a: any, b: any) => 
                    new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime()
                )[0];
                const updatedTargetPairs = planning?.target_pairs_per_tray || productionData.target_pairs;
                
                // Get most recent routing and fetch its lines
                const mostRecentRouting = routingData.data?.sort((a: any, b: any) => 
                    new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
                )[0];
                
                let updatedTargetMins = productionData.target_mins;
                if (mostRecentRouting?.id) {
                    const linesRes = await fetch(`${API_BASE}/api/production-routing/${mostRecentRouting.id}`);
                    const linesData = await linesRes.json();
                    if (linesData.success && linesData.data?.lines?.length > 0) {
                        // Sum all mins_12_prs_box from all lines
                        updatedTargetMins = linesData.data.lines.reduce((sum: number, line: any) => 
                            sum + (parseFloat(line.mins_12_prs_box) || 0), 0
                        );
                    }
                }
                
                setProductionData({ 
                    ...productionData, 
                    actual_time: 0, 
                    button_status: 3, 
                    is_paused: false,
                    target_pairs: updatedTargetPairs,
                    target_mins: updatedTargetMins
                });
            } catch (error) {
                setProductionData({ ...productionData, actual_time: 0, button_status: 3, is_paused: false });
            }
        }
        toast.success('Timer reset');
    };

    const calculateEfficiency = () => {
        if (!productionData || !productionData.target_mins || productionData.target_mins === 0) return 0;
        const actualMins = Math.floor(actualTimeCounter / 60);
        return Math.round((actualMins / productionData.target_mins) * 100);
    };

    const calculateStatus = () => {
        if (!productionData) return { label: 'On-track', color: 'text-white', bgColor: 'bg-green-500' };
        
        // Initial state - always on-track
        if (productionData.actual_time === 0 && actualTimeCounter === 0) {
            return { label: 'On-track', color: 'text-white', bgColor: 'bg-green-500' };
        }
        
        if (productionData.is_paused || productionData.button_status === 3) {
            return { label: 'Idle', color: 'text-gray-700', bgColor: 'bg-gray-400' };
        }
        
        if (productionData.updated_at) {
            const idleMinutes = Math.floor((Date.now() - new Date(productionData.updated_at).getTime()) / 60000);
            if (idleMinutes >= 5) {
                return { label: 'Idle', color: 'text-gray-700', bgColor: 'bg-gray-400' };
            }
        }
        
        const efficiency = calculateEfficiency();
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

        // Demo Mode Handler
        const handleDemoConnect = () => {
            setSessionStatus('active');
            setQrData('DEMO-MACHINE-01');
            const demoData: ProductionData = {
                id: 999,
                prod_date: new Date().toISOString().split('T')[0],
                work_centre_id: 1,
                machine_id: 'DEMO-MACHINE-01',
                emp_id: 1,
                output_pairs: 45,
                target_mins: 60,
                start_time: '09:00:00',
                finish_time: null,
                actual_time: 55,
                button_status: 1,
                target_pairs: 100,
                smv_per_pair: 12
            };
            setProductionData(demoData);
            toast.success('Connected to Demo Machine');
        };

        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Display</h1>
                    <p className="text-gray-500 mb-8">Scan this QR code with your mobile device to control this display.</p>

                    <div className="bg-gray-100 p-6 rounded-xl inline-block mb-6 relative">
                        {sessionId ? (
                            <QRCodeSVG value={activationUrl} size={200} level="H" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[200px] w-[200px]">
                                <Loader2 className="h-12 w-12 animate-spin text-gray-400 mb-4" />
                                <p className="text-sm text-gray-400">Connecting to server...</p>
                                <button
                                    onClick={() => setSessionId('DEMO-SESSION')}
                                    className="mt-4 text-xs text-blue-500 hover:underline"
                                >
                                    Use Demo Session
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="text-sm text-gray-400 mb-8 flex items-center justify-center gap-2">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        {urlMachineId && !urlEmpId
                            ? `Waiting for supervisor scan on ${urlMachineId}...`
                            : !urlMachineId && !urlEmpId
                                ? 'Waiting for QR scan from another device...'
                                : 'Waiting for connection...'
                        }
                    </div>

                    {/* Simulation / Debug Button */}
                    {(sessionId === 'DEMO-SESSION' || import.meta.env.DEV) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                            <p className="text-xs text-blue-800 mb-2">Debug / Simulation Mode</p>
                            <button
                                onClick={handleDemoConnect}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Simulate Scan & Connect
                            </button>
                        </div>
                    )}

                    {/* Testing Helper Section */}
                    <div className="mt-8 border-t pt-8">
                        <button
                            onClick={() => setShowTestHelpers(!showTestHelpers)}
                            className="text-sm text-gray-500 hover:text-blue-600 underline"
                        >
                            {showTestHelpers ? 'Hide Test QR Codes' : 'Show Demo QR Codes (for Laptop Screen)'}
                        </button>

                        {showTestHelpers && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                <p className="text-[10px] text-gray-400 mb-4 font-semibold uppercase tracking-wider">
                                    Scan these with your Phone from this screen
                                </p>

                                <div className="space-y-12">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-600 mb-6 text-center border-b pb-2">1. Employee Badges</h4>
                                        <div className="flex flex-col gap-12">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl shadow-sm">
                                                    <img src={`${import.meta.env.BASE_URL}assets/qrcode-EMP-1001.jpeg`} alt="EMP-1001" className="w-64 h-64 object-contain" />
                                                </div>
                                                <span className="mt-3 text-lg font-bold text-gray-700">John Doe</span>
                                                <span className="text-xs text-gray-400 font-mono">ID: EMP-1001</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl shadow-sm">
                                                    <img src={`${import.meta.env.BASE_URL}assets/qrcode-EMP-1002.jpeg`} alt="EMP-1002" className="w-64 h-64 object-contain" />
                                                </div>
                                                <span className="mt-3 text-lg font-bold text-gray-700">Jane Smith</span>
                                                <span className="text-xs text-gray-400 font-mono">ID: EMP-1002</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-gray-600 mb-6 text-center border-b pb-2">2. Machine Stickers</h4>
                                        <div className="flex flex-col gap-12">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl shadow-sm">
                                                    <img src={`${import.meta.env.BASE_URL}assets/qrcode-MAC-001.jpeg`} alt="MAC-001" className="w-64 h-64 object-contain" />
                                                </div>
                                                <span className="mt-3 text-lg font-bold text-gray-700">Machine 1</span>
                                                <span className="text-xs text-gray-400 font-mono">ID: MAC-001</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl shadow-sm">
                                                    <img src={`${import.meta.env.BASE_URL}assets/qrcode-MAC-002.jpeg`} alt="MAC-002" className="w-64 h-64 object-contain" />
                                                </div>
                                                <span className="mt-3 text-lg font-bold text-gray-700">Machine 2</span>
                                                <span className="text-xs text-gray-400 font-mono">ID: MAC-002</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // DASHBOARD STATE
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6">
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
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl shadow-xl p-4 md:p-6">
                        <h1 className="text-xl md:text-2xl font-bold text-center mb-3">MACHINE CENTRE PRODUCTION</h1>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                <div className="min-w-0">
                                    <p className="text-xs opacity-80">Line Name</p>
                                    <p className="font-semibold truncate">{machineName || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
                                <div className="min-w-0">
                                    <p className="text-xs opacity-80">Work Centre</p>
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-6 rounded-xl border-2 border-blue-200 shadow-sm">
                                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Target Time</p>
                                <p className="text-3xl md:text-5xl font-bold text-blue-900">{productionData.target_mins}</p>
                                <p className="text-xs text-blue-600 mt-1">mins</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 md:p-6 rounded-xl border-2 border-purple-200 shadow-sm">
                                <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Actual Time</p>
                                <p className="text-3xl md:text-5xl font-bold text-purple-900">{Math.floor(actualTimeCounter / 60)}<span className="text-lg">m</span></p>
                                <p className="text-xs text-purple-600 mt-1">{actualTimeCounter % 60}s</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 md:p-6 rounded-xl border-2 border-green-200 shadow-sm">
                                <p className="text-xs font-semibold text-green-700 uppercase mb-1">Target Pairs</p>
                                <p className="text-3xl md:text-5xl font-bold text-green-900">{productionData.target_pairs || 0}</p>
                                <p className="text-xs text-green-600 mt-1">pairs</p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-6 rounded-xl border-2 border-orange-200 shadow-sm">
                                <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Total Output</p>
                                <p className="text-3xl md:text-5xl font-bold text-orange-900">{productionData.output_pairs}</p>
                                <p className="text-xs text-orange-600 mt-1">pairs</p>
                            </div>
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 md:p-6 rounded-xl border-2 border-indigo-200 shadow-sm">
                                <p className="text-xs font-semibold text-indigo-700 uppercase mb-1">Avg Efficiency</p>
                                <p className="text-3xl md:text-5xl font-bold text-indigo-900">{calculateEfficiency()}%</p>
                                <p className="text-xs text-indigo-600 mt-1">percentage</p>
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
                                        disabled={loading}
                                        className="md:col-span-2 bg-gradient-to-r from-green-600 to-green-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-green-700 hover:to-green-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
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
                </div>
            )}
        </div>
    );
};
