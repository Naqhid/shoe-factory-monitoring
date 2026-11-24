declare module 'react-qr-scanner' {
  import React from 'react';

  interface QrReaderProps {
    delay?: number;
    style?: React.CSSProperties;
    onError?: (error: any) => void;
    onScan?: (data: { text: string } | null) => void;
    facingMode?: 'user' | 'environment';
    className?: string;
    constraints?: {
      video?: {
        facingMode?: 'user' | 'environment';
        width?: number | { ideal?: number; min?: number; max?: number };
        height?: number | { ideal?: number; min?: number; max?: number };
        aspectRatio?: number | { ideal?: number; min?: number; max?: number };
        [key: string]: any;
      };
      audio?: boolean;
    };
  }

  const QrReader: React.ComponentType<QrReaderProps>;
  export default QrReader;
}