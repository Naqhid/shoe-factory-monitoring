import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const lineConfigs = {
  line1: { 
    name: 'Line 1', 
    machineId: 'MAC-001', 
    empId: 'EMP-1001', 
    empName: 'John Doe',
    machineQR: 'qrcode-MAC-001.jpeg',
    empQR: 'qrcode-EMP-1001.jpeg'
  },
  line2: { 
    name: 'Line 2', 
    machineId: 'MAC-002', 
    empId: 'EMP-1002', 
    empName: 'Jane Smith',
    machineQR: 'qrcode-MAC-002.jpeg',
    empQR: 'qrcode-EMP-1002.jpeg'
  },
};

export const MobileLineProduction: React.FC = () => {
  const navigate = useNavigate();
  const [showTestHelpers, setShowTestHelpers] = useState(false);
  
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';
  
  // Extract lineId from URL path
  const fullPath = window.location.pathname;
  const pathParts = fullPath.split('/').filter(Boolean);
  const lineId = pathParts[pathParts.length - 1]; // Get last part
  
  const config = lineConfigs[lineId as keyof typeof lineConfigs];
  
  // If no specific config found, show line1 as default
  const displayConfig = config || lineConfigs.line1;

  // Poll for active sessions every 5 seconds
  useEffect(() => {
    console.log('Component mounted, starting polling...');
    
    const pollInterval = setInterval(async () => {
      try {
        console.log('Polling API for line:', lineId);
        const response = await fetch(`${API_BASE}/api/mobile-session/latest-active?line=${lineId}`);
        const result = await response.json();
        console.log('API Response:', result);
        
        if (result.success && result.data && result.data.redirect_url) {
          console.log('Redirecting to:', result.data.redirect_url);
          clearInterval(pollInterval);
          navigate(result.data.redirect_url);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [API_BASE, navigate, lineId]);
  
  if (!displayConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Line Not Found</h2>
          <p className="text-gray-500 mb-4">The requested production line does not exist.</p>
          <Link to="/mobile" className="text-blue-600 hover:underline">
            ← Back to Line Selection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/mobile" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{displayConfig.name}</h1>
            <div className="w-6"></div>
          </div>
          <p className="text-gray-500 mb-2">Machine: {displayConfig.machineId}</p>
          <p className="text-gray-600">Operator: {displayConfig.empName}</p>
        </div>

        {/* QR Codes Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6 text-center">QR Codes for {displayConfig.name}</h2>
          
          <div className="space-y-8">
            {/* Employee QR */}
            <div className="text-center">
              <h3 className="text-md font-semibold text-gray-700 mb-4">Employee Badge</h3>
              <div className="bg-gray-50 p-6 rounded-xl inline-block">
                <img 
                  src={`${import.meta.env.BASE_URL}assets/${displayConfig.empQR}`} 
                  alt={displayConfig.empId} 
                  className="w-48 h-48 object-contain mx-auto" 
                />
              </div>
              <p className="text-sm font-medium text-gray-700 mt-2">{displayConfig.empName}</p>
              <p className="text-xs text-gray-500">ID: {displayConfig.empId}</p>
            </div>

            {/* Machine QR */}
            <div className="text-center">
              <h3 className="text-md font-semibold text-gray-700 mb-4">Machine Sticker</h3>
              <div className="bg-gray-50 p-6 rounded-xl inline-block">
                <img 
                  src={`${import.meta.env.BASE_URL}assets/${displayConfig.machineQR}`} 
                  alt={displayConfig.machineId} 
                  className="w-48 h-48 object-contain mx-auto" 
                />
              </div>
              <p className="text-sm font-medium text-gray-700 mt-2">{displayConfig.name}</p>
              <p className="text-xs text-gray-500">ID: {displayConfig.machineId}</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Scan these QR codes with your mobile device to start production tracking
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};