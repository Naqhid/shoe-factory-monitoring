import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { API_BASE_URL, apiFetch } from '../services/api';

interface HourlyData { hour: string; production: number; }
interface HourlyOutputData {
  hourlyData: HourlyData[];
  average: number;
  /** Hourly pair pace (daily target ÷ shift hours) — chart reference line. */
  target: number;
  /** Full-day pair target from routing (preferred) or plan — use for summary Target / achievement. */
  dailyTarget?: number;
  shiftHours?: number;
}
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
  /** Fill parent height; compact header/chart for viewport-fit TV dashboard. */
  fitContainer?: boolean;
  /** Hide title (e.g. when carousel header shows it). */
  hideTitle?: boolean;
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

type ChartLegendItem = { label: string; color: string; dashed?: boolean };

const TvChartLegend: React.FC<{ items: ChartLegendItem[] }> = ({ items }) => (
  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-2 py-2 flex-shrink-0 border-t border-slate-100 bg-white">
    {items.map((item) => (
      <span
        key={item.label}
        className="inline-flex items-center gap-2 text-sm sm:text-[15px] font-bold text-slate-700 whitespace-nowrap"
      >
        <span
          className={`inline-block w-9 h-1 rounded-full ${item.dashed ? 'border-t-[3px] border-dashed bg-transparent' : ''}`}
          style={item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }}
        />
        {item.label}
      </span>
    ))}
  </div>
);

