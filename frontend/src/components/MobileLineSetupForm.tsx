import React from 'react';
import {
  Save,
  ArrowLeft,
  QrCode,
  LogOut,
  Cpu,
  User,
  CheckCircle2,
  Circle,
  ScanLine,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ModernScanner } from './ModernScanner';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { SearchableSelect } from './SearchableSelect';
import {
  extractLegacyId,
  parseMachineQr,
  resolveWorkCentreId,
  type WorkCentreOption,
} from '../utils/parseMachineQr';

interface EmployeeOption {
  code: string;
  name: string;
  work_centre_id?: number;
}

interface MachineOption {
  machine_id: string;
  name?: string;
  machine_name?: string;
  work_centre_id?: number;
}

interface FormData {
  employee_id: string; // The code (e.g. EMP-1001)
  employee_db_id?: number | string; // The numeric PK
  employee_name: string;
  machine_id: string;
  machine_name?: string;
  work_centre_id?: number;
  work_centre_name?: string;
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

  const handleEmployeeScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      const empId = extractLegacyId(data.text.trim());
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
            work_centre_id:
              prev.machine_id && prev.work_centre_id != null
                ? prev.work_centre_id
                : result.data.work_centre_id,
            work_centre_name:
              prev.machine_id && prev.work_centre_name
                ? prev.work_centre_name
                : workCentreLabel(result.data.work_centre_id),
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
        body: JSON.stringify({
          code: newEmpDialog.empCode,
          name,
          work_centre_id: formData.work_centre_id || 5,
        }),
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

  const workCentreLabel = (wcId?: number) => {
    if (wcId == null) return '';
    const wc = workCentres.find((w) => w.id === wcId);
    return wc?.name || wc?.code || `Line ${wcId}`;
  };

  const handleMachineScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      const parsed = parseMachineQr(data.text.trim());
      if (!parsed?.machineId) {
        toast.error('Could not read machine QR code');
        setIsProcessing(false);
        return;
      }

      const machId = parsed.machineId;
      const wcFromQr = resolveWorkCentreId(parsed, workCentres);
      setScanningMachine(false);
      const loadingToast = toast.loading(`Fetching machine ${machId}...`);

