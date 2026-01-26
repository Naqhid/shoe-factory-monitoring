declare module 'react-qr-scanner' {
  import React from 'react';

  interface QrReaderProps {
    delay?: number;
    style?: React.CSSProperties;
    onError?: (error: any) => void;
    onScan?: (data: string | null) => void;
    facingMode?: 'user' | 'environment';
    className?: string;
  }

  const QrReader: React.ComponentType<QrReaderProps>;
  export default QrReader;
}