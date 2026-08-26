import React, { useEffect, useRef } from 'react';
import { BrowserQRCodeReader, Result, DecodeHintType, BarcodeFormat } from '@zxing/library';

interface ModernScannerProps {
    onScan: (text: string) => void;
    onError: (error: any) => void;
    facingMode?: 'user' | 'environment';
}

export const ModernScanner: React.FC<ModernScannerProps> = ({
    onScan,
    onError,
    facingMode = 'environment'
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const codeReader = useRef(new BrowserQRCodeReader());

    useEffect(() => {
        let isMounted = true;

        const startScanner = async () => {
            console.log('Scanner: Starting...');
            await new Promise(resolve => setTimeout(resolve, 50));

            if (!isMounted) return;

            try {
                // Check if mediaDevices is supported
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                    const protocol = window.location.protocol;
                    
                    if (protocol === 'http:' && !isLocalhost) {
                        throw new Error(
                            'Camera blocked on HTTP. Enable in Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure then add ' + window.location.origin
                        );
                    } else {
                        throw new Error('Camera not available. Check browser permissions.');
                    }
                }

                const videoInputDevices = await codeReader.current.listVideoInputDevices();
                console.log('Scanner: Devices found:', videoInputDevices.length);

                if (videoInputDevices.length === 0) {
                    throw new Error('No camera devices found');
                }

                // Try to find the best back camera
                let selectedDeviceId = videoInputDevices[0].deviceId;
                if (facingMode === 'environment') {
                    const backCameras = videoInputDevices.filter(device =>
                        device.label.toLowerCase().includes('back') ||
                        device.label.toLowerCase().includes('rear') ||
                        device.label.toLowerCase().includes('environment') ||
                        device.label.toLowerCase().includes('camera 0')
                    );

                    if (backCameras.length > 0) {
                        selectedDeviceId = backCameras[0].deviceId;
                        console.log('Scanner: Selected camera:', backCameras[0].label);
                    } else if (videoInputDevices.length > 1) {
                        selectedDeviceId = videoInputDevices[videoInputDevices.length - 1].deviceId;
                    }
                }

                if (isMounted && videoRef.current) {
                    console.log('Scanner: Decoding from:', selectedDeviceId);
                    await codeReader.current.decodeFromVideoDevice(
                        selectedDeviceId,
                        videoRef.current,
                        (result: Result | null) => {
                            if (result && isMounted) {
                                const text = result.getText();
                                console.log('Scanner: TEXT DETECTED:', text);
                                onScan(text);
                            }
                        }
                    );
                }
            } catch (err: any) {
                console.error('Scanner: Error:', err);
                if (isMounted) {
                    const errorMsg = err.message || 'Camera access failed';
                    onError(new Error(errorMsg));
                }
            }
        };

        startScanner();

        return () => {
            console.log('Scanner: Unmounting...');
            isMounted = false;
            try {
                codeReader.current.reset();
                const videoEl = videoRef.current;
                if (videoEl && videoEl.srcObject) {
                    const stream = videoEl.srcObject as MediaStream;
                    stream.getTracks().forEach(track => {
                        track.stop();
                        console.log('Scanner: Track stopped:', track.label);
                    });
                    videoEl.srcObject = null;
                }
            } catch (e) {
                console.error('Scanner: Cleanup error:', e);
            }
        };
    }, [facingMode, onScan, onError]);

    return (
        <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
            <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                muted
                playsInline
            />
            {/* Viewfinder Overlay */}
            <div className="absolute inset-0 border-2 border-white border-opacity-20 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-green-500 rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1 rounded-tl-sm"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1 rounded-tr-sm"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1 rounded-bl-sm"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1 rounded-br-sm"></div>

                    {/* Scanning Animation Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500 opacity-50 shadow-[0_0_10px_#22c55e] animate-scan-line"></div>
                </div>
            </div>

            <style>{`
        @keyframes scan-line {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>
        </div>
    );
};
