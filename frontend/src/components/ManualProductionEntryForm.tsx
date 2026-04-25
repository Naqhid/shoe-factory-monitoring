import React from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, apiFetch } from '../services/api';

interface WorkCentre {
  id: number;
  name: string;
}

interface MachineCentre {
  machine_id: string;
  machine_name?: string;
  name?: string;
  work_centre_id?: number;
}

interface Employee {
  code: string;
  name: string;
  work_centre_id?: number;
}

interface ActiveSession {
  machine_id: string;
  emp_code: string;
  activated_at: string;
}

interface ManualEntryRow {
  id: number;
  prod_date: string;
  work_centre_id: number;
  work_centre_name?: string;
  machine_id: string;
  machine_name?: string;
  emp_id: string;
  employee_name?: string;
  target_mins: number;
  output_pairs: number;
  start_time: string;
  finish_time: string;
  stoppage_reason?: string;
}

interface ManualEntryAuditRow {
  id: number;
  entry_id: number | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  actor_user_id?: number | null;
  actor_username?: string | null;
  actor_role?: string | null;
  reason?: string | null;
  before_data?: string | null;
  after_data?: string | null;
  created_at: string;
}

interface AuditChangeRow {
  key: string;
  label: string;
  beforeValue: string;
  afterValue: string;
}

