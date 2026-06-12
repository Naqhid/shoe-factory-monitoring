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
  Sparkles,
  Link2,
  List,
  Radio,
  ChevronRight,
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

interface ActiveSession {
  machine_id: string;
  emp_code?: string;
  activated_at?: string;
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

  const rejectBusyEmployee = (empCode: string) => {
    const code = String(empCode).trim();
    if (!code) return false;
    const session = activeSessionsRef.current.find(
      (s) => s.emp_code && String(s.emp_code) === code
    );
    if (!session) return false;
    toast.error(
      `Operator ${code} is already logged in on machine ${session.machine_id}. Deactivate from Login Logs before assigning to another machine.`
    );
    return true;
  };

  const handleEmployeeScan = async (data: { text: string } | null) => {
    if (data && data.text && !isProcessing) {
      setIsProcessing(true);
      const empId = extractLegacyId(data.text.trim());
      setScanningEmployee(false);
      if (rejectBusyEmployee(empId)) {
        setIsProcessing(false);
        return;
      }
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
      if (activeSessionsRef.current.some((s) => String(s.machine_id) === String(machId))) {
        rejectBusyMachine(machId);
        setScanningMachine(false);
        setIsProcessing(false);
        return;
      }
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
    if (rejectBusyEmployee(formData.employee_id)) return;
    if (rejectBusyMachine(formData.machine_id)) return;

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

  const [machineInputMode, setMachineInputMode] = React.useState<'list' | 'scan'>('list');
  const [operatorInputMode, setOperatorInputMode] = React.useState<'list' | 'scan'>('list');
  const [activeStep, setActiveStep] = React.useState<'machine' | 'operator'>('machine');
  const [manualEmpInput, setManualEmpInput] = React.useState('');
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [machines, setMachines] = React.useState<MachineOption[]>([]);
  const [workCentres, setWorkCentres] = React.useState<WorkCentreOption[]>([]);
  const [activeSessions, setActiveSessions] = React.useState<ActiveSession[]>([]);
  const activeSessionsRef = React.useRef<ActiveSession[]>([]);
  const [mastersLoading, setMastersLoading] = React.useState(false);

  const loadActiveSessions = React.useCallback(async () => {
    try {
      let res = await apiFetch(`${API_BASE}/api/mobile-sessions/active-snapshot`);
      if (!res.ok) {
        res = await apiFetch(`${API_BASE}/api/mobile-session/active-today`);
      }
      const json = await res.json();
      if (json.success) setActiveSessions(json.data || []);
    } catch {
      // Non-fatal — dropdown still works without occupancy filter
    }
  }, []);

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
        await loadActiveSessions();
      } catch {
        toast.error('Failed to load employee and machine lists');
      } finally {
        setMastersLoading(false);
      }
    };
    loadMasters();
  }, [loadActiveSessions]);

  React.useEffect(() => {
    activeSessionsRef.current = activeSessions;
  }, [activeSessions]);

  React.useEffect(() => {
    if (activeStep === 'machine' || activeStep === 'operator') {
      void loadActiveSessions();
    }
  }, [activeStep, loadActiveSessions]);

  const activeMachineIds = React.useMemo(
    () => new Set(activeSessions.map((s) => String(s.machine_id))),
    [activeSessions]
  );

  const isMachineLoggedIn = React.useCallback(
    (machineId: string) => activeMachineIds.has(String(machineId)),
    [activeMachineIds]
  );

  const employeesForLine = React.useMemo(() => {
    if (formData.work_centre_id == null) return employees;
    const onLine = employees.filter((e) => e.work_centre_id === formData.work_centre_id);
    return onLine.length > 0 ? onLine : employees;
  }, [employees, formData.work_centre_id]);

  const activeEmpCodes = React.useMemo(
    () =>
      new Set(
        activeSessions.filter((s) => s.emp_code).map((s) => String(s.emp_code))
      ),
    [activeSessions]
  );

  const loggedInEmployeesOnLine = React.useMemo(
    () => employeesForLine.filter((emp) => activeEmpCodes.has(String(emp.code))),
    [employeesForLine, activeEmpCodes]
  );

  const employeeSelectOptions = React.useMemo(() => {
    return employeesForLine
      .filter((emp) => !activeEmpCodes.has(String(emp.code)))
      .map((emp) => ({
        value: emp.code,
        label: emp.name,
        subLabel: emp.code,
      }));
  }, [employeesForLine, activeEmpCodes]);

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

  const machinesOnSelectedLine = React.useMemo(() => {
    if (formData.work_centre_id == null) return [];
    return machines.filter((m) => m.work_centre_id === formData.work_centre_id);
  }, [machines, formData.work_centre_id]);

  const loggedInMachinesOnLine = React.useMemo(
    () => machinesOnSelectedLine.filter((m) => isMachineLoggedIn(m.machine_id)),
    [machinesOnSelectedLine, isMachineLoggedIn]
  );

  const machineSelectOptionsForLine = React.useMemo(() => {
    return machinesOnSelectedLine
      .filter((m) => !isMachineLoggedIn(m.machine_id))
      .map((m) => ({
        value: m.machine_id,
        label: `${m.machine_id} - ${m.machine_name || m.name || 'Machine'}`,
      }));
  }, [machinesOnSelectedLine, isMachineLoggedIn]);

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

  const rejectBusyMachine = (machineId: string) => {
    const busy = activeSessionsRef.current.find((s) => String(s.machine_id) === String(machineId));
    if (!busy) return false;
    toast.error(
      `Machine ${machineId} is already logged in${busy.emp_code ? ` (operator ${busy.emp_code})` : ''}. Deactivate from Login Logs first.`
    );
    return true;
  };

  const handleMachineFromDropdown = (machineId: string) => {
    if (!machineId) {
      setFormData((prev) => ({ ...prev, machine_id: '', machine_name: undefined }));
      return;
    }
    if (rejectBusyMachine(machineId)) return;
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
    setOperatorInputMode('list');
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
    { id: 'machine' as const, label: 'Machine', hint: 'Line & station', done: machineReady, icon: Cpu },
    { id: 'operator' as const, label: 'Operator', hint: 'Employee card', done: operatorReady, icon: User },
  ];

  const goToOperatorStep = () => {
    if (!machineReady) {
      toast.error('Select a machine first');
      return;
    }
    setActiveStep('operator');
  };

  const goToMachineStep = () => setActiveStep('machine');

  const primaryBtnClass =
    'flex min-h-[3.5rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-600 disabled:shadow-none touch-manipulation sm:text-lg';

  const secondaryBtnClass =
    'flex min-h-[3.5rem] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] touch-manipulation';

  const scanBtnClass =
    'w-full min-h-[3.5rem] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3.5 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-600/25 touch-manipulation active:scale-[0.98] disabled:opacity-60';

  const inputModeTabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all touch-manipulation ${
      active
        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
        : 'text-slate-500 hover:text-slate-700'
    }`;

  const InputModeTabs = ({
    value,
    onChange,
    disabled,
  }: {
    value: 'list' | 'scan';
    onChange: (mode: 'list' | 'scan') => void;
    disabled?: boolean;
  }) => (
    <div
      className={`flex gap-1 rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/80 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      role="tablist"
      aria-label="Input method"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'list'}
        onClick={() => onChange('list')}
        className={inputModeTabClass(value === 'list')}
      >
        <List className="h-4 w-4 shrink-0" />
        Pick from list
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'scan'}
        onClick={() => onChange('scan')}
        className={inputModeTabClass(value === 'scan')}
      >
        <QrCode className="h-4 w-4 shrink-0" />
        Scan QR
      </button>
    </div>
  );

  const renderSelectionCard = (
    ready: boolean,
    emptyText: string,
    primary: string,
    secondary: string,
    tertiary?: string,
    onClear?: () => void
  ) =>
    ready ? (
      <div className="flex items-start gap-3 rounded-2xl border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 px-4 py-4 shadow-sm ring-1 ring-emerald-100">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Selected</p>
          <p className="truncate text-base font-bold text-slate-900">{primary}</p>
          {secondary && <p className="truncate text-sm text-slate-600">{secondary}</p>}
          {tertiary && <p className="truncate text-xs font-medium text-emerald-800/80">{tertiary}</p>}
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 touch-manipulation"
          >
            Change
          </button>
        )}
      </div>
    ) : (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 px-4 py-4">
        <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
        <p className="text-sm font-medium text-slate-500">{emptyText}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200/50 via-slate-50 to-slate-100 px-3 py-4 font-sans pb-32 sm:px-4 sm:pb-10">
      <div className="mx-auto w-full max-w-lg space-y-4">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-slate-800/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-violet-500" />
          <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mt-0.5 shrink-0 rounded-xl bg-white/10 p-2.5 ring-1 ring-white/15 transition-colors hover:bg-white/15 touch-manipulation"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">ProdPulse</p>
                </div>
                <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Line Setup</h1>
                <p className="mt-0.5 text-sm text-slate-300">Connect a machine and operator to the shop-floor display</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                navigate('/');
              }}
              className="shrink-0 rounded-xl bg-white/10 p-2.5 ring-1 ring-white/15 transition-colors hover:bg-white/15 touch-manipulation"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5 text-slate-200" />
            </button>
          </div>
        </div>

        {urlSessionId && (
          <div className="flex gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3.5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Radio className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-900">Remote session linked</p>
              <p className="mt-0.5 text-xs leading-relaxed text-blue-800/90">
                Complete setup here — the laptop display will update automatically when you tap{' '}
                <span className="font-semibold">Complete setup</span>.
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">
              {activeStep === 'machine' ? 'Step 1 · Choose machine' : 'Step 2 · Assign operator'}
            </p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-600">
              {activeStep === 'machine' ? '1/2' : '2/2'}
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: activeStep === 'machine' ? '50%' : '100%' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {setupSteps.map((step) => {
              const StepIcon = step.icon;
              const isCurrent = activeStep === step.id;
              const canJumpBack = step.id === 'machine' && activeStep === 'operator';
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!canJumpBack}
                  onClick={() => canJumpBack && goToMachineStep()}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                    isCurrent
                      ? 'border-blue-300 bg-blue-50/80 ring-2 ring-blue-100'
                      : step.done
                        ? 'border-emerald-200 bg-emerald-50/80'
                        : 'border-slate-200 bg-slate-50/50'
                  } ${canJumpBack ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/60' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        step.done
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-400 ring-1 ring-slate-200'
                      }`}
                    >
                      {step.done ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold ${
                          isCurrent ? 'text-blue-800' : step.done ? 'text-emerald-800' : 'text-slate-700'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">{step.hint}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {mastersLoading && (
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
            <div>
              <p className="font-semibold">Loading factory data…</p>
              <p className="text-xs text-blue-700/80">Lines, machines and employees</p>
            </div>
          </div>
        )}

        <form id="line-setup-form" onSubmit={handleSubmit} className="space-y-4">
          {activeStep === 'machine' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-white px-4 py-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                  <Cpu className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">Step 1 of 2</p>
                  <h2 className="text-base font-bold text-slate-900">Choose machine</h2>
                  <p className="text-xs text-slate-500">Pick your production line, then the station</p>
                </div>
                {machineReady && <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />}
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <InputModeTabs value={machineInputMode} onChange={setMachineInputMode} />

                {machineInputMode === 'list' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Production line
                      </label>
                      <SearchableSelect
                        value={formData.work_centre_id != null ? String(formData.work_centre_id) : ''}
                        onChange={handleLineSelect}
                        options={workCentreSelectOptions}
                        placeholder="Tap to select line…"
                        searchPlaceholder="Search line name…"
                        footerCountLabel="lines"
                        disabled={isProcessing || mastersLoading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Machine</label>
                      <SearchableSelect
                        value={formData.machine_id}
                        onChange={handleMachineFromDropdown}
                        options={machineSelectOptionsForLine}
                        placeholder={
                          formData.work_centre_id == null ? 'Select a line first' : 'Tap to select machine…'
                        }
                        searchPlaceholder="Search ID or name…"
                        footerCountLabel="machines"
                        disabled={isProcessing || mastersLoading || formData.work_centre_id == null}
                      />
                      {formData.work_centre_id != null && machineSelectOptionsForLine.length === 0 && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                          {machinesOnSelectedLine.length === 0
                            ? 'No machines on this line.'
                            : `All ${loggedInMachinesOnLine.length} machine(s) on this line are already logged in today. Deactivate from Login Logs to set up again.`}
                        </p>
                      )}
                      {loggedInMachinesOnLine.length > 0 && machineSelectOptionsForLine.length > 0 && (
                        <p className="text-xs text-slate-500">
                          {loggedInMachinesOnLine.length} logged-in machine(s) hidden from this list.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Point your camera at the <span className="font-semibold text-slate-800">machine QR code</span>{' '}
                      on the station.
                    </p>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setScannerKey((prev) => prev + 1);
                        setScanningMachine(true);
                      }}
                      className={scanBtnClass}
                    >
                      <ScanLine className="h-5 w-5 shrink-0" />
                      Open camera scanner
                    </button>
                  </div>
                )}

                {renderSelectionCard(
                  machineReady,
                  'No machine selected yet',
                  formData.machine_name || formData.machine_id,
                  formData.machine_id ? `ID ${formData.machine_id}` : '',
                  formData.work_centre_name ? `Line · ${formData.work_centre_name}` : undefined,
                  () =>
                    setFormData((prev) => ({
                      ...prev,
                      machine_id: '',
                      machine_name: undefined,
                    }))
                )}
              </div>
            </section>
          )}

          {activeStep === 'operator' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 to-white px-4 py-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/25">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">Step 2 of 2</p>
                  <h2 className="text-base font-bold text-slate-900">Assign operator</h2>
                  <p className="text-xs text-slate-500">Who is running this machine today?</p>
                </div>
                {operatorReady && <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />}
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3">
                  <Cpu className="h-4 w-4 shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Selected machine</p>
                    <p className="truncate text-sm font-bold text-slate-900">
                      {formData.machine_name || formData.machine_id}
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {formData.work_centre_name ? `${formData.work_centre_name} · ` : ''}ID {formData.machine_id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToMachineStep}
                    className="shrink-0 text-xs font-semibold text-blue-700 underline-offset-2 hover:underline"
                  >
                    Change
                  </button>
                </div>

                <InputModeTabs value={operatorInputMode} onChange={setOperatorInputMode} />

                {operatorInputMode === 'list' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Employee</label>
                        {formData.work_centre_id != null && (
                          <span className="text-[10px] font-semibold text-violet-700">
                            {employeeSelectOptions.length} available
                            {loggedInEmployeesOnLine.length > 0
                              ? ` · ${loggedInEmployeesOnLine.length} logged in`
                              : ''}
                          </span>
                        )}
                      </div>
                      <SearchableSelect
                        value={formData.employee_id}
                        onChange={(code) => {
                          if (code) void handleEmployeeScan({ text: code });
                        }}
                        options={employeeSelectOptions}
                        placeholder="Tap to select operator…"
                        searchPlaceholder="Search code or name…"
                        footerCountLabel="employees"
                        disabled={isProcessing || mastersLoading}
                      />
                      {employeeSelectOptions.length === 0 && employeesForLine.length > 0 && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                          All operators on this line are already logged in on a machine today. Deactivate from Login
                          Logs to assign again.
                        </p>
                      )}
                      {loggedInEmployeesOnLine.length > 0 && employeeSelectOptions.length > 0 && (
                        <p className="text-xs text-slate-500">
                          {loggedInEmployeesOnLine.length} logged-in operator(s) hidden — they cannot be assigned to
                          another machine until deactivated.
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3.5">
                      <p className="mb-2 text-xs font-semibold text-slate-600">Or type employee code</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                        <input
                          type="text"
                          inputMode="text"
                          autoComplete="off"
                          value={manualEmpInput}
                          onChange={(e) => setManualEmpInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleManualEmployeeSubmit()}
                          placeholder="e.g. 165 or EMP-1001"
                          className={manualInputClass}
                        />
                        <button
                          type="button"
                          onClick={handleManualEmployeeSubmit}
                          disabled={!manualEmpInput.trim() || isProcessing}
                          className={verifyBtnClass(!!manualEmpInput.trim() && !isProcessing)}
                        >
                          {isProcessing ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Look up'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Scan the <span className="font-semibold text-slate-800">employee ID card</span> barcode or QR.
                    </p>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setScannerKey((prev) => prev + 1);
                        setScanningEmployee(true);
                      }}
                      className={scanBtnClass}
                    >
                      <ScanLine className="h-5 w-5 shrink-0" />
                      Open camera scanner
                    </button>
                  </div>
                )}

                {renderSelectionCard(
                  operatorReady,
                  'No operator assigned yet',
                  formData.employee_name || formData.employee_id,
                  formData.employee_id ? `Code ${formData.employee_id}` : '',
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

                {canSubmit && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Link2 className="h-4 w-4 shrink-0" />
                      <p className="text-sm font-bold">Ready to connect display</p>
                    </div>
                    <p className="mt-1 text-xs text-emerald-700/90">
                      {formData.employee_name} → {formData.machine_name || formData.machine_id}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </form>

        {/* Step navigation — fixed bottom */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-3 py-3 shadow-[0_-12px_32px_rgba(15,23,42,0.12)] backdrop-blur-lg pb-safe">
          <div className="mx-auto flex max-w-lg gap-2">
            {activeStep === 'operator' && (
              <button type="button" onClick={goToMachineStep} className={`${secondaryBtnClass} min-w-[7rem] shrink-0`}>
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>
            )}
            {activeStep === 'machine' ? (
              <button
                type="button"
                onClick={goToOperatorStep}
                disabled={!machineReady}
                className={primaryBtnClass}
              >
                Next
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="submit"
                form="line-setup-form"
                disabled={!canSubmit}
                className={primaryBtnClass}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Connecting…
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" /> Complete setup
                  </>
                )}
              </button>
            )}
          </div>
          {activeStep === 'machine' && !machineReady && (
            <p className="mx-auto mt-2 max-w-lg text-center text-xs font-medium text-slate-500">
              Select or scan a machine to continue
            </p>
          )}
          {activeStep === 'operator' && !operatorReady && (
            <p className="mx-auto mt-2 max-w-lg text-center text-xs font-medium text-slate-500">
              Select or scan an operator to finish
            </p>
          )}
        </div>

        {/* New Employee Registration Dialog */}
        {newEmpDialog.open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="h-1 bg-amber-400" />
              <div className="p-6">
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 ring-4 ring-amber-50">
                    <User className="h-7 w-7 text-amber-700" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Register new employee</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Code <span className="font-mono font-bold text-slate-900">{newEmpDialog.empCode}</span> was
                    not found. Add their name to continue setup.
                  </p>
                </div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Full name
                </label>
                <input
                  type="text"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegisterNewEmployee()}
                  placeholder="e.g. Maria Garcia"
                  autoFocus
                  className="mb-5 w-full min-h-[3rem] rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setNewEmpDialog({ open: false, empCode: '' });
                      setNewEmpName('');
                    }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRegisterNewEmployee}
                    disabled={newEmpSaving || !newEmpName.trim()}
                    className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
                  >
                    {newEmpSaving ? 'Saving…' : 'Register & continue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSuccessDialog && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-blue-500 to-violet-500" />
              <div className="p-6 text-center sm:p-8">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">You&apos;re connected!</h2>
                <p className="mt-2 text-sm text-slate-600">
                  The shop-floor display will refresh in a few seconds with this session.
                </p>
                <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Session summary</p>
                  <div className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
                    <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{formData.machine_name || formData.machine_id}</p>
                      <p className="text-xs text-slate-500">
                        {formData.work_centre_name ? `${formData.work_centre_name} · ` : ''}ID {formData.machine_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{formData.employee_name}</p>
                      <p className="text-xs text-slate-500">Code {formData.employee_id}</p>
                    </div>
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
                    setMachineInputMode('list');
                    setOperatorInputMode('list');
                    setActiveStep('machine');
                  }}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-3.5 font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:from-blue-700 hover:to-blue-800"
                >
                  Start another setup
                </button>
              </div>
            </div>
          </div>
        )}

        {(scanningEmployee || scanningMachine) && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/95 p-0 sm:items-center sm:p-4">
            <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {scanningEmployee ? 'Step 2 of 2' : 'Step 1 of 2'}
                  </p>
                  <h3 className="font-bold text-slate-900">
                    {scanningEmployee ? 'Scan employee card' : 'Scan machine QR'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScanningEmployee(false);
                    setScanningMachine(false);
                  }}
                  className="rounded-xl bg-slate-100 p-2.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                  aria-label="Close scanner"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative aspect-square bg-black">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 to-transparent px-4 py-3">
                  <p className="text-center text-xs font-medium text-white/90">
                    Align the code inside the frame
                  </p>
                </div>
                <ModernScanner
                  key={scannerKey}
                  onScan={(text) => {
                    if (scanningEmployee) void handleEmployeeScan({ text });
                    else void handleMachineScan({ text });
                  }}
                  onError={handleScanError}
                />
              </div>
              <div className="bg-slate-50 px-5 py-4 text-center">
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  Hold steady — detection is automatic. Tap ✕ to cancel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};