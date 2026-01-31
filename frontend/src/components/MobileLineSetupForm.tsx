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

  const [formData, setFormData] = React.useState<FormData>({
    employee_id: '',
    employee_name: '',
    machine_id: searchParams.get('machine') || '',
    login_date_time: new Date().toISOString().slice(0, 16),
  });

  // Auto-submit removed - manual click required as per request

  const handleEmployeeScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      console.log('SCAN SUCCESS (Employee):', data.text);
      const empId = data.text.trim();

      setScanningEmployee(false);
      const loadingToast = toast.loading('Fetching employee details...');

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

  const handleMachineScan = (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      console.log('SCAN SUCCESS (Machine):', data.text);
      const machId = data.text.trim();
      setFormData(prev => ({ ...prev, machine_id: machId }));
      setScanningMachine(false);
      if (navigator.vibrate) navigator.vibrate(100);
      toast.success(`Machine detected: ${machId}`);
      setTimeout(() => setIsProcessing(false), 500);
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

        // Use robust payload mapping for both snake_case and camelCase backends
        const activationId = sessionId.trim().toLowerCase();
        const numericEmpId = formData.employee_db_id ? parseInt(formData.employee_db_id.toString(), 10) : null;

        const payload = {
          session_id: activationId,
          sessionId: activationId,
          machine_id: finalMachineId,
          machineId: finalMachineId,
          emp_id: numericEmpId,
          employeeId: numericEmpId,
          emp_code: formData.employee_id,
          employeeCode: formData.employee_id,
          work_centre_id: 1,
          status: 'active'
        };

        console.log('ACTIVATE ATTEMPT:', payload);
        const loadingToast = toast.loading('Connecting display...');

        try {
          const response = await fetch(`${API_BASE}/api/mobile-session/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          console.log('ACTIVATE RESPONSE:', result);

          if (result.success || sessionId === 'DEMO-SESSION') {
            toast.success(`Display Connected: ${finalMachineId}`, { id: loadingToast });
            const targetPath = `/mobile/${encodeURIComponent(finalMachineId)}/${encodeURIComponent(formData.employee_id)}`;
            setTimeout(() => navigate(targetPath), 800);
            return;
          } else {
            toast.error(result.message || 'Server rejected activation', { id: loadingToast });
            console.error('Server error details:', result);
            return;
          }
        } catch (fetchErr) {
          toast.error('Network error during activation', { id: loadingToast });
          console.error('Fetch error:', fetchErr);
          return;
        }
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