const getNowLocalDateTime = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export const ManualProductionEntryForm: React.FC = () => {
  const navigate = useNavigate();
  const [workCentres, setWorkCentres] = React.useState<WorkCentre[]>([]);
  const [machines, setMachines] = React.useState<MachineCentre[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [activeSessions, setActiveSessions] = React.useState<ActiveSession[]>([]);
  const [manualEntries, setManualEntries] = React.useState<ManualEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingEntries, setLoadingEntries] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [tableDateFilter, setTableDateFilter] = React.useState(getNowLocalDateTime().split('T')[0]);
  const [tableToDateFilter, setTableToDateFilter] = React.useState(getNowLocalDateTime().split('T')[0]);
  const [tableWorkCentreFilter, setTableWorkCentreFilter] = React.useState('');
  const [tableSearchInput, setTableSearchInput] = React.useState('');
  const [tableSearch, setTableSearch] = React.useState('');
  const [tablePage, setTablePage] = React.useState(1);
  const [tableLimit, setTableLimit] = React.useState<string>('10');
  const [tableSortBy, setTableSortBy] = React.useState<string>('created_at');
  const [tableSortOrder, setTableSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [tableTotal, setTableTotal] = React.useState(0);
  const [tableTotalPages, setTableTotalPages] = React.useState(1);
  const [tableFilteredOutputTotal, setTableFilteredOutputTotal] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'entries' | 'audit'>('entries');
  const [auditLogs, setAuditLogs] = React.useState<ManualEntryAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditEntryId, setAuditEntryId] = React.useState<number | null>(null);
  const [showRawAuditJson, setShowRawAuditJson] = React.useState(false);
  const [restoreCandidate, setRestoreCandidate] = React.useState<ManualEntryAuditRow | null>(null);
  const [deleteCandidate, setDeleteCandidate] = React.useState<ManualEntryRow | null>(null);
  const [pageInput, setPageInput] = React.useState('1');
  const FILTER_PRESET_KEY = 'manual_entry_filters_v1';

  const handleUnauthorized = React.useCallback((message?: string) => {
    toast.error(message || 'Session expired. Please login again.');
    localStorage.removeItem('app_authenticated');
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    navigate('/', { replace: true });
  }, [navigate]);

  const [workCentreId, setWorkCentreId] = React.useState('');
  const [machineId, setMachineId] = React.useState('');
  const [empId, setEmpId] = React.useState('');
  const [startTime, setStartTime] = React.useState(getNowLocalDateTime());
  const [finishTime, setFinishTime] = React.useState(getNowLocalDateTime());
  const [targetMins, setTargetMins] = React.useState('0');
  const [outputPairs, setOutputPairs] = React.useState('12');
  const [stoppageReason, setStoppageReason] = React.useState('');
  const [loadingTargetMins, setLoadingTargetMins] = React.useState(false);

  React.useEffect(() => {
    const loadMasters = async () => {
      try {
        const [wcRes, machineRes, empRes] = await Promise.all([
          apiFetch(`${API_BASE_URL}/api/masters/work_centres?limit=500`).then(r => r.json()),
          apiFetch(`${API_BASE_URL}/api/masters/machine_centres?limit=500`).then(r => r.json()),
          apiFetch(`${API_BASE_URL}/api/masters/employees?limit=1000`).then(r => r.json()),
        ]);

        if (wcRes.success) setWorkCentres(wcRes.data || []);
        if (machineRes.success) setMachines(machineRes.data || []);
        if (empRes.success) setEmployees(empRes.data || []);

        const activeRes = await apiFetch(`${API_BASE_URL}/api/mobile-sessions/active-snapshot`);
        const activeJson = await activeRes.json();
        if (activeRes.status === 401) {
          handleUnauthorized(activeJson.message);
          return;
        }
        if (activeJson.success) {
          setActiveSessions(activeJson.data || []);
        } else {
          console.warn('Failed to load active session snapshot:', activeJson.message);
        }
      } catch (error) {
        console.error('Failed to load masters for manual entry:', error);
        toast.error('Failed to load master data');
      }
    };
    loadMasters();
  }, [handleUnauthorized]);

  const filteredMachines = React.useMemo(() => {
    if (!workCentreId) return machines;
    return machines.filter((m) => String(m.work_centre_id) === String(workCentreId));
  }, [machines, workCentreId]);

  const filteredEmployees = React.useMemo(() => {
    const byLine = !workCentreId
      ? employees
      : employees.filter((e) => String(e.work_centre_id) === String(workCentreId));

    if (!activeSessions.length) return byLine;
    const blockedEmpCodes = new Set(
      activeSessions
        .filter((s) => s.emp_code && machineId && String(s.machine_id) !== String(machineId))
        .map((s) => String(s.emp_code))
    );

    return byLine.filter((e) => !blockedEmpCodes.has(String(e.code)));
  }, [employees, workCentreId, activeSessions, machineId]);

  const timeIsValid = React.useMemo(() => {
    if (!startTime || !finishTime) return false;
    const start = new Date(startTime);
    const end = new Date(finishTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return end > start;
  }, [startTime, finishTime]);

  const canSubmit =
    !!workCentreId && !!machineId && !!empId && !!startTime && !!finishTime && timeIsValid && !loading;

  const totalManualOutput = React.useMemo(
    () => manualEntries.reduce((sum, row) => sum + Number(row.output_pairs || 0), 0),
    [manualEntries]
  );

  const parseAuditJson = (value?: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const formatDisplayDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDisplayDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString('en-GB');
  };

  const getAuditActionBadgeClass = (action: string) => {
    if (action === 'CREATE') return 'bg-green-100 text-green-700';
    if (action === 'UPDATE') return 'bg-blue-100 text-blue-700';
    if (action === 'DELETE') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast.error('Copy failed');
    }
  };

  const formatMachineDisplay = (value: any): string => {
    const machineIdValue = String(value || '').trim();
    if (!machineIdValue) return '-';
    const matched = machines.find((m) => {
      const id = String(m.machine_id || '').trim();
      const code = String((m as any).code || '').trim();
      return machineIdValue === id || (code && machineIdValue === code);
    });
    const machineName = matched?.machine_name || matched?.name || '';
    return machineName ? `${machineIdValue} - ${machineName}` : machineIdValue;
  };

  const prettyAuditValue = (value: any, key: string): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (key === 'machine_id') {
      return formatMachineDisplay(value);
    }
    if (key.includes('time') || key.includes('date')) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return formatDisplayDateTime(parsed.toISOString());
      }
    }
    return String(value);
  };

  const toAuditChanges = (log: ManualEntryAuditRow): AuditChangeRow[] => {
    const beforeObj = parseAuditJson(log.before_data);
    const afterObj = parseAuditJson(log.after_data);
    const before = beforeObj && typeof beforeObj === 'object' ? beforeObj : {};
    const after = afterObj && typeof afterObj === 'object' ? afterObj : {};

    const labelMap: Record<string, string> = {
      prod_date: 'Production Date',
      work_centre_id: 'Line',
      machine_id: 'Machine',
      emp_id: 'Employee',
      start_time: 'Start Time',
      finish_time: 'End Time',
      target_mins: 'Target Time',
      output_pairs: 'Target Pairs',
      stoppage_reason: 'Reason',
    };

    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    const rows: AuditChangeRow[] = [];
    keys.forEach((key) => {
      const beforeVal = before[key];
      const afterVal = after[key];
      if (log.action === 'UPDATE' && JSON.stringify(beforeVal) === JSON.stringify(afterVal)) return;
      rows.push({
        key,
        label: labelMap[key] || key,
        beforeValue: prettyAuditValue(beforeVal, key),
        afterValue: prettyAuditValue(afterVal, key),
      });
    });
    return rows;
  };

  const clearForm = () => {
    setMachineId('');
    setEmpId('');
    setStartTime(getNowLocalDateTime());
    setFinishTime(getNowLocalDateTime());
    setTargetMins('0');
    setOutputPairs('12');
    setStoppageReason('');
    setEditingId(null);
    setShowForm(false);
  };

  const toInputDateTime = (value?: string) => {
    if (!value) return getNowLocalDateTime();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return getNowLocalDateTime();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const loadManualEntries = React.useCallback(async () => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams();
      if (tableDateFilter && tableToDateFilter && tableDateFilter === tableToDateFilter) {
        params.set('date', tableDateFilter);
      } else {
        if (tableDateFilter) params.set('from_date', tableDateFilter);
        if (tableToDateFilter) params.set('to_date', tableToDateFilter);
      }
      if (tableWorkCentreFilter) params.set('work_centre_id', tableWorkCentreFilter);
      if (tableSearch.trim()) params.set('search', tableSearch.trim());
      params.set('page', String(tablePage));
      params.set('limit', tableLimit);
      params.set('sort_by', tableSortBy);
      params.set('sort_order', tableSortOrder);
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry?${params.toString()}`);
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized(json.message);
        return;
      }
      if (json.success) {
        const rows = Array.isArray(json.data) ? json.data : [];
        const hasMeta = json.meta && typeof json.meta.total !== 'undefined';

        if (hasMeta) {
          setManualEntries(rows);
          setTableTotal(Number(json.meta?.total || 0));
          setTableTotalPages(Number(json.meta?.total_pages || 1));
          setTableFilteredOutputTotal(Number(json.meta?.total_output_pairs || 0));
        } else {
          // Backward-compatible fallback when backend is not yet restarted with pagination changes.
          const query = tableSearch.trim().toLowerCase();
          const filteredRows = query
            ? rows.filter((row: ManualEntryRow) => {
                const machine = `${row.machine_id || ''} ${row.machine_name || ''}`.toLowerCase();
                const employee = `${row.emp_id || ''} ${row.employee_name || ''}`.toLowerCase();
                const line = `${row.work_centre_name || row.work_centre_id || ''}`.toString().toLowerCase();
                return machine.includes(query) || employee.includes(query) || line.includes(query);
              })
            : rows;
          const fallbackLimit = tableLimit === 'all' ? filteredRows.length || 1 : Math.max(1, parseInt(tableLimit, 10) || 10);
          const start = tableLimit === 'all' ? 0 : (tablePage - 1) * fallbackLimit;
          const pageRows = tableLimit === 'all' ? filteredRows : filteredRows.slice(start, start + fallbackLimit);
          setManualEntries(pageRows);
          setTableTotal(filteredRows.length);
          setTableTotalPages(tableLimit === 'all' ? 1 : Math.max(1, Math.ceil(filteredRows.length / fallbackLimit)));
          setTableFilteredOutputTotal(filteredRows.reduce((sum: number, row: ManualEntryRow) => sum + Number(row.output_pairs || 0), 0));
        }
      } else {
        setManualEntries([]);
        setTableTotal(0);
        setTableTotalPages(1);
        setTableFilteredOutputTotal(0);
        toast.error(json.message || 'Failed to load manual entries');
      }
    } catch (error) {
      console.error('Failed to load manual entries:', error);
      toast.error('Failed to load manual entries');
    } finally {
      setLoadingEntries(false);
    }
  }, [tableDateFilter, tableToDateFilter, tableWorkCentreFilter, tableSearch, tablePage, tableLimit, tableSortBy, tableSortOrder, handleUnauthorized]);

  React.useEffect(() => {
    const loadTargetMins = async () => {
      if (!machineId || !empId) {
        setTargetMins('0.0');
        setOutputPairs('0');
        return;
      }
      setLoadingTargetMins(true);
      try {
        const res = await apiFetch(
          `${API_BASE_URL}/api/mobile-production/init/${encodeURIComponent(machineId)}/${encodeURIComponent(empId)}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          const nextTargetMins = Number(json.data.targetMins || 0);
          const rounded = Number.isFinite(nextTargetMins)
            ? (Math.round(nextTargetMins * 10) / 10).toFixed(1)
            : '0.0';
          setTargetMins(rounded);
          const nextTargetPairs = Number(json.data.targetPairs || 0);
          setOutputPairs(String(Number.isFinite(nextTargetPairs) ? Math.max(0, nextTargetPairs) : 0));
        }
      } catch (error) {
        console.warn('Failed to auto-load target minutes for manual entry:', error);
      } finally {
        setLoadingTargetMins(false);
      }
    };
    loadTargetMins();
  }, [machineId, empId]);

  React.useEffect(() => {
    loadManualEntries();
  }, [loadManualEntries]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setTableSearch(tableSearchInput.trim());
      setTablePage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tableSearchInput]);

  React.useEffect(() => {
    setPageInput(String(tablePage));
  }, [tablePage]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESET_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.tableDateFilter) setTableDateFilter(saved.tableDateFilter);
      if (saved.tableToDateFilter) setTableToDateFilter(saved.tableToDateFilter);
      if (typeof saved.tableWorkCentreFilter === 'string') setTableWorkCentreFilter(saved.tableWorkCentreFilter);
      if (typeof saved.tableSearchInput === 'string') setTableSearchInput(saved.tableSearchInput);
      if (saved.tableLimit) setTableLimit(saved.tableLimit);
      if (saved.tableSortBy) setTableSortBy(saved.tableSortBy);
      if (saved.tableSortOrder === 'asc' || saved.tableSortOrder === 'desc') setTableSortOrder(saved.tableSortOrder);
    } catch (error) {
      console.warn('Failed to load manual entry filter preset:', error);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCentreId || !machineId || !empId || !startTime || !finishTime) {
      toast.error('Please fill required fields');
      return;
    }
    if (!timeIsValid) {
      toast.error('End Time must be greater than Start Time');
      return;
    }

    const payload = {
      prod_date: startTime.split('T')[0],
      work_centre_id: Number(workCentreId),
      machine_id: machineId,
      emp_id: empId,
      start_time: startTime,
      finish_time: finishTime,
      target_mins: Number(targetMins || 0),
      output_pairs: Number(outputPairs || 0),
      stoppage_reason: stoppageReason.trim() || null,
    };

    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API_BASE_URL}/api/mobile-production/manual-entry/${editingId}`
        : `${API_BASE_URL}/api/mobile-production/manual-entry`;
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.status === 401) {
        handleUnauthorized(result.message);
        return;
      }
      if (!result.success) {
        toast.error(result.message || 'Failed to save manual entry');
        return;
      }
      toast.success(
        editingId
          ? `Updated. Total output today: ${result.data?.total_output_pairs ?? '-'}`
          : `Saved. Total output today: ${result.data?.total_output_pairs ?? '-'}`
      );
      await loadManualEntries();
      clearForm();
    } catch (error) {
      console.error('Manual entry save failed:', error);
      toast.error('Failed to save manual entry');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row: ManualEntryRow) => {
    setShowForm(true);
    setEditingId(row.id);
    setWorkCentreId(String(row.work_centre_id));
    setMachineId(row.machine_id);
    setEmpId(row.emp_id);
    setStartTime(toInputDateTime(row.start_time));
    setFinishTime(toInputDateTime(row.finish_time));
    setTargetMins(String(Number(row.target_mins || 0)));
    setOutputPairs(String(Number(row.output_pairs || 0)));
    setStoppageReason((row.stoppage_reason || '').replace(/^MANUAL:/, ''));
  };

  const handleDelete = async (row: ManualEntryRow) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        prod_date: String(row.prod_date || '').split('T')[0],
        work_centre_id: String(row.work_centre_id),
      });
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/${row.id}?${params.toString()}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'Failed to delete manual entry');
        return;
      }
      toast.success('Manual entry deleted');
      await loadManualEntries();
      if (editingId === row.id) clearForm();
      setDeleteCandidate(null);
    } catch (error) {
      console.error('Failed to delete manual entry:', error);
      toast.error('Failed to delete manual entry');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAudit = async (entryId?: number) => {
    setAuditLoading(true);
    setActiveTab('audit');
    setAuditEntryId(entryId || null);
    try {
      const params = new URLSearchParams();
      if (entryId) params.set('entry_id', String(entryId));
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized(json.message);
        return;
      }
      if (!json.success) {
        toast.error(json.message || 'Failed to load audit logs');
        setAuditLogs([]);
        return;
      }
      setAuditLogs(json.data || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Failed to load audit logs');
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleRestoreFromAudit = async (log: ManualEntryAuditRow) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry/audit-logs/${log.id}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.status === 401) {
        handleUnauthorized(json.message);
        return;
      }
      if (!json.success) {
        toast.error(json.message || 'Failed to restore entry');
        return;
      }
      toast.success('Manual entry restored');
      await Promise.all([loadManualEntries(), handleOpenAudit(auditEntryId || undefined)]);
      setRestoreCandidate(null);
      setActiveTab('entries');
    } catch (error) {
      console.error('Failed to restore manual entry:', error);
      toast.error('Failed to restore entry');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const run = async () => {
      try {
        const params = new URLSearchParams();
        params.set('date', tableDateFilter);
        if (tableWorkCentreFilter) params.set('work_centre_id', tableWorkCentreFilter);
        if (tableSearch.trim()) params.set('search', tableSearch.trim());
        params.set('page', '1');
        params.set('limit', 'all');
        params.set('sort_by', tableSortBy);
        params.set('sort_order', tableSortOrder);
        const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry?${params.toString()}`);
        const json = await res.json();
        if (res.status === 401) {
          handleUnauthorized(json.message);
          return;
        }
        if (!json.success) {
          toast.error(json.message || 'Failed to export manual entries');
          return;
        }

        const allRows: ManualEntryRow[] = Array.isArray(json.data) ? json.data : [];
        const rows = allRows.map((row) => ({
          Date: formatDisplayDate(row.prod_date),
          Line: row.work_centre_name || row.work_centre_id,
          Machine: `${row.machine_id}${row.machine_name ? ` - ${row.machine_name}` : ''}`,
          Employee: `${row.emp_id}${row.employee_name ? ` - ${row.employee_name}` : ''}`,
          Start: formatDisplayDateTime(row.start_time),
          End: formatDisplayDateTime(row.finish_time),
          Target: Number(row.target_mins || 0).toFixed(1),
          Output: Number(row.output_pairs || 0),
        }));
        const headers = ['Date', 'Line', 'Machine', 'Employee', 'Start', 'End', 'Target', 'Output'];
        const csvBody = [
          headers.join(','),
          ...rows.map((r) =>
            headers
              .map((h) => {
                const value = String((r as any)[h] ?? '');
                return `"${value.replace(/"/g, '""')}"`;
              })
              .join(',')
          ),
          `,,,,,,Filtered Total,${Number(json.meta?.total_output_pairs || 0)}`,
        ].join('\n');
        const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manual_entries_${tableDateFilter || 'all'}_to_${tableToDateFilter || tableDateFilter || 'all'}_filtered.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to export manual entries:', error);
        toast.error('Failed to export manual entries');
      }
    };
    run();
  };

  const handleExportAuditCsv = () => {
    const headers = ['Action', 'Entry ID', 'User', 'Role', 'Reason', 'Time', 'Before JSON', 'After JSON'];
    const csvBody = [
      headers.join(','),
      ...auditLogs.map((log) => {
        const row = [
          log.action,
          log.entry_id ?? '',
          log.actor_username || '',
          log.actor_role || '',
          log.reason || '',
          formatDisplayDateTime(log.created_at),
          JSON.stringify(parseAuditJson(log.before_data)),
          JSON.stringify(parseAuditJson(log.after_data)),
        ];
        return row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = auditEntryId ? `manual_entry_audit_${auditEntryId}.csv` : 'manual_entry_audit_logs.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSort = (field: string) => {
    if (tableSortBy === field) {
      setTableSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortBy(field);
      setTableSortOrder('desc');
    }
    setTablePage(1);
  };

  const sortLabel = (field: string, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="font-semibold hover:text-blue-700"
      title={`Sort by ${label}`}
    >
      {label}{tableSortBy === field ? (tableSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
    </button>
  );

  return (
    <div className="w-full px-2 sm:px-3 md:px-4">
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Edit Manual Entry' : 'Manual Production Entry'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Use this when supervisor/admin needs to enter a completed cycle manually.
                </p>
              </div>
              <button
                type="button"
                onClick={clearForm}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Line Name *</label>
              <select
                value={workCentreId}
                onChange={(e) => setWorkCentreId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5"
                required
                disabled={loading}
              >
                <option value="">Select line</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>{wc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Machine Name *</label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5"
                required
                disabled={loading || !workCentreId}
              >
                <option value="">Select machine</option>
                {filteredMachines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>
                    {m.machine_id} - {m.machine_name || m.name || 'Machine'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
              <select
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5"
                required
                disabled={loading || !workCentreId}
              >
                <option value="">Select employee</option>
                {filteredEmployees.map((emp) => (
                  <option key={emp.code} value={emp.code}>{emp.code} - {emp.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Time
                {loadingTargetMins ? <span className="ml-2 text-xs text-gray-500">(loading...)</span> : null}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={targetMins}
                onChange={(e) => setTargetMins(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input
                type="datetime-local"
                value={finishTime}
                onChange={(e) => setFinishTime(e.target.value)}
                className={`w-full border rounded-lg p-2.5 ${
                  finishTime && !timeIsValid ? 'border-red-400 focus:border-red-500' : 'border-gray-300'
                }`}
                required
                disabled={loading}
              />
              {finishTime && !timeIsValid ? (
                <p className="text-xs text-red-600 mt-1">End Time must be greater than Start Time.</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Pairs</label>
              <input
                type="number"
                min="0"
                value={outputPairs}
                onChange={(e) => setOutputPairs(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={stoppageReason}
                onChange={(e) => setStoppageReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5"
                placeholder="Manual note/reason"
                disabled={loading}
              />
            </div>

              <div className="md:col-span-2 flex gap-3 mt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-semibold"
                >
                  {loading ? 'Saving...' : editingId ? 'Update Manual Entry' : 'Save Manual Entry'}
                </button>
                <button
                  type="button"
                  onClick={clearForm}
                  disabled={loading}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {restoreCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900">Restore Manual Entry</h2>
            <p className="text-sm text-gray-600 mt-2">
              Restore deleted entry from audit log{' '}
              <span className="font-semibold">#{restoreCandidate.id}</span>?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This will recreate the deleted production row and recalculate summary totals.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreCandidate(null)}
                disabled={loading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRestoreFromAudit(restoreCandidate)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                {loading ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900">Delete Manual Entry</h2>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure you want to delete manual entry for{' '}
              <span className="font-semibold">
                {deleteCandidate.machine_id}
                {deleteCandidate.machine_name ? ` - ${deleteCandidate.machine_name}` : ''}
              </span>{' '}
              /{' '}
              <span className="font-semibold">
                {deleteCandidate.emp_id}
                {deleteCandidate.employee_name ? ` - ${deleteCandidate.employee_name}` : ''}
              </span>
              ?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This action updates summary totals and cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={loading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteCandidate)}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-3 sm:p-4 md:p-6 mt-4">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setActiveTab('entries')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'entries' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Manual Entries
            </button>
            <button
              type="button"
              onClick={() => handleOpenAudit()}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeTab === 'audit' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}`}
            >
              Audit Logs
            </button>
          </div>

          {activeTab === 'entries' ? (
          <>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
            <h3 className="text-lg font-bold text-gray-900">Manual Entries</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full lg:w-auto">
              <label className="text-xs text-gray-600 flex flex-col items-start gap-1 min-w-0">
                <span className="leading-none text-[11px] font-medium tracking-wide uppercase text-gray-500">From</span>
                <input
                  type="date"
                  value={tableDateFilter}
                  onChange={(e) => {
                    setTableDateFilter(e.target.value);
                    setTablePage(1);
                  }}
                  className="h-9 w-full border border-gray-300 rounded-lg px-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  title="From date"
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col items-start gap-1 min-w-0">
                <span className="leading-none text-[11px] font-medium tracking-wide uppercase text-gray-500">To</span>
                <input
                  type="date"
                  value={tableToDateFilter}
                  onChange={(e) => {
                    setTableToDateFilter(e.target.value);
                    setTablePage(1);
                  }}
                  className="h-9 w-full border border-gray-300 rounded-lg px-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  title="To date"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9 gap-2">
            <select
              value={tableWorkCentreFilter}
              onChange={(e) => {
                setTableWorkCentreFilter(e.target.value);
                setTablePage(1);
              }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm w-full col-span-2 sm:col-span-1"
              title="Filter by line"
            >
              <option value="">All lines</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>{wc.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-semibold w-full"
            >
              Add New Entry
            </button>
            <button
              type="button"
              onClick={loadManualEntries}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-semibold w-full"
              disabled={loadingEntries}
            >
              {loadingEntries ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-semibold w-full"
              disabled={manualEntries.length === 0}
            >
              Export CSV
            </button>
            <div className="relative col-span-2 sm:col-span-2 md:col-span-2 xl:col-span-3 min-w-0">
              <input
                type="text"
                value={tableSearchInput}
                onChange={(e) => {
                  setTableSearchInput(e.target.value);
                }}
                className="border border-gray-300 rounded-lg px-2 py-2 pr-7 text-sm w-full"
                placeholder="Search machine/employee/line"
                title="Search by machine, employee or line"
              />
              {tableSearchInput.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setTableSearchInput('');
                    setTableSearch('');
                    setTablePage(1);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 px-1"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setTableDateFilter(getNowLocalDateTime().split('T')[0]);
                setTableToDateFilter(getNowLocalDateTime().split('T')[0]);
                setTableWorkCentreFilter('');
                setTableSearch('');
                setTableSearchInput('');
                setTableSortBy('created_at');
                setTableSortOrder('desc');
                setTablePage(1);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-semibold w-full"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => {
                const payload = {
                  tableDateFilter,
                  tableToDateFilter,
                  tableWorkCentreFilter,
                  tableSearchInput,
                  tableLimit,
                  tableSortBy,
                  tableSortOrder,
                };
                localStorage.setItem(FILTER_PRESET_KEY, JSON.stringify(payload));
                toast.success('Filter preset saved');
              }}
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap w-full"
            >
              Save Filters
            </button>
          </div>
          </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Manual Entry Audit Logs</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {auditEntryId ? `Showing history for entry #${auditEntryId}` : 'Showing latest manual entry audit history'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAudit(auditEntryId || undefined)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAuditCsv}
                    className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    disabled={auditLogs.length === 0}
                  >
                    Export Audit CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRawAuditJson((prev) => !prev)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    {showRawAuditJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
                  </button>
                </div>
              </div>
              {auditLoading ? (
                <p className="text-sm text-gray-500">Loading audit logs...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No audit logs found.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        <div className="col-span-2 md:col-span-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getAuditActionBadgeClass(log.action)}`}>
                            {log.action}
                          </span>
                        </div>
                        <div><strong>Entry:</strong> {log.entry_id ?? '-'}</div>
                        <div><strong>User:</strong> {log.actor_username || '-'}</div>
                        <div><strong>Role:</strong> {log.actor_role || '-'}</div>
                        <div><strong>Time:</strong> {formatDisplayDateTime(log.created_at)} IST</div>
                      </div>
                      {log.action === 'DELETE' ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setRestoreCandidate(log)}
                            disabled={loading}
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded text-xs font-semibold disabled:opacity-50"
                          >
                            Restore Entry
                          </button>
                        </div>
                      ) : null}
                      {log.reason ? <p className="text-sm mt-1"><strong>Reason:</strong> {log.reason}</p> : null}
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-xs border border-gray-200 rounded">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-2 py-1 border-b">Field</th>
                              <th className="text-left px-2 py-1 border-b">Before</th>
                              <th className="text-left px-2 py-1 border-b">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {toAuditChanges(log).map((row) => (
                              <tr key={`${log.id}-${row.key}`} className="border-b">
                                <td className="px-2 py-1 font-medium text-gray-700">{row.label}</td>
                                <td className="px-2 py-1 text-gray-600">{row.beforeValue}</td>
                                <td className="px-2 py-1 text-gray-900">{row.afterValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {showRawAuditJson ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-xs">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold text-gray-700">Before (Raw)</p>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(JSON.stringify(parseAuditJson(log.before_data), null, 2), 'Before JSON copied')}
                                className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                              >
                                Copy JSON
                              </button>
                            </div>
                            <pre className="bg-gray-100 rounded p-2 overflow-auto max-h-40 font-mono text-[11px] leading-4">{JSON.stringify(parseAuditJson(log.before_data), null, 2)}</pre>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold text-gray-700">After (Raw)</p>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(JSON.stringify(parseAuditJson(log.after_data), null, 2), 'After JSON copied')}
                                className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                              >
                                Copy JSON
                              </button>
                            </div>
                            <pre className="bg-gray-100 rounded p-2 overflow-auto max-h-40 font-mono text-[11px] leading-4">{JSON.stringify(parseAuditJson(log.after_data), null, 2)}</pre>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'entries' ? (
        <>
        <div className="overflow-x-auto -mx-1 sm:-mx-2 md:mx-0">
          <table className="min-w-[900px] w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">{sortLabel('created_at', 'Date')}</th>
                <th className="text-left p-2 border-b">Line</th>
                <th className="text-left p-2 border-b">{sortLabel('machine_id', 'Machine')}</th>
                <th className="text-left p-2 border-b">Employee</th>
                <th className="text-left p-2 border-b">{sortLabel('start_time', 'Start')}</th>
                <th className="text-left p-2 border-b">{sortLabel('finish_time', 'End')}</th>
                <th className="text-left p-2 border-b">{sortLabel('target_mins', 'Target')}</th>
                <th className="text-left p-2 border-b">{sortLabel('output_pairs', 'Output')}</th>
                <th className="text-left p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {manualEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-3 text-center text-gray-500">
                    {tableSearch.trim() || tableWorkCentreFilter || tableDateFilter
                      ? 'No manual entries found for selected filters.'
                      : 'No manual entries found.'}
                  </td>
                </tr>
              ) : (
                manualEntries.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="p-2">{formatDisplayDate(row.prod_date)}</td>
                    <td className="p-2">{row.work_centre_name || row.work_centre_id}</td>
                    <td className="p-2">{row.machine_id}{row.machine_name ? ` - ${row.machine_name}` : ''}</td>
                    <td className="p-2">{row.emp_id}{row.employee_name ? ` - ${row.employee_name}` : ''}</td>
                    <td className="p-2">{formatDisplayDateTime(row.start_time)}</td>
                    <td className="p-2">{formatDisplayDateTime(row.finish_time)}</td>
                    <td className="p-2">{Number(row.target_mins || 0).toFixed(1)}</td>
                    <td className="p-2">{Number(row.output_pairs || 0)}</td>
                    <td className="p-2">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          className="px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAudit(row.id)}
                          className="px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                        >
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(row)}
                          className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {manualEntries.length > 0 ? (
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-2 border-t" colSpan={7}>Page Total (manual outputs)</td>
                  <td className="p-2 border-t">{totalManualOutput}</td>
                  <td className="p-2 border-t"></td>
                </tr>
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-2 border-t" colSpan={7}>Filtered Total (all pages)</td>
                  <td className="p-2 border-t">{tableFilteredOutputTotal}</td>
                  <td className="p-2 border-t"></td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-3 text-sm text-gray-600">
          <div className="text-xs sm:text-sm">
            Showing page {tablePage} of {tableTotalPages} ({manualEntries.length} rows on this page, {tableTotal} total)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tableLimit}
              onChange={(e) => {
                setTableLimit(e.target.value);
                setTablePage(1);
              }}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              title="Rows per page"
            >
              <option value="5">5 / page</option>
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="30">30 / page</option>
              <option value="all">All</option>
            </select>
            <button
              type="button"
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tableLimit === 'all' || tablePage <= 1 || loadingEntries}
              className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 text-xs sm:text-sm"
            >
              Previous
            </button>
            <span className="min-w-[70px] sm:min-w-[90px] text-center text-xs sm:text-sm">Page {tablePage}</span>
            <input
              type="number"
              min={1}
              max={tableTotalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const next = Math.max(1, Math.min(tableTotalPages, parseInt(pageInput, 10) || tablePage));
                setTablePage(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const next = Math.max(1, Math.min(tableTotalPages, parseInt(pageInput, 10) || tablePage));
                  setTablePage(next);
                }
              }}
              disabled={tableLimit === 'all' || loadingEntries}
              className="w-14 sm:w-16 px-2 py-1.5 rounded border border-gray-300 text-center disabled:opacity-50 text-xs sm:text-sm"
              title="Go to page"
            />
            <button
              type="button"
              onClick={() => setTablePage((p) => Math.min(tableTotalPages, p + 1))}
              disabled={tableLimit === 'all' || tablePage >= tableTotalPages || loadingEntries}
              className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 text-xs sm:text-sm"
            >
              Next
            </button>
          </div>
        </div>
        </>
        ) : null}
      </div>
    </div>
  );
};

