import React from 'react';
import { Save, ArrowLeft, QrCode, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import QrReader from 'react-qr-scanner';

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

  const [formData, setFormData] = React.useState<FormData>({
    employee_id: '',
    employee_name: '',
    machine_id: '',
    login_date_time: new Date().toISOString().slice(0, 16),
  });

  const handleEmployeeScan = (data: { text: string } | null) => {
    if (data) {
      try {
        const parsed = JSON.parse(data.text);
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
  };

  const handleMachineScan = (data: { text: string } | null) => {
    if (data) {
      setFormData(prev => ({ ...prev, machine_id: data.text }));
      setScanningMachine(false);
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
    // TODO: Implement what should happen after scanning employee and machine.
    // For now, just show a success message and navigate to the dashboard.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    toast.success('Line setup complete!');
    navigate('/mobile_live_dashboard');
    setLoading(false);
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
      </div>
    </div>
  );
};