      try {
        const response = await fetchWithRetry(
          `${API_BASE}/api/masters/machine_centres/machine_id/${encodeURIComponent(machId)}`
        );
        const result = await response.json();

        const wcId = wcFromQr ?? result.data?.work_centre_id;
        const wcName = workCentreLabel(wcId);

        if (result.success && result.data) {
          setFormData((prev) => ({
            ...prev,
            machine_id: machId,
            machine_name: result.data.name || result.data.machine_name,
            work_centre_id: wcId ?? prev.work_centre_id,
            work_centre_name: wcName || prev.work_centre_name,
          }));
          const lineHint = wcName ? ` on ${wcName}` : '';
          toast.success(`Machine detected: ${result.data.name}${lineHint}`, { id: loadingToast });
        } else {
          setFormData((prev) => ({
            ...prev,
            machine_id: machId,
            work_centre_id: wcId ?? prev.work_centre_id,
            work_centre_name: wcName || prev.work_centre_name,
          }));
          toast.success(
            wcName ? `Machine ${machId} — ${wcName}` : `Machine ID locked: ${machId}`,
            { id: loadingToast }
          );
        }
      } catch {
        setFormData((prev) => ({
          ...prev,
          machine_id: machId,
          work_centre_id: wcFromQr ?? prev.work_centre_id,
          work_centre_name: workCentreLabel(wcFromQr) || prev.work_centre_name,
        }));
        toast.success(`Machine ID locked: ${machId}`, { id: loadingToast });
      } finally {
        setTimeout(() => setIsProcessing(false), 500);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.machine_id) {
      toast.error('Please select or scan employee and machine');
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

  // Manual entry shown first; scan is secondary below
  const [manualEmpEntry, setManualEmpEntry] = React.useState(true);
  const [manualMachEntry, setManualMachEntry] = React.useState(true);
  const [manualEmpInput, setManualEmpInput] = React.useState('');
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [machines, setMachines] = React.useState<MachineOption[]>([]);
  const [workCentres, setWorkCentres] = React.useState<WorkCentreOption[]>([]);
  const [mastersLoading, setMastersLoading] = React.useState(false);

  React.useEffect(() => {
    const loadMasters = async () => {
      setMastersLoading(true);
      try {
        const [empRes, machineRes, wcRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/masters/employees?limit=1000`).then((r) => r.json()),
          apiFetch(`${API_BASE}/api/masters/machine_centres?limit=500`).then((r) => r.json()),
          apiFetch(`${API_BASE}/api/masters/work_centres?limit=200`).then((r) => r.json()),
        ]);
        if (empRes.success) setEmployees(empRes.data || []);
        if (machineRes.success) setMachines(machineRes.data || []);
        if (wcRes.success) setWorkCentres(wcRes.data || []);
      } catch {
        toast.error('Failed to load employee and machine lists');
      } finally {
        setMastersLoading(false);
      }
    };
    loadMasters();
  }, []);

  const employeeSelectOptions = React.useMemo(
    () =>
      employees.map((emp) => ({
        value: emp.code,
        label: `${emp.code} - ${emp.name}`,
      })),
    [employees]
  );

  const workCentreSelectOptions = React.useMemo(
    () =>
      [...workCentres]
        .sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || ''))
        .map((wc) => ({
          value: String(wc.id),
          label: wc.name || wc.code || `Line ${wc.id}`,
        })),
    [workCentres]
  );

  const machineSelectOptionsForLine = React.useMemo(() => {
    if (formData.work_centre_id == null) return [];
    return machines
      .filter((m) => m.work_centre_id === formData.work_centre_id)
      .map((m) => ({
        value: m.machine_id,
        label: `${m.machine_id} - ${m.machine_name || m.name || 'Machine'}`,
      }));
  }, [machines, formData.work_centre_id]);

  React.useEffect(() => {
    if (!formData.machine_id || machines.length === 0 || workCentres.length === 0) return;
    const m = machines.find((x) => x.machine_id === formData.machine_id);
    if (!m?.work_centre_id || formData.work_centre_id != null) return;
    const wc = workCentres.find((w) => w.id === m.work_centre_id);
    setFormData((prev) => ({
      ...prev,
      work_centre_id: m.work_centre_id,
      work_centre_name: wc?.name || wc?.code || `Line ${m.work_centre_id}`,
    }));
  }, [machines, workCentres, formData.machine_id, formData.work_centre_id]);

  const handleLineSelect = (wcIdStr: string) => {
    if (!wcIdStr) {
      setFormData((prev) => ({
        ...prev,
        work_centre_id: undefined,
        work_centre_name: undefined,
        machine_id: '',
        machine_name: undefined,
      }));
      return;
    }
    const wcId = Number(wcIdStr);
    const wc = workCentres.find((w) => w.id === wcId);
    setFormData((prev) => ({
      ...prev,
      work_centre_id: wcId,
      work_centre_name: wc?.name || wc?.code || `Line ${wcId}`,
      machine_id: prev.work_centre_id === wcId ? prev.machine_id : '',
      machine_name: prev.work_centre_id === wcId ? prev.machine_name : undefined,
    }));
  };

  const handleMachineFromDropdown = (machineId: string) => {
    if (!machineId) {
      setFormData((prev) => ({ ...prev, machine_id: '', machine_name: undefined }));
      return;
    }
    const m = machines.find((x) => x.machine_id === machineId);
    if (m) {
      const wcId = m.work_centre_id ?? formData.work_centre_id;
      setFormData((prev) => ({
        ...prev,
        machine_id: m.machine_id,
        machine_name: m.machine_name || m.name,
        work_centre_id: wcId,
        work_centre_name: workCentreLabel(wcId),
      }));
      return;
    }
    void handleMachineScan({ text: machineId });
  };

  const handleManualEmployeeSubmit = async () => {
    const empId = manualEmpInput.trim();
    if (!empId) return;
    await handleEmployeeScan({ text: empId });
    setManualEmpInput('');
    setManualEmpEntry(false);
  };

  const handleScanError = (err: any) => {
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

  const manualInputClass =
    'w-full min-h-[3rem] border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white touch-manipulation';
  const verifyBtnClass = (enabled: boolean) =>
    `w-full sm:w-auto sm:min-w-[8.5rem] min-h-[3rem] px-6 py-3 rounded-xl text-base font-bold transition-colors touch-manipulation shrink-0 ${
      enabled
        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md ring-2 ring-blue-200 active:scale-[0.98]'
        : 'bg-slate-200 text-slate-600 border border-slate-300 cursor-not-allowed'
    }`;

  const machineReady = Boolean(formData.machine_id);
  const operatorReady = Boolean(formData.employee_id);
  const canSubmit = machineReady && operatorReady && !loading;
  const setupSteps = [
    { id: 'machine', label: 'Machine', done: machineReady },
    { id: 'operator', label: 'Operator', done: operatorReady },
  ] as const;

  const scanBtnClass =
    'w-full min-h-[3.25rem] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-base font-bold flex items-center justify-center gap-2.5 transition-all shadow-md shadow-emerald-600/20 touch-manipulation active:scale-[0.98] disabled:opacity-60';

  const renderSelectionCard = (
    ready: boolean,
    emptyText: string,
    primary: string,
    secondary: string,
    tertiary?: string,
    onClear?: () => void
  ) =>
    ready ? (
      <div className="flex items-start gap-3 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-4 py-3.5 shadow-sm">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Confirmed</p>
          <p className="truncate text-sm font-bold text-gray-900">{primary}</p>
          <p className="truncate text-sm text-gray-600">{secondary}</p>
          {tertiary && <p className="truncate text-xs text-gray-500">{tertiary}</p>}
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 touch-manipulation"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    ) : (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-4 py-3.5">
        <Circle className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
        <p className="text-sm font-medium text-gray-500">{emptyText}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-gray-50 to-slate-100 px-3 py-4 sm:p-4 font-sans pb-28 sm:pb-8">
      <div className="max-w-lg mx-auto w-full space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-white/80 bg-white p-2.5 shadow-sm transition-colors hover:bg-gray-50 touch-manipulation shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6 text-gray-700" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Line Setup</h1>
              <p className="truncate text-xs text-gray-500 sm:text-sm">Link machine and operator to the display</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {urlSessionId && (
              <span className="flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Remote
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                navigate('/');
              }}
              className="rounded-xl border border-white/80 bg-white p-2.5 shadow-sm transition-colors hover:bg-gray-50 touch-manipulation"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </header>

        <div className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm backdrop-blur sm:p-4">
          <div className="flex items-center justify-between gap-2">
            {setupSteps.map((step, i) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      step.done
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'border-2 border-gray-200 bg-white text-gray-400'
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${step.done ? 'text-emerald-700' : 'text-gray-500'}`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < setupSteps.length - 1 && (
                  <div
                    className={`mb-5 h-0.5 flex-1 rounded-full ${machineReady ? 'bg-emerald-400' : 'bg-gray-200'}`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {mastersLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Loading lines, machines and employees…
          </div>
        )}

        <form id="line-setup-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1 — Machine */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md shadow-gray-200/50">
            <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <Cpu className="h-5 w-5 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Step 1</p>
                <h2 className="text-base font-bold text-gray-900">Machine details</h2>
              </div>
              {machineReady && <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />}
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {manualMachEntry && (
                <div className="space-y-3 rounded-xl border border-blue-200/80 bg-blue-50/50 p-3.5 sm:p-4">
                  <p className="text-sm font-bold text-blue-900">Choose from list</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-800">Production line</label>
                    <SearchableSelect
                      value={formData.work_centre_id != null ? String(formData.work_centre_id) : ''}
                      onChange={handleLineSelect}
                      options={workCentreSelectOptions}
                      placeholder="Select line"
                      searchPlaceholder="Search line name..."
                      disabled={isProcessing || mastersLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-800">Machine</label>
                    <SearchableSelect
                      value={formData.machine_id}
                      onChange={handleMachineFromDropdown}
                      options={machineSelectOptionsForLine}
                      placeholder={
                        formData.work_centre_id == null ? 'Select a line first' : 'Select machine'
                      }
                      searchPlaceholder="Search machine ID or name..."
                      disabled={
                        isProcessing || mastersLoading || formData.work_centre_id == null
                      }
                    />
                    {formData.work_centre_id != null && machineSelectOptionsForLine.length === 0 && (
                      <p className="text-xs text-amber-700">No machines found on this line.</p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setManualMachEntry((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-blue-700 transition-colors hover:text-blue-900"
              >
                {manualMachEntry ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Hide list selection
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Show list selection
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <ScanLine className="h-3.5 w-3.5" /> or scan
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setScannerKey((prev) => prev + 1);
                  setScanningMachine(true);
                }}
                className={scanBtnClass}
              >
                <QrCode className="h-5 w-5 shrink-0" /> Scan machine QR
              </button>

              {renderSelectionCard(
                machineReady,
                'Select or scan a machine to continue',
                formData.machine_name || formData.machine_id,
                formData.machine_id,
                formData.work_centre_name ? `Line · ${formData.work_centre_name}` : undefined,
                () => setFormData((prev) => ({ ...prev, machine_id: '', machine_name: undefined }))
              )}
            </div>
          </section>

          {/* Step 2 — Operator */}
          <section
            className={`overflow-hidden rounded-2xl border bg-white shadow-md shadow-gray-200/50 transition-opacity ${
              machineReady ? 'border-gray-100 opacity-100' : 'border-gray-100 opacity-95'
            }`}
          >
            <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                <User className="h-5 w-5 text-violet-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Step 2</p>
                <h2 className="text-base font-bold text-gray-900">Operator details</h2>
              </div>
              {operatorReady && <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />}
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {!machineReady && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 border border-amber-100">
                  Complete machine setup first, then assign the operator.
                </p>
              )}

              {manualEmpEntry && (
                <div className="space-y-3 rounded-xl border border-violet-200/80 bg-violet-50/40 p-3.5 sm:p-4">
                  <p className="text-sm font-bold text-violet-900">Choose from list</p>
                  <SearchableSelect
                    value={formData.employee_id}
                    onChange={(code) => {
                      if (code) handleEmployeeScan({ text: code });
                    }}
                    options={employeeSelectOptions}
                    placeholder="Select employee"
                    searchPlaceholder="Search by code or name..."
                    disabled={isProcessing || mastersLoading || !machineReady}
                  />
                  <p className="text-center text-xs font-medium text-gray-500">or type employee code</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      value={manualEmpInput}
                      onChange={(e) => setManualEmpInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualEmployeeSubmit()}
                      placeholder="e.g. 165 or EMP-1001"
                      disabled={!machineReady}
                      className={manualInputClass}
                    />
                    <button
                      type="button"
                      onClick={handleManualEmployeeSubmit}
                      disabled={!manualEmpInput.trim() || isProcessing || !machineReady}
                      className={verifyBtnClass(
                        !!manualEmpInput.trim() && !isProcessing && machineReady
                      )}
                    >
                      {isProcessing ? (
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      ) : (
                        'Verify'
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setManualEmpEntry((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-violet-700 transition-colors hover:text-violet-900"
              >
                {manualEmpEntry ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Hide list selection
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Show list selection
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <ScanLine className="h-3.5 w-3.5" /> or scan
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                type="button"
                disabled={isProcessing || !machineReady}
                onClick={() => {
                  setScannerKey((prev) => prev + 1);
                  setScanningEmployee(true);
                }}
                className={scanBtnClass}
              >
                <QrCode className="h-5 w-5 shrink-0" /> Scan employee card
              </button>

              {renderSelectionCard(
                operatorReady,
                'Select or scan an operator to finish',
                formData.employee_name || formData.employee_id,
                formData.employee_id,
                undefined,
                () => {
                  setFormData((prev) => ({
                    ...prev,
                    employee_id: '',
                    employee_db_id: undefined,
                    employee_name: '',
                  }));
                  setManualEmpInput('');
                }
              )}
            </div>
          </section>

          {/* Desktop submit */}
          <div className="hidden sm:block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            {!canSubmit && (
              <p className="mb-3 text-center text-sm text-gray-500">
                {!machineReady && !operatorReady && 'Select machine and operator to enable setup.'}
                {machineReady && !operatorReady && 'Add an operator to complete setup.'}
                {!machineReady && operatorReady && 'Select a machine to complete setup.'}
              </p>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full min-h-[3.5rem] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-lg font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none touch-manipulation"
            >
              {loading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" /> Syncing…
                </>
              ) : (
                <>
                  <Save className="h-6 w-6" /> Complete setup
                </>
              )}
            </button>
          </div>
        </form>

        {/* Sticky mobile submit */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/90 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md sm:hidden pb-safe">
          {!canSubmit && (
            <p className="mb-2 text-center text-xs font-medium text-gray-500">
              {!machineReady && 'Step 1: set up the machine'}
              {machineReady && !operatorReady && 'Step 2: assign the operator'}
            </p>
          )}
          <button
            type="submit"
            form="line-setup-form"
            disabled={!canSubmit}
            className="flex w-full min-h-[3.25rem] items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none touch-manipulation"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Syncing…
              </>
            ) : (
              <>
                <Save className="h-5 w-5" /> Complete setup
              </>
            )}
          </button>
        </div>

        {/* New Employee Registration Dialog */}
        {newEmpDialog.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <User className="h-7 w-7 text-amber-600" />
                </div>
                <h2 className="mb-1 text-center text-lg font-bold text-gray-900">New employee</h2>
                <p className="text-center text-sm text-gray-500">
                  Code{' '}
                  <span className="font-semibold text-gray-800">{newEmpDialog.empCode}</span> is not
                  registered. Enter their name to continue.
                </p>
              </div>
              <input
                type="text"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegisterNewEmployee()}
                placeholder="Full name"
                autoFocus
                className="mb-4 w-full min-h-[3rem] rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewEmpDialog({ open: false, empCode: '' });
                    setNewEmpName('');
                  }}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegisterNewEmployee}
                  disabled={newEmpSaving || !newEmpName.trim()}
                  className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {newEmpSaving ? 'Saving…' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSuccessDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Setup complete</h2>
              <p className="mb-5 text-gray-600">
                The display will update shortly with this session.
              </p>
              <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-left text-sm">
                <p className="mb-2 font-bold text-blue-900">Session summary</p>
                <div className="space-y-2 text-blue-900/90">
                  <p>
                    <span className="font-semibold text-blue-800">Machine ·</span>{' '}
                    {formData.machine_name || formData.machine_id}
                  </p>
                  {formData.work_centre_name && (
                    <p>
                      <span className="font-semibold text-blue-800">Line ·</span>{' '}
                      {formData.work_centre_name}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-blue-800">Operator ·</span>{' '}
                    {formData.employee_name} ({formData.employee_id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSuccessDialog(false);
                  setFormData({
                    employee_id: '',
                    employee_name: '',
                    machine_id: searchParams.get('machine') || '',
                    login_date_time: new Date().toISOString().slice(0, 16),
                  });
                }}
                className="w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Start another setup
              </button>
            </div>
          </div>
        )}

        {(scanningEmployee || scanningMachine) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-4 py-3.5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    {scanningEmployee ? 'Step 2' : 'Step 1'}
                  </p>
                  <h3 className="font-bold text-gray-900">
                    {scanningEmployee ? 'Scan employee card' : 'Scan machine QR'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScanningEmployee(false);
                    setScanningMachine(false);
                  }}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close scanner"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative aspect-square bg-black">
                <ModernScanner
                  key={scannerKey}
                  onScan={(text) => {
                    if (scanningEmployee) handleEmployeeScan({ text });
                    else handleMachineScan({ text });
                  }}
                  onError={handleScanError}
                />
              </div>
              <div className="bg-slate-50 px-5 py-4 text-center">
                <p className="text-sm font-medium leading-relaxed text-gray-600">
                  Hold the QR code steady inside the frame — it will detect automatically.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};