import React, { useState, useEffect } from 'react';
import { QrCode, Play, Square, CheckCircle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import QrReader from 'react-qr-scanner';
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
}

export const MobileProduction: React.FC = () => {
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

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Session Initialization and Polling
    useEffect(() => {
        // Create session on mount
        const initSession = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/mobile-session/init`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    setSessionId(data.data.session_id);
                }
            } catch (e) { console.error('Session init failed', e); }
        };
        initSession();
    }, []);

    useEffect(() => {
        if (!sessionId || sessionStatus === 'active') return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/mobile-session/${sessionId}`);
                const json = await res.json();
                if (json.success && json.data.status === 'active') {
                    setSessionStatus('active');
                    // Initialize Dashboard with session data
                    const { machine_id, emp_id, work_centre_id } = json.data;
                    if (machine_id) {
                        initializeProduction(machine_id, emp_id);
                        setQrData(machine_id);
                        toast.success(`Connected: ${machine_id}`);
                    }
                }
            } catch (e) { console.error('Polling error', e); }
        }, 2000);
        return () => clearInterval(interval);
    }, [sessionId, sessionStatus]);


    const initializeProduction = async (machineId: string, empId: number) => {
        setLoading(true);
        try {
            const newData: ProductionData = {
                prod_date: new Date().toISOString().split('T')[0],
                work_centre_id: 1, // Should be fetched from work_centres table
                machine_id: machineId,
                emp_id: empId || 1,
                output_pairs: 0,
                target_mins: 10,
                start_time: null,
                finish_time: null,
                actual_time: 10,
                button_status: 1,
                target_pairs: 12,
                smv_per_pair: 100
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
        const activationUrl = sessionId
            ? `${window.location.protocol}//${window.location.host}/mobile-remote-setup?session=${sessionId}`
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

                    <div className="text-sm text-gray-400 mb-4">
                        Session ID: {sessionId ? sessionId.slice(0, 8) + '...' : 'Initializing...'}
                    </div>

                    {/* Simulation / Debug Button */}
                    {(sessionId === 'DEMO-SESSION' || import.meta.env.DEV) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-800 mb-2">Debug / Simulation Mode</p>
                            <button
                                onClick={handleDemoConnect}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Simulate Scan & Connect
                            </button>
                        </div>
                    )}
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
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-blue-800 font-medium">Machine: {qrData}</p>
                            </div>
                        )}
                    </div>

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

                                {/* Target Pairs */}
                                <div className="bg-purple-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Target Pairs</p>
                                    <p className="text-3xl font-bold text-purple-600">{productionData.target_pairs || 12}</p>
                                </div>

                                {/* Total Output */}
                                <div className="bg-orange-50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-600 mb-1">Total Output</p>
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
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={handleStart}
                                    disabled={loading || productionData.button_status === 2}
                                    className="bg-green-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                                    START
                                </button>

                                <button
                                    onClick={handleStop}
                                    disabled={loading || productionData.button_status === 2}
                                    className="bg-red-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />}
                                    STOP
                                </button>

                                <button
                                    onClick={handleFinish}
                                    disabled={loading || productionData.button_status === 2}
                                    className="bg-blue-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                                    FINISH
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
