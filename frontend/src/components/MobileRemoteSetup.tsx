import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QrReader from 'react-qr-scanner';
import toast from 'react-hot-toast';
import { Loader2, Camera, CheckCircle, X } from 'lucide-react';

export const MobileRemoteSetup: React.FC = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session');

    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [machineId, setMachineId] = useState('');

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

    const handleScan = (data: { text: string } | null) => {
        if (!data) return;
        const text = data.text;

        // Parse: Line1-OP1-Jeevan P (Simple validation)
        if (text.length < 3) return;

        setMachineId(text);
        setScanning(false);
        handleActivate(text);
    };

    const handleScanError = (err: any) => {
        console.error(err);
        toast.error('Camera error');
        setScanning(false);
    };

    const handleActivate = async (scannedText: string) => {
        setLoading(true);
        try {
            // DEMO MODE BYPASS
            if (sessionId === 'DEMO-SESSION') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setCompleted(true);
                toast.success('Setup Connected! (Demo Mode)');
                return;
            }

            // Parse info
            const parts = scannedText.split('-');
            let mId = scannedText;
            let empId = 1;
            let wcId = 1;

            if (parts.length >= 3) {
                // Determine logic. For now just passing text as machine_id if simple
                mId = parts[1] || parts[0];
                // In real app, we'd lookup IDs. For now, sending dummy INTs for IDs
            }

            // Call activate
            const res = await fetch(`${API_BASE}/api/mobile-session/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    machine_id: scannedText, // Send full string or parts? MobileProduction logic uses "Line-Machine-Emp" string to init.
                    // The backend `activateSession` expects machine_id, work_centre_id, emp_id.
                    // But `MobileProduction` needs to reconstruct it.
                    // Let's send the FULL string as `machine_id` for now to simplify passing data back to Display.
                    // Or I should parse it better.
                    // Actually, MobileProduction "initializeProduction" takes (workCentre, machineId, empName).
                    // I will store the RAW SCAN in `machine_id` column for simplicity?
                    // No, `machine_id` column in DB is VARCHAR(100).
                    // `emp_id` is INT.
                    // I'll send defaults for INTs and full string for machine_id.
                    work_centre_id: 1,
                    emp_id: 1
                })
            });

            const json = await res.json();
            if (json.success) {
                setCompleted(true);
                toast.success('Setup Connected!');
            } else {
                toast.error(json.message || 'Connection failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    if (!sessionId) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                    <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900">Invalid Session</h2>
                    <p className="text-gray-500">Please scan the setup QR code again.</p>
                </div>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-sm w-full">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Connected!</h2>
                    <p className="text-gray-600">The display has been updated. You can close this window.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-blue-600 p-6 text-center">
                    <h1 className="text-xl font-bold text-white">Remote Setup</h1>
                    <p className="text-blue-100">Scan Machine QR to active display</p>
                </div>

                <div className="p-6">
                    {!scanning ? (
                        <div className="text-center space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
                                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Camera permission required</p>
                            </div>

                            <button
                                onClick={() => setScanning(true)}
                                className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2"
                            >
                                <Camera className="h-6 w-6" />
                                Scan Machine QR
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="aspect-square bg-black overflow-hidden relative rounded-lg">
                                <QrReader
                                    delay={300}
                                    onError={handleScanError}
                                    onScan={handleScan}
                                    style={{ width: '100%' }}
                                    constraints={{ video: { facingMode: 'environment' } }}
                                />
                                <div className="absolute inset-0 border-2 border-green-500 opacity-50 pointer-events-none"></div>
                            </div>
                            <button
                                onClick={() => setScanning(false)}
                                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg shadow-xl flex items-center gap-3">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                <span className="font-medium">Connecting...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
