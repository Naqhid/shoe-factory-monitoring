import React from 'react';
import { Save, ArrowLeft, QrCode, LogOut, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ModernScanner } from './ModernScanner';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

interface FormData {
  employee_id: string; // The code (e.g. EMP-1001)
  employee_db_id?: number | string; // The numeric PK
  employee_name: string;
  machine_id: string;
  machine_name?: string;
  work_centre_id?: number;
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
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);

  // New employee registration dialog state
  const [newEmpDialog, setNewEmpDialog] = React.useState<{ open: boolean; empCode: string }>({ open: false, empCode: '' });
  const [newEmpName, setNewEmpName] = React.useState('');
  const [newEmpSaving, setNewEmpSaving] = React.useState(false);

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchWithRetry = async (url: string, init?: RequestInit, retries = 2): Promise<Response> => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await apiFetch(url, init);
        if (!response.ok) {
          // Server is reachable; let caller handle API-level errors.
          return response;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await wait(350 * (attempt + 1));
        }
      }
    }
    throw lastError || new Error('Network request failed');
  };

  const [formData, setFormData] = React.useState<FormData>({
    employee_id: '',
    employee_name: '',
    machine_id: searchParams.get('machine') || '',
    login_date_time: new Date().toISOString().slice(0, 16),
  });

  const extractId = (text: string) => {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.includes('://')) return trimmed;
    const idMatch = trimmed.match(/ID:\s*([\w-]+)/i);
    if (idMatch) return idMatch[1].trim();
    const empMacMatch = trimmed.match(/(EMP-\d+|MAC-\d+)/i);
    if (empMacMatch) return empMacMatch[1].trim();
    const lines = trimmed.split(/\r?\n/);
    if (lines.length > 1) {
      for (const line of lines) {
        const cleaned = line.trim();
        if (cleaned.match(/^(EMP-\d+|MAC-\d+|ID:\s*[\w-]+|[\w-]+)$/i)) {
          return extractId(cleaned);
        }
      }
    }
    return trimmed;
  };

  const handleEmployeeScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      const empId = extractId(data.text.trim());
      setScanningEmployee(false);
      const loadingToast = toast.loading(`Fetching employee ${empId}...`);

      try {
        const response = await fetchWithRetry(`${API_BASE}/api/masters/employees/emp_id/${encodeURIComponent(empId)}`);
        const result = await response.json();

        if (result.success && result.data) {
          setFormData(prev => ({
            ...prev,
            employee_id: empId,
            employee_db_id: result.data.id,
            employee_name: result.data.name,
            work_centre_id: result.data.work_centre_id
          }));
          toast.success(`Employee detected: ${result.data.name}`, { id: loadingToast });
        } else {
          // Employee not found — prompt to register on the spot
          toast.dismiss(loadingToast);
          setNewEmpName('');
          setNewEmpDialog({ open: true, empCode: empId });
        }
      } catch (error) {
        toast.error('Connection error while fetching employee. Please try again.', { id: loadingToast });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleRegisterNewEmployee = async () => {
    const name = newEmpName.trim();
    if (!name) {
      toast.error('Please enter the employee name');
      return;
    }
    setNewEmpSaving(true);
    const loadingToast = toast.loading('Registering employee...');
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/employees/quick-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newEmpDialog.empCode, name, work_centre_id: 5 }),
      });
      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          employee_id: newEmpDialog.empCode,
          employee_db_id: result.data.id,
          employee_name: name,
          work_centre_id: result.data.work_centre_id,
        }));
        toast.success(`Employee registered: ${name}`, { id: loadingToast });
        setNewEmpDialog({ open: false, empCode: '' });
      } else {
        toast.error(result.error || 'Failed to register employee', { id: loadingToast });
      }
    } catch (error) {
      toast.error('Connection error. Please try again.', { id: loadingToast });
    } finally {
      setNewEmpSaving(false);
    }
  };

  const handleMachineScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      const machId = extractId(data.text.trim());
      setScanningMachine(false);
      const loadingToast = toast.loading(`Fetching machine ${machId}...`);

      try {
        const response = await fetchWithRetry(`${API_BASE}/api/masters/machine_centres/machine_id/${encodeURIComponent(machId)}`);
        const result = await response.json();

        if (result.success && result.data) {
          setFormData(prev => ({
            ...prev,
            machine_id: machId,
            machine_name: result.data.name,
            work_centre_id: result.data.work_centre_id || prev.work_centre_id
          }));
          toast.success(`Machine detected: ${result.data.name}`, { id: loadingToast });
        } else {
          setFormData(prev => ({ ...prev, machine_id: machId }));
          toast.success(`Machine ID locked: ${machId}`, { id: loadingToast });
        }
      } catch (e) {
        setFormData(prev => ({ ...prev, machine_id: machId }));
        toast.success(`Machine ID locked: ${machId}`, { id: loadingToast });
      } finally {
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
      let finalMachineId = formData.machine_id;
      if (finalMachineId.includes('session=')) {
        try {
          const urlParams = new URLSearchParams(finalMachineId.split('?')[1]);
          finalMachineId = urlParams.get('machine') || finalMachineId;
        } catch (e) {
          console.warn('Failed to parse machine id from scanned URL, using raw value:', e);
        }
      }

      const payload = {
        machine_id: finalMachineId,
        emp_id: formData.employee_id, // Send employee code as emp_id
        work_centre_id: formData.work_centre_id || 1,
        status: 'active'
      };

      const loadingToast = toast.loading('Synchronizing with display...');
      const response = await apiFetch(`${API_BASE}/api/mobile-session/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Connected! Laptop will update shortly.`, { id: loadingToast });
        setShowSuccessDialog(true);
      } else {
        if (response.status === 409) {
          toast.error(result.message || 'Active setup conflict: employee or machine is already active.', { id: loadingToast });
        } else {
          toast.error(result.message || 'Activation failed', { id: loadingToast });
        }
      }
    } catch (error) {
      toast.error('Connection error');
    } finally {
      setLoading(false);
    }
  };

  // Manual entry toggle state
  const [manualEmpEntry, setManualEmpEntry] = React.useState(false);
  const [manualMachEntry, setManualMachEntry] = React.useState(false);
  const [manualEmpInput, setManualEmpInput] = React.useState('');
  const [manualMachInput, setManualMachInput] = React.useState('');

  const handleManualEmployeeSubmit = async () => {
    const empId = manualEmpInput.trim();
    if (!empId) return;
    await handleEmployeeScan({ text: empId });
    setManualEmpInput('');
    setManualEmpEntry(false);
  };

  const handleManualMachineSubmit = async () => {
    const machId = manualMachInput.trim();
    if (!machId) return;
    await handleMachineScan({ text: machId });
    setManualMachInput('');
    setManualMachEntry(false);
  };
    console.error('Scanner error:', err);
    // Suppress common errors like 'Permission denied' or 'Not found' from being too aggressive 
    // but show them once properly.
    const msg = err?.message || err || 'Scanner error';
    if (!msg.toString().includes('NotFoundException')) {
      toast.error(`Scanner: ${msg}`);
    }
    setScanningEmployee(false);
    setScanningMachine(false);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
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
            <button onClick={() => { localStorage.clear(); navigate('/'); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <LogOut className="h-6 w-6 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Operator Details</label>
              <button
                type="button"
                onClick={() => { setScannerKey(prev => prev + 1); setScanningEmployee(true); }}
                className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <QrCode className="h-5 w-5" /> Scan Employee Card
              </button>
              <button
                type="button"
                onClick={() => { setManualEmpEntry(v => !v); setManualEmpInput(''); }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
              >
                {manualEmpEntry ? 'Hide manual entry' : "Can't scan? Type employee code"}
              </button>
              {manualEmpEntry && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualEmpInput}
                    onChange={e => setManualEmpInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualEmployeeSubmit()}
                    placeholder="e.g. EMP-1001"
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleManualEmployeeSubmit}
                    disabled={!manualEmpInput.trim() || isProcessing}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 rounded-xl font-semibold transition-colors"
                  >
                    Go
                  </button>
                </div>
              )}
              <input
                type="text"
                value={formData.employee_name || 'Waiting for scan...'}
                readOnly
                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-gray-600 font-medium"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Machine Details</label>
              <button
                type="button"
                onClick={() => { setScannerKey(prev => prev + 1); setScanningMachine(true); }}
                className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <QrCode className="h-5 w-5" /> Scan Machine QR
              </button>
              <button
                type="button"
                onClick={() => { setManualMachEntry(v => !v); setManualMachInput(''); }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
              >
                {manualMachEntry ? 'Hide manual entry' : "Can't scan? Type machine ID"}
              </button>
              {manualMachEntry && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualMachInput}
                    onChange={e => setManualMachInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualMachineSubmit()}
                    placeholder="e.g. MAC-001 or 07"
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleManualMachineSubmit}
                    disabled={!manualMachInput.trim() || isProcessing}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 rounded-xl font-semibold transition-colors"
                  >
                    Go
                  </button>
                </div>
              )}
              <input
                type="text"
                value={formData.machine_name || formData.machine_id || 'Waiting for scan...'}
                readOnly
                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-gray-600 font-medium"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-4 rounded-xl font-bold text-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <Save className="h-6 w-6" /> {loading ? 'Syncing...' : 'COMPLETE SETUP'}
              </button>
            </div>
          </form>
        </div>

        {/* New Employee Registration Dialog */}
        {newEmpDialog.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <div className="mb-4">
                <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <QrCode className="w-7 h-7 text-yellow-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 text-center mb-1">New Employee Detected</h2>
                <p className="text-sm text-gray-500 text-center">
                  Code <span className="font-semibold text-gray-700">{newEmpDialog.empCode}</span> is not registered.
                  Enter the employee's name to add them.
                </p>
              </div>
              <input
                type="text"
                value={newEmpName}
                onChange={e => setNewEmpName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegisterNewEmployee()}
                placeholder="Employee full name"
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setNewEmpDialog({ open: false, empCode: '' }); setNewEmpName(''); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegisterNewEmployee}
                  disabled={newEmpSaving || !newEmpName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  {newEmpSaving ? 'Saving...' : 'Register & Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSuccessDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
                <p className="text-gray-600 mb-4">The display device has been successfully connected and will update shortly.</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Connection Details:</p>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p><span className="font-medium">Machine:</span> {formData.machine_name || formData.machine_id}</p>
                    <p><span className="font-medium">Operator:</span> {formData.employee_name}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSuccessDialog(false);
                  setFormData({
                    employee_id: '',
                    employee_name: '',
                    machine_id: searchParams.get('machine') || '',
                    login_date_time: new Date().toISOString().slice(0, 16),
                  });
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {(scanningEmployee || scanningMachine) && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-gray-800">{scanningEmployee ? 'Operator Scan' : 'Machine Scan'}</h3>
                <button onClick={() => { setScanningEmployee(false); setScanningMachine(false); }} className="p-2 text-gray-400">✕</button>
              </div>
              <div className="aspect-square bg-black relative">
                <ModernScanner
                  key={scannerKey}
                  onScan={(text) => {
                    if (scanningEmployee) handleEmployeeScan({ text });
                    else handleMachineScan({ text });
                  }}
                  onError={handleScanError}
                />
              </div>
              <div className="p-6 text-center bg-gray-50">
                <p className="text-sm text-gray-500 leading-relaxed font-medium">Position the QR code within the box. It will automatically detect.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};