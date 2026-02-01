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
    const [activationDebug, setActivationDebug] = useState<any>(null);

    useEffect(() => {
        const saved = sessionStorage.getItem('last_activation_debug');
        if (saved) {
            try {
                setActivationDebug(JSON.parse(saved));
            } catch (e) { }
        }
    }, []);

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

        // AUTO-DETECTION / POLLING MODE
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
    }, [location.pathname, API_BASE, navigate, urlMachineId, urlEmpId]);


    const initializeProduction = async (machineId: string, empCode: string, workCentreId: number = 1) => {
        setLoading(true);
        try {
            // Look up the employee ID from the emp_id
            const empRes = await fetch(`${API_BASE}/api/masters/employees/emp_id/${empId}`);
            const empResult = await empRes.json();
            
            if (!empResult.success || !empResult.data) {
                toast.error(`Employee ${empCode} not found`);
                return;
            }
            
            const empId = empResult.data.id;
            const newData: ProductionData = {
                prod_date: new Date().toISOString().split('T')[0],
                work_centre_id: workCentreId,
                machine_id: machineId,
                emp_id: empId,
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

    const handleStart = async () => {
        if (!productionData?.id) return;

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    button_status: 1,
                    output_pairs: outputIncrement
                })
            });

            const result = await response.json();
            if (result.success) {
                setProductionData({ ...productionData, button_status: 1, output_pairs: productionData.output_pairs + outputIncrement });
                setOutputIncrement(0);
                toast.success('Production started');
            }
        } catch (error) {
            console.error('Error starting production:', error);
            toast.error('Failed to start production');
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

    const handleFinish = async () => {
        if (!productionData?.id) return;

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/mobile-production/${productionData.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ button_status: 2 })
            });

            const result = await response.json();
            if (result.success) {
                setProductionData({ ...productionData, button_status: 2 });
                toast.success('Production finished');
            }
        } catch (error) {
            console.error('Error finishing production:', error);
            toast.error('Failed to finish production');
        } finally {
            setLoading(false);
        }
    };

    const calculateEfficiency = () => {
        if (!productionData || !productionData.target_mins || productionData.target_mins === 0) return 100;
        return Math.min(100, Math.round((productionData.actual_time / productionData.target_mins) * 100));
    };

    const getStatusText = () => {
        if (!productionData) return 'Idle';
        switch (productionData.button_status) {
            case 1: return 'On-track';
            case 2: return 'Finished';
            case 3: return 'Stopped';
            default: return 'Idle';
        }
    };

    const getStatusColor = () => {
        const efficiency = calculateEfficiency();
        if (efficiency >= 80) return 'text-green-600';
        if (efficiency >= 60) return 'text-yellow-600';
        return 'text-red-600';
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
                        {urlMachineId && !urlEmpId ? `Waiting for supervisor scan on ${urlMachineId}...` : 'Waiting for connection...'}
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            {/* Loading Screen */}
            {loading && !productionData && (
                <div className="flex items-center justify-center min-h-screen">
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Setting up production...</h2>
                        <p className="text-gray-500">Please wait while we initialize your workspace</p>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {(!loading || productionData) && (
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Mobile Production</h1>
                                <p className="text-sm text-gray-500">
                                    {currentTime.toLocaleDateString()} - {currentTime.toLocaleTimeString()}
                                </p>
                            </div>
                            {/* QR Button removed as we are in Display Mode */}
                        </div>

                        {qrData && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 space-y-1">
                                <p className="text-sm text-blue-800 font-bold">Machine: {machineName || qrData}</p>
                                {employeeName && <p className="text-xs text-blue-600 font-medium">Operator: {employeeName}</p>}
                            </div>
                        )}
                    </div>

                    {/* RED DEBUG TEXT FOR USER INSPECTION */}
                    {activationDebug && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 relative">
                            <button
                                onClick={() => {
                                    setActivationDebug(null);
                                    sessionStorage.removeItem('last_activation_debug');
                                }}
                                className="absolute top-2 right-2 text-red-500 font-bold"
                            >
                                ✕
                            </button>
                            <h3 className="text-red-600 font-bold text-sm underline mb-3">API DATA (RED DEBUG MODE)</h3>
                            <div className="text-red-700 font-mono text-[11px] leading-relaxed break-all space-y-3">
                                <div>
                                    <span className="font-bold underline text-red-800">1. SENDING TO:</span><br />
                                    {activationDebug.url}
                                </div>
                                <div>
                                    <span className="font-bold underline text-red-800">2. PAYLOAD SENT:</span><br />
                                    {JSON.stringify(activationDebug.payload)}
                                </div>
                                <div>
                                    <span className="font-bold underline text-red-800">3. SERVER SAID:</span><br />
                                    {JSON.stringify(activationDebug.response)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Production Metrics */}
                    {productionData && (
                        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {/* Target Time */}
                                <div className="bg-blue-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Target time Mins</p>
                                    <p className="text-3xl font-bold text-blue-600">{productionData.target_mins}</p>
                                </div>

                                {/* Actual Time */}
                                <div className="bg-green-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Actual time Mins</p>
                                    <p className="text-3xl font-bold text-green-600">{productionData.actual_time}</p>
                                </div>

                                {/* Target Pairs Per Tray */}
                                <div className="bg-purple-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Pairs/Tray</p>
                                    <p className="text-3xl font-bold text-purple-600">{productionData.target_pairs_per_tray || 0}</p>
                                </div>

                                {/* Tray Count */}
                                <div className="bg-pink-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Total Trays</p>
                                    <p className="text-3xl font-bold text-pink-600">{productionData.tray_count || Math.floor(productionData.output_pairs / (productionData.target_pairs_per_tray || 1))}</p>
                                </div>

                                {/* Total Output */}
                                <div className="bg-orange-50 rounded-lg p-4 text-center col-span-2">
                                    <p className="text-sm text-gray-600 mb-1">Total Output (Pairs)</p>
                                    <p className="text-3xl font-bold text-orange-600">{productionData.output_pairs}</p>
                                </div>
                            </div>

                            {/* Efficiency and Status */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Avg. Efficiency %</p>
                                    <p className="text-4xl font-bold text-indigo-600">{calculateEfficiency()}%</p>
                                </div>

                                <div className="bg-gradient-to-br from-yellow-50 to-red-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Status</p>
                                    <p className={`text-2xl font-bold ${getStatusColor()}`}>{getStatusText()}</p>
                                </div>
                            </div>

                            {/* Output Increment Input */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Add Output Pairs (after pressing Start)
                                </label>
                                <input
                                    type="number"
                                    value={outputIncrement}
                                    onChange={(e) => setOutputIncrement(parseInt(e.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter pairs to add"
                                    min="0"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    onClick={handleStart}
                                    disabled={loading || productionData.button_status === 2}
                                    className="bg-green-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md active:scale-95"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                                    START
                                </button>

                                <button
                                    onClick={handleStop}
                                    disabled={loading || productionData.button_status === 2}
                                    className="bg-red-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md active:scale-95"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />}
                                    STOP
                                </button>

                                <button
                                    onClick={handleFinish}
                                    disabled={loading || productionData.button_status === 2}
                                    className="bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md active:scale-95"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                                    FINISH
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activationDebug && (
                <div className="max-w-4xl mx-auto mt-8 px-4 pb-12">
                    <div className="p-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-2xl">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                            <h3 className="text-blue-400 font-mono text-xs font-bold uppercase tracking-wider">Activation Debug Inspector</h3>
                            <button onClick={() => {
                                setActivationDebug(null);
                                sessionStorage.removeItem('last_activation_debug');
                            }} className="text-gray-500 hover:text-white">✕</button>
                        </div>

                        <div className="space-y-4 font-mono text-[10px]">
                            <div>
                                <p className="text-gray-500 mb-1 font-bold uppercase">Activation Endpoint:</p>
                                <div className="bg-gray-800 p-2 rounded text-blue-300 break-all border border-gray-700">{activationDebug.url}</div>
                            </div>

                            <div>
                                <p className="text-gray-500 mb-1 font-bold uppercase">Request Sent to Server:</p>
                                <pre className="bg-gray-800 p-2 rounded text-green-400 overflow-x-auto border border-gray-700">
                                    {JSON.stringify(activationDebug.payload, null, 2)}
                                </pre>
                            </div>

                            <div>
                                <p className="text-gray-500 mb-1 font-bold uppercase">Server Response:</p>
                                <pre className={`bg-gray-800 p-2 rounded overflow-x-auto border border-gray-700 ${activationDebug.response?.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {JSON.stringify(activationDebug.response, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
