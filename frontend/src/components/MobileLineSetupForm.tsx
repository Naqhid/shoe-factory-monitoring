import React from 'react';
import { Save, ArrowLeft, QrCode, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { QrReader } from 'react-qr-reader';

interface FormData {
  login: string;
  password: string;
  employee_id: string;
  employee_name: string;
  machine_id: string;
  login_date_time: string;
  work_centre: string;
}

export const MobileLineSetupForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [scanningEmployee, setScanningEmployee] = React.useState(false);
  const [scanningMachine, setScanningMachine] = React.useState(false);

  const [formData, setFormData] = React.useState<FormData>({
    login: '',
    password: '',
    employee_id: '',
    employee_name: '',
    machine_id: '',
    login_date_time: new Date().toISOString().slice(0, 16),
    work_centre: '',
  });

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

  // Fetch work centre on login change
  React.useEffect(() => {
    if (formData.login) {
      // Mock: populate work centre from login
      // In real app, fetch from API
      setFormData(prev => ({ ...prev, work_centre: 'Line 1' }));
    }
  }, [formData.login]);

  const handleLogin = async () => {
    if (!formData.login || !formData.password) {
      toast.error('Please enter login and password');
      return;
    }
    // Mock authentication
    // In real app, call login API
    setIsLoggedIn(true);
    toast.success('Logged in successfully');
  };

  const handleEmployeeScan = (result: any, error: any) => {
    if (result) {
      try {
        const parsed = JSON.parse(result.text);
        setFormData(prev => ({
          ...prev,
          employee_id: parsed.id,
          employee_name: parsed.name,
        }));
        setScanningEmployee(false);
        toast.success('Employee scanned successfully');
      } catch (error) {
        toast.error('Invalid QR code format');
      }
    }
    if (error) {
      console.error(error);
      toast.error('Scanning error');
    }
  };

  const handleMachineScan = (result: any, error: any) => {
    if (result) {
      setFormData(prev => ({ ...prev, machine_id: result.text }));
      setScanningMachine(false);
      toast.success('Machine scanned successfully');
    }
    if (error) {
      console.error(error);
      toast.error('Scanning error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLoggedIn) {
      await handleLogin();
      return;
    }

    if (!formData.employee_id || !formData.machine_id) {
      toast.error('Please scan employee and machine QR codes');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        login: formData.login,
        employee_id: formData.employee_id,
        machine_id: formData.machine_id,
        login_date_time: formData.login_date_time,
        work_centre: formData.work_centre,
      };

      const response = await fetch(`${API_BASE}/api/shift-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Shift started successfully');
        navigate('/mobile_live_dashboard');
      } else {
        toast.error(result.error || 'Failed to start shift');
      }
    } catch (error) {
      toast.error('Network error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-700" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Line Setup</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Login <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter login"
                required
                disabled={isLoggedIn}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                required
                disabled={isLoggedIn}
              />
            </div>

            {/* Work Centre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Centre
              </label>
              <input
                type="text"
                value={formData.work_centre}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base bg-gray-100"
              />
            </div>

            {/* Scan Employee ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scan Employee ID <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setScanningEmployee(true)}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium text-base flex items-center justify-center gap-2 transition-colors"
                disabled={!isLoggedIn}
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
                disabled={!isLoggedIn}
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
                Login Date & Time
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
              {loading ? 'Processing...' : isLoggedIn ? 'Start Shift' : 'Login'}
            </button>
          </form>
        </div>

        {/* QR Scanner for Employee */}
        {scanningEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg max-w-sm w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Scan Employee QR</h3>
                <button
                  onClick={() => setScanningEmployee(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <QrReader
                onResult={handleEmployeeScan}
                constraints={{ facingMode: 'environment' }}
              />
            </div>
          </div>
        )}

        {/* QR Scanner for Machine */}
        {scanningMachine && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg max-w-sm w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Scan Machine QR</h3>
                <button
                  onClick={() => setScanningMachine(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <QrReader
                onResult={handleMachineScan}
                constraints={{ facingMode: 'environment' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};