import React from 'react';
import { Save, ArrowLeft, QrCode, LogOut, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ModernScanner } from './ModernScanner';

interface FormData {
  employee_id: string; // The code (e.g. EMP-1001)
  employee_db_id?: number | string; // The numeric PK
  employee_name: string;
  machine_id: string;
  login_date_time: string;
}

export const MobileLineSetupForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get('session');
  const [loading, setLoading] = React.useState(false);
  const [scanningEmployee, setScanningEmployee] = React.useState(false);
  const [scanningMachine, setScanningMachine] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [lastScanned, setLastScanned] = React.useState<string | null>(null);
  const [showTestHelpers, setShowTestHelpers] = React.useState(false);
  const [scannerKey, setScannerKey] = React.useState(0); // To force re-mount on open
  const [debugLog, setDebugLog] = React.useState<{ url: string; payload: any; response: any } | null>(null);

  const [formData, setFormData] = React.useState<FormData>({
    employee_id: '',
    employee_name: '',
    machine_id: searchParams.get('machine') || '',
    login_date_time: new Date().toISOString().slice(0, 16),
  });

  // Auto-submit removed - manual click required as per request

  const extractId = (text: string) => {
    if (!text) return '';
    const trimmed = text.trim();

    // If it's a URL, don't try to extract from patterns, let URL parser handle it
    if (trimmed.includes('://')) return trimmed;

    // Pattern 1: Look for "ID: XXXX" (common in labels)
    const idMatch = trimmed.match(/ID:\s*([\w-]+)/i);
    if (idMatch) return idMatch[1].trim();

    // Pattern 2: Look for EMP-XXXX or MAC-XXXX explicitly
    const empMacMatch = trimmed.match(/(EMP-\d+|MAC-\d+)/i);
    if (empMacMatch) return empMacMatch[1].trim();

    // Pattern 3: If it's multi-line, try to find a line that looks like an ID
    const lines = trimmed.split(/\r?\n/);
    if (lines.length > 1) {
      for (const line of lines) {
        const cleaned = line.trim();
        if (cleaned.match(/^(EMP-\d+|MAC-\d+|ID:\s*[\w-]+|[\w-]+)$/i)) {
          return extractId(cleaned); // Recurse to use Patterns 1 & 2
        }
      }
    }

    return trimmed;
  };

  const handleEmployeeScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      console.log('SCAN SUCCESS (Employee):', data.text);
      const rawText = data.text.trim();
      const empId = extractId(rawText);

      setScanningEmployee(false);
      const loadingToast = toast.loading(`Fetching employee ${empId}...`);

      try {
        const API_BASE = window.location.hostname === 'localhost'
          ? 'http://localhost:3001'
          : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

        const response = await fetch(`${API_BASE}/api/masters/employees/code/${empId}`);
        const result = await response.json();

        if (result.success && result.data) {
          const empName = result.data.name;
          const empDbId = result.data.id;
          setFormData(prev => ({
            ...prev,
            employee_id: empId,
            employee_db_id: empDbId,
            employee_name: empName,
          }));
          toast.success(`Employee detected: ${empName}`, { id: loadingToast });
          if (navigator.vibrate) navigator.vibrate(100);
        } else {
          setFormData(prev => ({
            ...prev,
            employee_id: empId,
            employee_name: 'Unknown Employee',
          }));
          toast.error(`Employee ${empId} not found`, { id: loadingToast });
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
        setFormData(prev => ({
          ...prev,
          employee_id: empId,
          employee_name: 'Scan Error',
        }));
        toast.error('Connection error while fetching employee', { id: loadingToast });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleMachineScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      console.log('SCAN SUCCESS (Machine):', data.text);
      const rawText = data.text.trim();
      const machId = extractId(rawText);

      setScanningMachine(false);
      const loadingToast = toast.loading(`Fetching machine ${machId}...`);

      try {
        const API_BASE = window.location.hostname === 'localhost'
          ? 'http://localhost:3001'
          : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

        const response = await fetch(`${API_BASE}/api/masters/machine_centres/code/${machId}`);
        const result = await response.json();

        if (result.success && result.data) {
          setFormData(prev => ({
            ...prev,
            machine_id: machId,
            // We can temporarily store the name in the component state if we want to show it
          }));
          toast.success(`Machine detected: ${result.data.name || machId}`, { id: loadingToast });
        } else {
          setFormData(prev => ({ ...prev, machine_id: machId }));
          toast.success(`Machine ID locked: ${machId}`, { id: loadingToast });
        }
      } catch (e) {
        setFormData(prev => ({ ...prev, machine_id: machId }));
        toast.success(`Machine ID locked: ${machId}`, { id: loadingToast });
      } finally {
        if (navigator.vibrate) navigator.vibrate(100);
        setTimeout(() => setIsProcessing(false), 500);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_id || !formData.machine_id) {
      toast.error('Please scan employee and machine QR codes');
      return;
    }

    setLoading(true);
    try {
      let sessionId = urlSessionId;

      if (!sessionId && formData.machine_id.includes('session=')) {
        const params = new URLSearchParams(formData.machine_id.split('?')[1]);
        sessionId = params.get('session');
      } else if (!sessionId && formData.machine_id === 'DEMO-SESSION') {
        sessionId = 'DEMO-SESSION';
      }

      const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

      if (sessionId) {
        let finalMachineId = formData.machine_id;

        if (finalMachineId.includes('session=')) {
          const urlParams = new URLSearchParams(finalMachineId.split('?')[1]);
          finalMachineId = urlParams.get('machine') || finalMachineId;
        }

        // Clean ID
        const activeSessionId = sessionId.trim().toLowerCase();

        // The DDL says emp_id is an Int, but legacy logic used emp_code. 
        // We'll send both to ensure the backend controller finds what it needs.
        const payload = {
          session_id: activeSessionId,
          machine_id: finalMachineId,
          emp_id: formData.employee_db_id ? Number(formData.employee_db_id) : null,
          emp_code: formData.employee_id, // e.g. "EMP-1001"
          work_centre_id: 1,
          status: 'active'
        };

        console.log('Final Activation Payload:', payload);
        const loadingToast = toast.loading('Synchronizing with display...');

        const fetchUrl = `${API_BASE}/api/mobile-session/activate`;
        setDebugLog({ url: fetchUrl, payload, response: 'Sending...' });

        try {
          const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          console.log('Activation Response:', result);

          // Persist debug info for the next page
          const debugData = { url: fetchUrl, payload, response: result };
          setDebugLog(debugData);
          sessionStorage.setItem('last_activation_debug', JSON.stringify(debugData));

          if (result.success || activeSessionId === 'demo-session') {
            toast.success(`Connected! Laptop will update in 5s.`, { id: loadingToast, duration: 3000 });

            // Navigate the phone to its dashboard
            const targetPath = `/mobile/${encodeURIComponent(finalMachineId)}/${encodeURIComponent(formData.employee_id)}`;
            setTimeout(() => navigate(targetPath), 1000);
          } else {
            // Show the actual error from the server (e.g. "Session not found")
            toast.error(result.message || 'Server rejected activation.', { id: loadingToast });
          }
        } catch (err) {
          console.error('Activation Error:', err);
          toast.error('Network error. Is the backend online?', { id: loadingToast });
        }
        return;
      }

      sessionStorage.setItem('mobile_setup_data', JSON.stringify({
        employee_id: formData.employee_id,
        employee_name: formData.employee_name,
        machine_id: formData.machine_id,
        login_date_time: formData.login_date_time
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Line setup complete! Opening production screen...');
      navigate(`/mobile/${encodeURIComponent(formData.machine_id)}/${encodeURIComponent(formData.employee_id)}`);

    } catch (error) {
      console.error('Error during setup:', error);
      toast.error('Setup failed. Please ensure Backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanError = (err: any) => {
    console.error(err);
    toast.error('Could not start scanner. Please grant camera permission and try again.');
    setScanningEmployee(false);
    setScanningMachine(false);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Line Setup</h1>
          </div>
          <div className="flex items-center gap-2">
            {urlSessionId && (
              <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                REMOTE
              </div>
            )}
            <button
              onClick={() => {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.removeItem('app_authenticated');
                  sessionStorage.removeItem('mobile_authenticated');
                }
                navigate('/');
                toast.success('Logged out');
              }}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="h-6 w-6 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scan Employee ID <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setLastScanned(null);
                  setIsProcessing(false);
                  setScannerKey(prev => prev + 1);
                  setScanningEmployee(true);
                }}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-base flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode className="h-5 w-5" />
                Scan QR Code
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Name
              </label>
              <input
                type="text"
                value={formData.employee_name}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scan Machine ID <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setLastScanned(null);
                  setIsProcessing(false);
                  setScannerKey(prev => prev + 1);
                  setScanningMachine(true);
                }}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-base flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode className="h-5 w-5" />
                Scan QR Code
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Machine ID
              </label>
              <input
                type="text"
                value={formData.machine_id}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Setup Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.login_date_time}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="h-5 w-5" />
              {loading ? 'Processing...' : 'Complete Setup'}
            </button>
          </form>
        </div>

        {/* Debug UI for User to verify API calls on Mobile */}
        {debugLog && (
          <div className="mt-8 p-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
              <h3 className="text-blue-400 font-mono text-xs font-bold uppercase tracking-wider">Mobile Debug Inspector</h3>
              <button onClick={() => setDebugLog(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 font-mono text-[10px]">
              <div>
                <p className="text-gray-500 mb-1 font-bold uppercase">Endpoint:</p>
                <div className="bg-gray-800 p-2 rounded text-blue-300 break-all border border-gray-700">{debugLog.url}</div>
              </div>

              <div>
                <p className="text-gray-500 mb-1 font-bold uppercase">Request Payload:</p>
                <pre className="bg-gray-800 p-2 rounded text-green-400 overflow-x-auto border border-gray-700">
                  {JSON.stringify(debugLog.payload, null, 2)}
                </pre>
              </div>

              <div>
                <p className="text-gray-500 mb-1 font-bold uppercase">Server Response:</p>
                <pre className={`bg-gray-800 p-2 rounded overflow-x-auto border border-gray-700 ${debugLog.response?.success ? 'text-green-400' : 'text-red-400'}`}>
                  {JSON.stringify(debugLog.response, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {(scanningEmployee || scanningMachine) && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg max-w-sm w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {scanningEmployee ? 'Scan Employee QR' : 'Scan Machine QR'}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScannerKey(prev => prev + 1)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors text-blue-600"
                    title="Refresh Camera"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setScanningEmployee(false);
                      setScanningMachine(false);
                      setLastScanned(null);
                      setIsProcessing(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="w-full relative overflow-hidden rounded-lg bg-black flex items-center justify-center" style={{ minHeight: '300px' }}>
                <ModernScanner
                  onScan={(text: string) => {
                    if (text && !isProcessing) {
                      const trimmed = text.trim();
                      setLastScanned(trimmed);
                      if (scanningEmployee) handleEmployeeScan({ text: trimmed });
                      else handleMachineScan({ text: trimmed });
                    }
                  }}
                  onError={handleScanError}
                  facingMode="environment"
                />
                {lastScanned && (
                  <div className="absolute top-2 left-2 right-2 bg-green-600 bg-opacity-90 text-white text-[10px] p-2 rounded-md text-center font-bold shadow-lg">
                    LOCKED: {lastScanned}
                  </div>
                )}
              </div>
              <div className="mt-4 text-center">
                <p className="text-[11px] text-gray-500 font-medium">
                  Tip: If it doesn't scan, move your phone slowly <br />
                  closer or further from the laptop screen.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};