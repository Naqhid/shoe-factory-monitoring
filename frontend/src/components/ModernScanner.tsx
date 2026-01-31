import React, { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, Result } from '@zxing/library';

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
    const codeReader = useRef(new BrowserMultiFormatReader());

    useEffect(() => {
        let isMounted = true;

        const startScanner = async () => {
            try {
                const videoInputDevices = await codeReader.current.listVideoInputDevices();

                // Try to find the back camera if requested
                let selectedDeviceId = videoInputDevices[0].deviceId;
                if (facingMode === 'environment') {
                    const backCamera = videoInputDevices.find(device =>
                        device.label.toLowerCase().includes('back') ||
                        device.label.toLowerCase().includes('rear') ||
                        device.label.toLowerCase().includes('environment')
                    );
                    if (backCamera) {
                        selectedDeviceId = backCamera.deviceId;
                    } else if (videoInputDevices.length > 1) {
                        // Usually the last one is the better back camera on many Androids
                        selectedDeviceId = videoInputDevices[videoInputDevices.length - 1].deviceId;
                    }
                }

                if (isMounted && videoRef.current) {
                    codeReader.current.decodeFromVideoDevice(
                        selectedDeviceId,
                        videoRef.current,
                        (result: Result | null, err: any) => {
                            if (result && isMounted) {
                                onScan(result.getText());
                            }
                            // We ignore err here as it throws on every frame it doesn't find a code
                        }
                    );
                }
            } catch (err) {
                console.error('Scanner start error:', err);
                if (isMounted) onError(err);
            }
        };

        startScanner();

        return () => {
            isMounted = false;
            codeReader.current.reset();
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
