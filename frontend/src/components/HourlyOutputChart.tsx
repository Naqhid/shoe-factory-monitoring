import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { API_BASE_URL, apiFetch } from '../services/api';

interface HourlyData { hour: string; production: number; }
interface HourlyOutputData { hourlyData: HourlyData[]; average: number; target: number; }
interface MachineHourlyData {
  machine_id: string; machine_name: string;
  hourlyData: HourlyData[]; average: number; total: number;
}

interface Props {
  workCentreId: number;
  workCentreName?: string;
  showProgress?: boolean;
  progress?: number;
  date?: string;
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

export const HourlyOutputChart: React.FC<Props> = ({
  workCentreId, workCentreName, showProgress = false, progress = 0, date
}) => {
  const [viewMode, setViewMode] = useState<'line' | 'machine'>('line');
  const [lineData, setLineData] = useState<HourlyOutputData | null>(null);
  const [machineData, setMachineData] = useState<MachineHourlyData[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const dateParam = date || new Date().toISOString().split('T')[0];

  const fetchLineData = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/hourly-output/${workCentreId}?date=${dateParam}`);
      const result = await res.json();
      if (result.success) setLineData(result.data);
    } catch (e) { console.error(e); }
  };

  const fetchMachineData = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/hourly-output/${workCentreId}/machines?date=${dateParam}`);
      const result = await res.json();
      if (result.success) {
        setMachineData(result.data);
        if (result.data.length > 0 && selectedMachine === 'all') {
          // keep 'all' as default
        }
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLineData(), fetchMachineData()]).finally(() => setLoading(false));
    const interval = setInterval(() => { fetchLineData(); fetchMachineData(); }, 60000);
    return () => clearInterval(interval);
  }, [workCentreId, date]);

  const CustomTick = ({ x, y, payload }: any) => {
    const text = payload.value;
    if (text?.includes(' - ')) {
      const [t, n] = text.split(' - ');
      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={16} textAnchor="end" fontSize={13} fontWeight={600} transform="rotate(-45)">
            <tspan fill="#3b82f6">{t}</tspan>
            <tspan fill="#dc2626"> - {n}</tspan>
          </text>
        </g>
      );
    }
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" fill="#3b82f6" fontSize={13} fontWeight={600} transform="rotate(-45)">{text}</text>
      </g>
    );
  };

  // Build combined chart data for machine view (all machines on one chart)
  const buildCombinedData = () => {
    const hourSet = new Set<string>();
    machineData.forEach(m => m.hourlyData.forEach(h => hourSet.add(h.hour)));
    const hours = Array.from(hourSet).sort();
    return hours.map(hour => {
      const row: any = { hour };
      machineData.forEach(m => {
        const found = m.hourlyData.find(h => h.hour === hour);
        row[m.machine_id] = found?.production || 0;
      });
      return row;
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-gray-600">Loading...</span>
      </div>
    );
  }

  // --- Determine what to render ---
  const activeMachine = viewMode === 'machine' && selectedMachine !== 'all'
    ? machineData.find(m => m.machine_id === selectedMachine)
    : null;

  const chartDataLine = lineData?.hourlyData || [];
  const chartDataMachineAll = buildCombinedData();
  const chartDataMachineSingle = activeMachine?.hourlyData || [];

  const noData = viewMode === 'line'
    ? chartDataLine.length === 0
    : selectedMachine === 'all' ? chartDataMachineAll.length === 0 : chartDataMachineSingle.length === 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {showProgress && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-blue-600">
          {workCentreName ? `${workCentreName} - Hourly Output` : 'Hourly Output'}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View mode dropdown */}
          <select
            value={viewMode}
            onChange={e => { setViewMode(e.target.value as 'line' | 'machine'); setSelectedMachine('all'); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
          >
            <option value="line">Line Hourly Output</option>
            <option value="machine">Machine Hourly Output</option>
          </select>

          {/* Machine selector (only in machine mode) */}
          {viewMode === 'machine' && (
            <select
              value={selectedMachine}
              onChange={e => setSelectedMachine(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Machines</option>
              {machineData.map(m => (
                <option key={m.machine_id} value={m.machine_id}>
                  {m.machine_id} - {m.machine_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {noData ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-lg">No data available</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            {viewMode === 'line' ? (
              <LineChart data={chartDataLine} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="hour" tick={<CustomTick />} stroke="#3b82f6" height={80} interval={0} />
                <YAxis tick={{ fontSize: 13, fontWeight: 600, fill: '#22c55e' }} stroke="#22c55e"
                  label={{ value: 'Pairs', angle: -90, position: 'insideLeft', style: { fontSize: 15, fontWeight: 600, fill: '#22c55e' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '16px', fontWeight: 600 }} iconSize={18} />
                {lineData?.target ? <ReferenceLine y={lineData.target} stroke="#f97316" strokeWidth={3}
                  label={{ value: `Target: ${lineData.target}`, position: 'right', fill: '#f97316', fontSize: 14, fontWeight: 600 }} /> : null}
                {lineData?.average ? <ReferenceLine y={lineData.average} stroke="#22c55e" strokeWidth={3} strokeDasharray="5 5"
                  label={{ value: `Avg: ${lineData.average}`, position: 'right', fill: '#22c55e', fontSize: 14, fontWeight: 600 }} /> : null}
                <Line type="monotone" dataKey="production" stroke="#3b82f6" strokeWidth={4}
                  dot={{ fill: '#3b82f6', r: 6 }} activeDot={{ r: 8 }} name="Hourly Production" />
              </LineChart>
            ) : selectedMachine === 'all' ? (
              <LineChart data={chartDataMachineAll} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="hour" tick={<CustomTick />} stroke="#3b82f6" height={80} interval={0} />
                <YAxis tick={{ fontSize: 13, fontWeight: 600, fill: '#22c55e' }} stroke="#22c55e"
                  label={{ value: 'Pairs', angle: -90, position: 'insideLeft', style: { fontSize: 15, fontWeight: 600, fill: '#22c55e' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '14px', fontWeight: 600 }} iconSize={16} />
                {machineData.map((m, i) => (
                  <Line key={m.machine_id} type="monotone" dataKey={m.machine_id}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={3}
                    dot={{ fill: COLORS[i % COLORS.length], r: 5 }} activeDot={{ r: 7 }}
                    name={`${m.machine_id} - ${m.machine_name}`} />
                ))}
              </LineChart>
            ) : (
              <LineChart data={chartDataMachineSingle} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="hour" tick={<CustomTick />} stroke="#3b82f6" height={80} interval={0} />
                <YAxis tick={{ fontSize: 13, fontWeight: 600, fill: '#22c55e' }} stroke="#22c55e"
                  label={{ value: 'Pairs', angle: -90, position: 'insideLeft', style: { fontSize: 15, fontWeight: 600, fill: '#22c55e' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '16px', fontWeight: 600 }} iconSize={18} />
                {activeMachine?.average ? <ReferenceLine y={activeMachine.average} stroke="#22c55e" strokeWidth={3} strokeDasharray="5 5"
                  label={{ value: `Avg: ${activeMachine.average}`, position: 'right', fill: '#22c55e', fontSize: 14, fontWeight: 600 }} /> : null}
                <Line type="monotone" dataKey="production" stroke="#3b82f6" strokeWidth={4}
                  dot={{ fill: '#3b82f6', r: 6 }} activeDot={{ r: 8 }} name={`${activeMachine?.machine_name} Output`} />
              </LineChart>
            )}
          </ResponsiveContainer>

          {/* Summary cards */}
          {viewMode === 'line' && lineData && (
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Current Hour</p>
                <p className="text-3xl font-bold text-blue-600">{lineData.hourlyData[lineData.hourlyData.length - 1]?.production || 0}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Target/hr</p>
                <p className="text-3xl font-bold text-orange-600">{lineData.target}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Average</p>
                <p className="text-3xl font-bold text-green-600">{lineData.average}</p>
              </div>
            </div>
          )}

          {viewMode === 'machine' && selectedMachine !== 'all' && activeMachine && (
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Current Hour</p>
                <p className="text-3xl font-bold text-blue-600">{activeMachine.hourlyData[activeMachine.hourlyData.length - 1]?.production || 0}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Today</p>
                <p className="text-3xl font-bold text-purple-600">{activeMachine.total}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Average</p>
                <p className="text-3xl font-bold text-green-600">{activeMachine.average}</p>
              </div>
            </div>
          )}

          {viewMode === 'machine' && selectedMachine === 'all' && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {machineData.map((m, i) => (
                <div key={m.machine_id} className="p-3 rounded-lg border text-center cursor-pointer hover:shadow-md transition-shadow"
                  style={{ borderColor: COLORS[i % COLORS.length] }}
                  onClick={() => setSelectedMachine(m.machine_id)}>
                  <p className="text-xs font-semibold text-gray-500">{m.machine_id} - {m.machine_name}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COLORS[i % COLORS.length] }}>{m.total}</p>
                  <p className="text-xs text-gray-400">pairs today</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
