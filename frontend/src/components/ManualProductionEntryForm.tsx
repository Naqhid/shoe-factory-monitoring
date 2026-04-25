import React from 'react';
import toast from 'react-hot-toast';
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

const getNowLocalDateTime = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export const ManualProductionEntryForm: React.FC = () => {
  const [workCentres, setWorkCentres] = React.useState<WorkCentre[]>([]);
  const [machines, setMachines] = React.useState<MachineCentre[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(false);

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
      } catch (error) {
        console.error('Failed to load masters for manual entry:', error);
        toast.error('Failed to load master data');
      }
    };
    loadMasters();
  }, []);

  const filteredMachines = React.useMemo(() => {
    if (!workCentreId) return machines;
    return machines.filter((m) => String(m.work_centre_id) === String(workCentreId));
  }, [machines, workCentreId]);

  const filteredEmployees = React.useMemo(() => {
    if (!workCentreId) return employees;
    return employees.filter((e) => String(e.work_centre_id) === String(workCentreId));
  }, [employees, workCentreId]);

  const clearForm = () => {
    setMachineId('');
    setEmpId('');
    setStartTime(getNowLocalDateTime());
    setFinishTime(getNowLocalDateTime());
    setTargetMins('0');
    setOutputPairs('12');
    setStoppageReason('');
  };

  React.useEffect(() => {
    const loadTargetMins = async () => {
      if (!machineId || !empId) return;
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
        }
      } catch (error) {
        console.warn('Failed to auto-load target minutes for manual entry:', error);
      } finally {
        setLoadingTargetMins(false);
      }
    };
    loadTargetMins();
  }, [machineId, empId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCentreId || !machineId || !empId || !startTime || !finishTime) {
      toast.error('Please fill required fields');
      return;
    }

    const payload = {
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
      const res = await apiFetch(`${API_BASE_URL}/api/mobile-production/manual-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.message || 'Failed to save manual entry');
        return;
      }
      toast.success(`Saved. Total output today: ${result.data?.total_output_pairs ?? '-'}`);
      clearForm();
    } catch (error) {
      console.error('Manual entry save failed:', error);
      toast.error('Failed to save manual entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Manual Production Entry</h2>
        <p className="text-sm text-gray-500 mb-6">
          Use this when supervisor/admin needs to enter a completed cycle manually.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Line Name *</label>
            <select
              value={workCentreId}
              onChange={(e) => setWorkCentreId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5"
              required
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
            >
              <option value="">Select employee</option>
              {filteredEmployees.map((emp) => (
                <option key={emp.code} value={emp.code}>{emp.code} - {emp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Minutes
              {loadingTargetMins ? <span className="ml-2 text-xs text-gray-500">(loading...)</span> : null}
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={targetMins}
              onChange={(e) => setTargetMins(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5"
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
            <input
              type="datetime-local"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Output Pairs</label>
            <input
              type="number"
              min="0"
              value={outputPairs}
              onChange={(e) => setOutputPairs(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5"
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
            />
          </div>

          <div className="md:col-span-2 flex gap-3 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg font-semibold"
            >
              {loading ? 'Saving...' : 'Save Manual Entry'}
            </button>
            <button
              type="button"
              onClick={clearForm}
              disabled={loading}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-semibold"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

