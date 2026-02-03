import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QrCode, Play, Square, CheckCircle, Loader2, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface ProductionData {
    id?: number;
    prod_date: string;
    work_centre_id: number;
    machine_id: string;
    emp_id: number;
    output_pairs: number;
    target_mins: number;
    start_time: string | null;
    finish_time: string | null;
    actual_time: number;
    button_status: number; // 1=Start, 2=Finish, 3=Stop
    target_pairs?: number;
    smv_per_pair?: number;
    target_pairs_per_tray?: number;
    tray_count?: number;
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
    const [outputIncrement, setOutputIncrement] = useState(0);
    const [employeeName, setEmployeeName] = useState('');
    const [machineName, setMachineName] = useState('');
    const [showTestHelpers, setShowTestHelpers] = useState(false);

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

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

    // Session Initialization and Polling
    useEffect(() => {
        if (urlMachineId && urlEmpId) {
            const resolveAndInitialize = async () => {
                setLoading(true);
                try {
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
            // Look up the employee ID from the emp_id
            const empRes = await fetch(`${API_BASE}/api/masters/employees/emp_id/${empCode}`);
            const empResult = await empRes.json();
            
            if (!empResult.success || !empResult.data) {
                toast.error(`Employee ${empCode} not found`);
                return;
            }
            
            const empDbId = empResult.data.id;
            const newData: ProductionData = {
                prod_date: new Date().toISOString().split('T')[0],
                work_centre_id: workCentreId,
                machine_id: machineId,
                emp_id: empDbId,
                output_pairs: 0,
                target_mins: 10,
                start_time: null,
                finish_time: null,
                actual_time: 10,
                button_status: 1,
                target_pairs: 12,
                smv_per_pair: 100,
                target_pairs_per_tray: 0,
                tray_count: 0
            };

            const response = await fetch(`${API_BASE}/api/mobile-production`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            });

            const result = await response.json();
            if (result.success) {
                setProductionData({ ...newData, id: result.data.id });
                toast.success('Production initialized');
            }
        } catch (error) {
            console.error('Error initializing production:', error);
            toast.error('Failed to initialize production');
        } finally {
            setLoading(false);
        }
    };

    const handleStartFinish = async () => {
        if (!productionData?.id) return;

        setLoading(true);
        try {
            const newStatus = productionData.button_status === 1 ? 2 : 1;
            const response = await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    button_status: newStatus,
                    output_pairs: newStatus === 1 ? outputIncrement : 0
                })
            });

            const result = await response.json();
            if (result.success) {
                setProductionData({ 
                    ...productionData, 
                    button_status: newStatus, 
                    output_pairs: newStatus === 1 ? productionData.output_pairs + outputIncrement : productionData.output_pairs
                });
                if (newStatus === 1) setOutputIncrement(0);
                toast.success(newStatus === 1 ? 'Production started' : 'Production finished');
            }
        } catch (error) {
            console.error('Error updating production:', error);
            toast.error('Failed to update production');
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
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
                setProductionData({ ...productionData, button_status: 3 });
                toast.success('Production stopped');
            }
        } catch (error) {
            console.error('Error stopping production:', error);
            toast.error('Failed to stop production');
        } finally {
            setLoading(false);
        }
    };

    const calculateEfficiency = () => {
        if (!productionData || !productionData.target_mins || productionData.target_mins === 0) return 100;
        return Math.min(100, Math.round((productionData.actual_time / productionData.target_mins) * 100));
    };

    const getStatusText = () => {
        if (!productionData) return 'Ready';
        switch (productionData.button_status) {
            case 1: return 'Running';
            case 2: return 'Finished';
            case 3: return 'Stopped';
            default: return 'Ready';
        }
    };

    const getStatusColor = () => {
        if (!productionData) return 'text-gray-600';
        switch (productionData.button_status) {
            case 1: return 'text-green-600';
            case 2: return 'text-blue-600';
            case 3: return 'text-red-600';
            default: return 'text-gray-600';
        }
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
        <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 overflow-hidden">
            {/* Loading Screen */}
            {loading && !productionData && (
                <div className="flex items-center justify-center h-full">
                    <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Setting up...</h2>
                        <p className="text-sm text-gray-500">Please wait</p>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {(!loading || productionData) && (
                <div className="h-full flex flex-col">
                    {/* Header - Compact */}
                    <div className="bg-white rounded-lg shadow-lg p-3 mb-2 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-lg font-bold text-gray-900">Production</h1>
                                <p className="text-xs text-gray-500">{currentTime.toLocaleTimeString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-blue-800">{machineName || qrData}</p>
                                <p className="text-xs text-blue-600">{employeeName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Production Metrics - Compact Grid */}
                    {productionData && (
                        <div className="bg-white rounded-lg shadow-lg p-3 mb-2 flex-1 min-h-0">
                            {/* Top Row - Main Metrics */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="bg-blue-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Target</p>
                                    <p className="text-xl font-bold text-blue-600">{productionData.target_mins}m</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Actual</p>
                                    <p className="text-xl font-bold text-green-600">{productionData.actual_time}m</p>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Output</p>
                                    <p className="text-xl font-bold text-purple-600">{productionData.output_pairs}</p>
                                </div>
                            </div>

                            {/* Status and Efficiency */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Efficiency</p>
                                    <p className="text-2xl font-bold text-indigo-600">{calculateEfficiency()}%</p>
                                </div>
                                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-600 mb-1">Status</p>
                                    <p className={`text-lg font-bold ${getStatusColor()}`}>{getStatusText()}</p>
                                </div>
                            </div>

                            {/* Output Input - Only show when not finished */}
                            {productionData.button_status !== 2 && (
                                <div className="mb-3">
                                    <input
                                        type="number"
                                        value={outputIncrement}
                                        onChange={(e) => setOutputIncrement(parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold"
                                        placeholder="Add pairs"
                                        min="0"
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                {/* START/FINISH Button */}
                                <button
                                    onClick={handleStartFinish}
                                    disabled={loading || productionData.button_status === 2}
                                    className={`py-3 rounded-lg font-bold text-lg transition-all duration-300 shadow-lg active:scale-95 ${
                                        productionData.button_status === 1
                                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                    } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : productionData.button_status === 1 ? (
                                        <><CheckCircle className="h-5 w-5" />FINISH</>
                                    ) : (
                                        <><Play className="h-5 w-5" />START</>
                                    )}
                                </button>

                                {/* STOP Button */}
                                <button
                                    onClick={handleStop}
                                    disabled={loading || productionData.button_status === 2 || productionData.button_status === 3}
                                    className="bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold text-lg transition-all duration-300 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <><Square className="h-5 w-5" />STOP</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
