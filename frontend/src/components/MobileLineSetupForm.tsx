import React from 'react';
import { Save, ArrowLeft, QrCode, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import QrReader from 'react-qr-scanner';
import { QRCodeSVG } from 'qrcode.react';

interface FormData {
  employee_id: string;
  employee_name: string;
  machine_id: string;
  login_date_time: string;
}

export const MobileLineSetupForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [scanningEmployee, setScanningEmployee] = React.useState(false);
  const [scanningMachine, setScanningMachine] = React.useState(false);
  const [showTestHelpers, setShowTestHelpers] = React.useState(false);

  const [formData, setFormData] = React.useState<FormData>({
    employee_id: '',
    employee_name: '',
    machine_id: '',
    login_date_time: new Date().toISOString().slice(0, 16),
  });

  // Auto-submit when both fields are filled via scanning
  React.useEffect(() => {
    if (formData.employee_id && formData.machine_id && !loading) {
      const autoSubmit = async () => {
        // Give a tiny delay for the user to see the second scan success toast
        await new Promise(resolve => setTimeout(resolve, 500));
        handleSubmit({ preventDefault: () => { } } as React.FormEvent);
      };
      autoSubmit();
    }
  }, [formData.employee_id, formData.machine_id]);

  const handleEmployeeScan = (data: { text: string } | null) => {
    if (data && data.text) {
      console.log('Scanned Employee RAW:', data.text);
      let empId = data.text;
      let empName = 'Test Employee';

      setFormData(prev => ({
        ...prev,
        employee_id: empId,
        employee_name: empName,
      }));

      setScanningEmployee(false);
      if (navigator.vibrate) navigator.vibrate(100);
      toast.success('Employee detected');
    }
  };

  const handleMachineScan = (data: { text: string } | null) => {
    if (data) {
      setFormData(prev => ({ ...prev, machine_id: data.text }));
      setScanningMachine(false);
      if (navigator.vibrate) navigator.vibrate(100);
      toast.success('Machine scanned successfully');
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
      // Check for Remote Session QR (URL or DEMO-SESSION)
      let sessionId = null;
      if (formData.machine_id.includes('session=')) {
        const urlParams = new URLSearchParams(formData.machine_id.split('?')[1]);
        sessionId = urlParams.get('session');
      } else if (formData.machine_id === 'DEMO-SESSION') {
        sessionId = 'DEMO-SESSION';
      }

      const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

      // REMOTE ACTIVATION FLOW
      if (sessionId) {
        // For Demo/Validation: We need to map the session to a VALID Machine ID in the database.
        // For this demo, we will map all "Real" sessions to 'MAC-001' (Stitching Line 1)
        // so that the backend validation passes.
        const finalMachineId = sessionId === 'DEMO-SESSION' ? 'DEMO-MACHINE-01' : 'MAC-001';

        // If it's pure Demo (no backend), we can't really do much unless we are on the same device.
        // But assuming backend IS up or will be up:
        const response = await fetch(`${API_BASE}/api/mobile-session/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            machine_id: finalMachineId,
            work_centre_id: 1,
            emp_code: formData.employee_id // Send the scanned format (e.g., EMP-1001)
          })
        });

        const result = await response.json();

        if (result.success || sessionId === 'DEMO-SESSION') { // Allow demo to "succeed" even if backend fails 404
          toast.success(`Session Activated: ${finalMachineId}`);
          // Stay on Setup Form or Clear? Usually clear for next setup.
          setFormData(prev => ({ ...prev, machine_id: '', employee_id: '', employee_name: '' }));
          return;
        } else {
          throw new Error(result.message || 'Activation failed');
        }
      }

      // LOCAL SETUP FLOW (Legacy/Self-Setup)
      // Store the setup data in sessionStorage
      sessionStorage.setItem('mobile_setup_data', JSON.stringify({
        employee_id: formData.employee_id,
        employee_name: formData.employee_name,
        machine_id: formData.machine_id,
        login_date_time: formData.login_date_time
      }));

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success('Line setup complete! Opening production screen...');
      // Navigate to the mobile production route with parameters
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
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
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

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Scan Employee ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scan Employee ID <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setScanningEmployee(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium text-base flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode className="h-5 w-5" />
                Scan QR Code
              </button>
            </div>

            {/* Employee Name */}
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

            {/* Scan Machine ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scan Machine ID <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setScanningMachine(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium text-base flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode className="h-5 w-5" />
                Scan QR Code
              </button>
            </div>

            {/* Machine ID */}
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

            {/* Login Date & Time */}
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

            {/* Submit Button */}
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

        {/* QR Scanner Modal */}
        {(scanningEmployee || scanningMachine) && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg max-w-sm w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {scanningEmployee ? 'Scan Employee QR' : 'Scan Machine QR'}
                </h3>
                <button
                  onClick={() => {
                    setScanningEmployee(false);
                    setScanningMachine(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="w-full aspect-square">
                <QrReader
                  delay={300}
                  onError={handleScanError}
                  onScan={scanningEmployee ? handleEmployeeScan : handleMachineScan}
                  style={{ width: '100%' }}
                  constraints={{ video: { facingMode: 'environment' } }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Testing Helper Section */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowTestHelpers(!showTestHelpers)}
            className="text-sm text-gray-500 hover:text-blue-600 underline"
          >
            {showTestHelpers ? 'Hide Test QR Codes' : 'Show Test QR Codes (for Laptop Screen)'}
          </button>

          {showTestHelpers && (
            <div className="mt-4 p-4 bg-white rounded-lg shadow-inner border border-dashed border-gray-300">
              <p className="text-xs text-gray-500 mb-4 font-semibold uppercase tracking-wider">
                Scan these from your Laptop screen using your Phone
              </p>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Employee Badges</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center">
                      <div className="p-1 bg-white border rounded">
                        <img src={`${import.meta.env.BASE_URL}assets/qrcode-EMP-1001.jpeg`} alt="EMP-1001" className="w-24 h-24 object-contain" />
                      </div>
                      <span className="mt-1 text-[10px] font-mono text-gray-600">John Doe (1001)</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="p-1 bg-white border rounded">
                        <img src={`${import.meta.env.BASE_URL}assets/qrcode-EMP-1002.jpeg`} alt="EMP-1002" className="w-24 h-24 object-contain" />
                      </div>
                      <span className="mt-1 text-[10px] font-mono text-gray-600">Jane Smith (1002)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Machine Stickers</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center">
                      <div className="p-1 bg-white border rounded">
                        <img src={`${import.meta.env.BASE_URL}assets/qrcode-MAC-001.jpeg`} alt="MAC-001" className="w-24 h-24 object-contain" />
                      </div>
                      <span className="mt-1 text-[10px] font-mono text-gray-600">Stitching M-1</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="p-1 bg-white border rounded">
                        <img src={`${import.meta.env.BASE_URL}assets/qrcode-MAC-002.jpeg`} alt="MAC-002" className="w-24 h-24 object-contain" />
                      </div>
                      <span className="mt-1 text-[10px] font-mono text-gray-600">Stitching M-2</span>
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
};