export const HourlyOutputChart: React.FC<Props> = ({
  workCentreId, workCentreName, showProgress = false, progress = 0, date, fitContainer = false, hideTitle = false
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'line' | 'machine'>('line');
  const [lineData, setLineData] = useState<HourlyOutputData | null>(null);
  const [machineData, setMachineData] = useState<MachineHourlyData[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    const updateMobileState = () => setIsMobile(window.innerWidth < 640);
    updateMobileState();
    window.addEventListener('resize', updateMobileState);
    return () => window.removeEventListener('resize', updateMobileState);
  }, []);

  /** TV-friendly: pill badge above each point (high contrast, no hover). */
  const tvLabelFontSize = isMobile ? 13 : 20;
  const tvLabelPadX = isMobile ? 7 : 10;
  const tvLabelPadY = isMobile ? 4 : 5;

  const TvLineProductionLabel = (props: any) => {
    const { x, y, value } = props;
    if (x == null || y == null || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const text = String(Math.round(n));
    const fs = tvLabelFontSize;
    const w = Math.max(28, text.length * fs * 0.62 + tvLabelPadX * 2);
    const h = fs + tvLabelPadY * 2;
    const border = '#1d4ed8';
    const left = x - w / 2;
    const top = y - h - 10;
    return (
      <g transform={`translate(${left},${top})`}>
        <rect
          width={w}
          height={h}
          rx={8}
          fill="#ffffff"
          stroke={border}
          strokeWidth={2.5}
          opacity={0.98}
        />
        <text
          x={w / 2}
          y={h / 2 + fs * 0.32}
          textAnchor="middle"
          fill="#0f172a"
          fontSize={fs}
          fontWeight={800}
          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: 3 }}
        >
          {text}
        </text>
      </g>
    );
  };

  const createTvMachineProductionLabel = (accent: string) => (props: any) => {
    const { x, y, value } = props;
    if (x == null || y == null || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const text = String(Math.round(n));
    const fs = tvLabelFontSize - 1;
    const w = Math.max(26, text.length * fs * 0.62 + tvLabelPadX * 2);
    const h = fs + tvLabelPadY * 2;
    const left = x - w / 2;
    const top = y - h - 8;
    return (
      <g transform={`translate(${left},${top})`}>
        <rect width={w} height={h} rx={7} fill="#ffffff" stroke={accent} strokeWidth={2} opacity={0.95} />
        <text
          x={w / 2}
          y={h / 2 + fs * 0.32}
          textAnchor="middle"
          fill="#0f172a"
          fontSize={fs}
          fontWeight={800}
          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: 2.5 }}
        >
          {text}
        </text>
      </g>
    );
  };

  /** TV dashboard (fitContainer): large axis labels readable from ~3m on 70" displays */
  const tvAxisTickSize = fitContainer ? 22 : 13;
  const tvAxisTickWeight = fitContainer ? 800 : 600;

  const shortenHourLabel = (text: string) => {
    if (!text.includes(' - ')) {
      return text.replace(':00', '').replace(/\s*(AM|PM)/gi, '').trim();
    }
    const [from, to] = text.split(' - ');
    const hourNum = (part: string) => {
      const m = part.trim().match(/^(\d{1,2})/);
      return m ? m[1] : part.replace(/\s*(AM|PM)/gi, '').trim();
    };
    return `${hourNum(from)}-${hourNum(to)}`;
  };

  const CustomTick = ({ x, y, payload, index, visibleTicksCount }: any) => {
    const text: string = payload.value || '';
    // In fitContainer (TV) mode: show short label horizontally to avoid clipping
    if (fitContainer) {
      const short = shortenHourLabel(text);
      const tickCount = visibleTicksCount ?? 1;
      const isFirst = index === 0;
      const isLast = tickCount > 1 && index === tickCount - 1;
      const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={20}
            textAnchor={textAnchor}
            fill="#1e3a8a"
            fontSize={tvAxisTickSize}
            fontWeight={tvAxisTickWeight}
            style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: 4 }}
          >
            {short}
          </text>
        </g>
      );
    }
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
      <div className={`bg-white rounded-lg shadow-lg flex items-center justify-center ${fitContainer ? 'h-full min-h-0 p-3' : 'p-6 h-64'}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
          <span className="text-gray-600">Loading...</span>
        </div>
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

  const shiftHoursForTarget = lineData?.shiftHours ?? 8;
  const dailyTargetForSummary: number = !lineData
    ? 0
    : lineData.dailyTarget != null && lineData.dailyTarget > 0
      ? lineData.dailyTarget
      : lineData.target > 0
        ? lineData.target * shiftHoursForTarget
        : 0;
  const lineHourlyTotalOutput =
    lineData?.hourlyData.reduce((sum, h) => sum + h.production, 0) ?? 0;
  const lineAchievementPct =
    dailyTargetForSummary > 0
      ? Math.round((lineHourlyTotalOutput / dailyTargetForSummary) * 100)
      : 0;

  const chartMargin = fitContainer
    ? { top: 40, right: 20, left: 28, bottom: 52 }
    : { top: 42, right: 20, left: 20, bottom: 64 };

  const xAxisHeight = fitContainer ? 56 : (isMobile ? 60 : 80);
  const yAxisWidth = 56;
  const yAxisTickStyle = {
    fontSize: tvAxisTickSize,
    fontWeight: tvAxisTickWeight,
    fill: '#15803d',
  };
  const yAxisLabelStyle = {
    fontSize: 15,
    fontWeight: tvAxisTickWeight,
    fill: '#15803d',
    textAnchor: 'middle' as const,
  };
  /** TV: hide Y-axis ticks (12, 6, 28…) — values already on point labels; keep axis for scale only */
  const yAxisProps = fitContainer
    ? { hide: true, width: 0 }
    : {
        tick: yAxisTickStyle,
        stroke: '#22c55e',
        width: yAxisWidth,
        tickMargin: 8,
        label: { value: 'Pairs', angle: -90, position: 'insideLeft' as const, style: yAxisLabelStyle },
      };

  const lineChartLegendPayload = [
    { value: fitContainer ? 'Hourly Production (pairs)' : 'Hourly Production', type: 'line' as const, color: '#3b82f6' },
    ...(lineData?.target
      ? [{ value: `Target: ${lineData.target}`, type: 'line' as const, color: '#f97316' }]
      : []),
    ...(lineData?.average
      ? [{ value: `Avg: ${lineData.average}`, type: 'line' as const, color: '#22c55e' }]
      : []),
  ];

  const tvLegendItems: ChartLegendItem[] =
    viewMode === 'line' && lineData
      ? [
          { label: 'Hourly Production (pairs)', color: '#3b82f6' },
          ...(lineData.target ? [{ label: `Target: ${lineData.target}`, color: '#f97316', dashed: true }] : []),
          ...(lineData.average ? [{ label: `Avg: ${lineData.average}`, color: '#22c55e', dashed: true }] : []),
        ]
      : activeMachine
        ? [
            { label: `${activeMachine.machine_name} (pairs)`, color: '#3b82f6' },
            ...(activeMachine.average
              ? [{ label: `Avg: ${activeMachine.average}`, color: '#22c55e', dashed: true }]
              : []),
          ]
        : [];

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchLineData(), fetchMachineData()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-lg motion-safe:animate-tv-section-in motion-safe:[animation-delay:40ms] max-sm:motion-safe:animate-none motion-reduce:animate-none ${
        fitContainer
          ? 'h-full min-h-0 flex flex-col overflow-hidden p-3 sm:p-4'
          : 'p-6 2xl:rounded-3xl 2xl:shadow-2xl 2xl:p-8'
      }`}
    >
        {showProgress && (
        <div className={fitContainer ? 'mb-2 flex-shrink-0' : 'mb-4'}>
          <div className="w-full rounded-full h-2.5 bg-gray-200">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Header + controls */}
      <div className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 flex-shrink-0 ${fitContainer ? 'mb-2' : 'gap-3 mb-4 sm:mb-6'}`}>
        {!hideTitle && (
        <h2 className={`font-bold text-blue-600 truncate ${fitContainer ? 'text-sm sm:text-base' : 'text-lg sm:text-2xl 2xl:text-3xl'}`}>
          {workCentreName ? `${workCentreName} - Hourly Output` : 'Hourly Output'}
        </h2>
        )}
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto ${fitContainer ? 'sm:gap-1.5' : 'sm:gap-3'} ${hideTitle ? 'sm:ml-auto' : ''}`}>
          <select
            value={viewMode}
            onChange={e => { setViewMode(e.target.value as 'line' | 'machine'); setSelectedMachine('all'); }}
            className={`w-full sm:w-auto border border-gray-300 rounded-lg font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 ${fitContainer ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-xs sm:text-sm'}`}
          >
            <option value="line">Line Hourly Output</option>
            <option value="machine">Machine Hourly Output</option>
          </select>

          {viewMode === 'machine' && (
            <select
              value={selectedMachine}
              onChange={e => setSelectedMachine(e.target.value)}
              className={`w-full sm:w-auto border border-gray-300 rounded-lg font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 ${fitContainer ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-xs sm:text-sm'}`}
            >
              <option value="all">All Machines</option>
              {machineData.map(m => (
                <option key={m.machine_id} value={m.machine_id}>
                  {m.machine_id} - {m.machine_name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className={`w-full sm:w-auto rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed ${fitContainer ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-xs sm:text-sm'}`}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {noData ? (
        <div className={`flex items-center justify-center text-gray-400 ${fitContainer ? 'flex-1 min-h-0 text-sm' : 'h-64 text-lg'}`}>No data available</div>
      ) : (
        <>
          <div
            className={
              fitContainer
                ? 'flex-1 min-h-0 w-full'
                : isMobile
                  ? 'h-[280px]'
                  : 'h-[400px] min-h-[300px] 2xl:h-[min(44vh,520px)] 2xl:min-h-[440px]'
            }
          >
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'line' ? (
              <LineChart data={chartDataLine} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="hour"
                  tick={<CustomTick />}
                  stroke="#3b82f6"
                  height={xAxisHeight}
                  interval={isMobile && !fitContainer ? 'preserveStartEnd' : 0}
                  padding={fitContainer ? { left: 28, right: 20 } : undefined}
                />
                <YAxis {...yAxisProps} />
                <Tooltip />
                {!fitContainer && (
                  <Legend
                    payload={lineChartLegendPayload}
                    wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: 4 }}
                    iconSize={18}
                  />
                )}
                {lineData?.target ? (
                  <ReferenceLine y={lineData.target} stroke="#f97316" strokeWidth={3} ifOverflow="extendDomain" />
                ) : null}
                {lineData?.average ? (
                  <ReferenceLine y={lineData.average} stroke="#22c55e" strokeWidth={3} strokeDasharray="5 5" ifOverflow="extendDomain" />
                ) : null}
                <Line type="monotone" dataKey="production" stroke="#3b82f6" strokeWidth={4}
                  dot={{ fill: '#3b82f6', r: 6 }} activeDot={{ r: 8 }} name={fitContainer ? 'Hourly Production (pairs)' : 'Hourly Production'}
                  isAnimationActive={false}>
                  <LabelList dataKey="production" content={TvLineProductionLabel} />
                </Line>
              </LineChart>
            ) : selectedMachine === 'all' ? (
              <LineChart data={chartDataMachineAll} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="hour"
                  tick={<CustomTick />}
                  stroke="#3b82f6"
                  height={xAxisHeight}
                  interval={isMobile && !fitContainer ? 'preserveStartEnd' : 0}
                  padding={fitContainer ? { left: 28, right: 20 } : undefined}
                />
                <YAxis {...yAxisProps} />
                <Tooltip />
                {!fitContainer && (
                  <Legend wrapperStyle={{ fontSize: '14px', fontWeight: 700 }} iconSize={16} />
                )}
                {machineData.map((m, i) => (
                  <Line key={m.machine_id} type="monotone" dataKey={m.machine_id}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={3}
                    dot={{ fill: COLORS[i % COLORS.length], r: 5 }} activeDot={{ r: 7 }}
                    name={`${m.machine_id} - ${m.machine_name}`}
                    isAnimationActive={false}>
                    <LabelList dataKey={m.machine_id} content={createTvMachineProductionLabel(COLORS[i % COLORS.length])} />
                  </Line>
                ))}
              </LineChart>
            ) : (
              <LineChart data={chartDataMachineSingle} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="hour"
                  tick={<CustomTick />}
                  stroke="#3b82f6"
                  height={xAxisHeight}
                  interval={isMobile && !fitContainer ? 'preserveStartEnd' : 0}
                  padding={fitContainer ? { left: 28, right: 20 } : undefined}
                />
                <YAxis {...yAxisProps} />
                <Tooltip />
                {!fitContainer && (
                  <Legend
                    payload={[
                      { value: `${activeMachine?.machine_name ?? 'Machine'} Output`, type: 'line', color: '#3b82f6' },
                      ...(activeMachine?.average
                        ? [{ value: `Avg: ${activeMachine.average}`, type: 'line' as const, color: '#22c55e' }]
                        : []),
                    ]}
                    wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: 4 }}
                    iconSize={18}
                  />
                )}
                {activeMachine?.average ? (
                  <ReferenceLine y={activeMachine.average} stroke="#22c55e" strokeWidth={3} strokeDasharray="5 5" ifOverflow="extendDomain" />
                ) : null}
                <Line type="monotone" dataKey="production" stroke="#3b82f6" strokeWidth={4}
                  dot={{ fill: '#3b82f6', r: 6 }} activeDot={{ r: 8 }} name={`${activeMachine?.machine_name} Output`}
                  isAnimationActive={false}>
                  <LabelList dataKey="production" content={TvLineProductionLabel} />
                </Line>
              </LineChart>
            )}
          </ResponsiveContainer>
          </div>

          {fitContainer && !noData && tvLegendItems.length > 0 && (
            <TvChartLegend items={tvLegendItems} />
          )}

          {/* Summary cards */}
          {viewMode === 'line' && lineData && !fitContainer && (
            <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Target</p>
                <p className="text-3xl font-bold text-orange-600">{dailyTargetForSummary}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Output</p>
                <p className="text-3xl font-bold text-blue-600">{lineHourlyTotalOutput}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Achievement %</p>
                <p className="text-3xl font-bold text-green-600">
                  {lineAchievementPct}%
                </p>
              </div>
            </div>
          )}

          {viewMode === 'machine' && selectedMachine !== 'all' && activeMachine && !fitContainer && (
            <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
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

          {viewMode === 'machine' && selectedMachine === 'all' && !fitContainer && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {machineData.map((m, i) => (
                <div
                  key={m.machine_id}
                  className="p-3 rounded-lg border text-center cursor-pointer hover:shadow-md transition-shadow"
                  style={{ borderColor: COLORS[i % COLORS.length] }}
                  onClick={() => setSelectedMachine(m.machine_id)}
                >
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
