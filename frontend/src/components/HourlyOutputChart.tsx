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
  /** Line detail / narrow embed: tighter axis, readable on phones. */
  embedded?: boolean;
  /** Parent-supplied line hourly payload (e.g. tracker line-detail bundle). */
  externalLineData?: HourlyOutputData | null;
  /** Parent-supplied per-machine hourly payload. */
  externalMachineData?: MachineHourlyData[];
  /** Skip self-fetch when parent refreshes hourly data on another poll. */
  skipFetch?: boolean;
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
const FLAT_COLOR = '#3b82f6';
const RISE_COLOR = '#16a34a';
const DROP_COLOR = '#dc2626';

type HourlyChartRow = HourlyData & {
  isDrop: boolean;
  isRise: boolean;
};

const enrichHourlyWithDrops = (data: HourlyData[]): HourlyChartRow[] =>
  data.map((d, i) => {
    const prev = i > 0 ? Number(data[i - 1].production) : null;
    const curr = Number(d.production);
    return {
      ...d,
      isDrop: prev != null && curr < prev,
      isRise: prev != null && curr > prev,
    };
  });

const segmentColorForPoint = (payload: { isDrop?: boolean; isRise?: boolean } | undefined) => {
  if (payload?.isDrop) return DROP_COLOR;
  if (payload?.isRise) return RISE_COLOR;
  return FLAT_COLOR;
};

const segmentColorBetween = (prevVal: number, currVal: number) => {
  if (currVal < prevVal) return DROP_COLOR;
  if (currVal > prevVal) return RISE_COLOR;
  return FLAT_COLOR;
};

type HourlySegmentLine = { dataKey: string; color: string };

/** One Recharts series per edge (only two non-null points) so segments never cross-connect. */
const buildHourlySegmentLines = (data: HourlyData[]): {
  rows: HourlyChartRow[];
  segments: HourlySegmentLine[];
} => {
  const rows = enrichHourlyWithDrops(data);
  const segments: HourlySegmentLine[] = [];

  for (let i = 1; i < rows.length; i++) {
    const key = `seg_${i}`;
    const prevVal = Number(rows[i - 1].production) || 0;
    const currVal = Number(rows[i].production) || 0;
    rows[i - 1] = { ...rows[i - 1], [key]: prevVal } as HourlyChartRow;
    rows[i] = { ...rows[i], [key]: currVal } as HourlyChartRow;
    segments.push({ dataKey: key, color: segmentColorBetween(prevVal, currVal) });
  }

  return { rows, segments };
};

export const HourlyOutputChart: React.FC<Props> = ({
  workCentreId,
  workCentreName,
  showProgress = false,
  progress = 0,
  date,
  fitContainer = false,
  hideTitle = false,
  embedded = false,
  externalLineData,
  externalMachineData,
  skipFetch = false,
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
    if (skipFetch) {
      if (externalLineData != null) setLineData(externalLineData);
      if (externalMachineData != null) setMachineData(externalMachineData);
      setLoading(externalLineData == null && (externalMachineData?.length ?? 0) === 0);
      return;
    }

    setLoading(true);
    Promise.all([fetchLineData(), fetchMachineData()]).finally(() => setLoading(false));
    const interval = setInterval(() => { fetchLineData(); fetchMachineData(); }, 60000);
    return () => clearInterval(interval);
  }, [workCentreId, date, skipFetch, externalLineData, externalMachineData]);

  useEffect(() => {
    const updateMobileState = () => setIsMobile(window.innerWidth < 640);
    updateMobileState();
    window.addEventListener('resize', updateMobileState);
    return () => window.removeEventListener('resize', updateMobileState);
  }, []);

  /** TV-friendly: pill badge above each point (high contrast, no hover). */
  const tvLabelFontSize = embedded && isMobile ? 11 : isMobile ? 13 : 20;
  const tvLabelPadX = embedded && isMobile ? 5 : isMobile ? 7 : 10;
  const tvLabelPadY = embedded && isMobile ? 3 : isMobile ? 4 : 5;

  const TvLineProductionLabel = (props: any) => {
    const { x, y, value, payload } = props;
    if (x == null || y == null || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const text = String(Math.round(n));
    const fs = tvLabelFontSize;
    const w = Math.max(28, text.length * fs * 0.62 + tvLabelPadX * 2);
    const h = fs + tvLabelPadY * 2;
    const accent = segmentColorForPoint(payload);
    const left = x - w / 2;
    const top = y - h - 10;
    return (
      <g transform={`translate(${left},${top})`}>
        <rect
          width={w}
          height={h}
          rx={8}
          fill="#ffffff"
          stroke={accent}
          strokeWidth={2.5}
          opacity={0.98}
        />
        <text
          x={w / 2}
          y={h / 2 + fs * 0.32}
          textAnchor="middle"
          fill={accent}
          fontSize={fs}
          fontWeight={800}
          style={{ paintOrder: 'stroke fill', stroke: '#ffffff', strokeWidth: 3 }}
        >
          {text}
        </text>
      </g>
    );
  };

  const TvLineDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const r = fitContainer ? 7 : 6;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={segmentColorForPoint(payload)}
        stroke="#ffffff"
        strokeWidth={2}
      />
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

  const embeddedMobile = embedded && isMobile;
  const embeddedDesktop = embedded && !isMobile;

  const CustomTick = ({ x, y, payload }: any) => {
    const text: string = payload.value || '';
    const short = shortenHourLabel(text);

    // Line detail / phone: angled short labels so hours do not overlap
    if (embeddedMobile) {
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={10}
            textAnchor="end"
            fill="#475569"
            fontSize={10}
            fontWeight={600}
            transform="rotate(-50)"
          >
            {short}
          </text>
        </g>
      );
    }

    if (embeddedDesktop) {
      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={18} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600}>
            {short}
          </text>
        </g>
      );
    }

    // TV fitContainer: large horizontal labels
    if (fitContainer) {
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={24}
            textAnchor="middle"
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
    // Sort hours chronologically by extracting the starting hour number from labels like "2-3", "10-11", etc.
    const hours = Array.from(hourSet).sort((a, b) => {
      const getStartHour = (label: string) => {
        const match = label.match(/^(\d{1,2})/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return getStartHour(a) - getStartHour(b);
    });
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

  const { rows: chartDataLine, segments: lineSegments } = buildHourlySegmentLines(
    lineData?.hourlyData || []
  );
  const chartDataMachineAll = buildCombinedData();
  const { rows: chartDataMachineSingle, segments: machineSegments } = buildHourlySegmentLines(
    activeMachine?.hourlyData || []
  );

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

  /** Y scale must include target/avg lines when axis is hidden on TV */
  const computeYDomain = (
    rows: { production?: number }[],
    target?: number,
    average?: number
  ): [number, number] => {
    const maxProd = rows.reduce((m, d) => Math.max(m, Number(d.production) || 0), 0);
    const top = Math.max(maxProd, Number(target) || 0, Number(average) || 0, 1);
    return [0, Math.ceil(top * 1.15)];
  };

  const lineYDomain =
    fitContainer && !embedded
      ? computeYDomain(chartDataLine, 0, 0)
      : computeYDomain(chartDataLine, lineData?.target, lineData?.average);
  const tvFewPoints = fitContainer && !embedded && chartDataLine.length > 0 && chartDataLine.length <= 6;

  const chartMargin = embedded
    ? embeddedMobile
      ? { top: 36, right: 12, left: 8, bottom: 56 }
      : { top: 40, right: 20, left: 12, bottom: 40 }
    : fitContainer
      ? { top: 48, right: 32, left: 16, bottom: 32 }
      : { top: 42, right: 20, left: 20, bottom: 64 };

  const xAxisHeight = embedded
    ? embeddedMobile
      ? 72
      : 48
    : fitContainer
      ? 56
      : isMobile
        ? 60
        : 80;

  const xAxisInterval =
    embedded && isMobile
      ? chartDataLine.length > 6
        ? Math.max(0, Math.floor(chartDataLine.length / 5) - 1)
        : 0
      : isMobile && !fitContainer
        ? 'preserveStartEnd'
        : 0;

  const xAxisMinTickGap = embedded && isMobile ? 36 : embedded ? 20 : undefined;
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
  /** TV: hide Y-axis ticks — values on point labels; domain still shows target/avg lines */
  const yAxisProps =
    fitContainer && !embedded
      ? { hide: true, width: 0, domain: lineYDomain }
      : embedded && isMobile
        ? { hide: true, width: 0, domain: lineYDomain }
        : {
            tick: { ...yAxisTickStyle, fontSize: embedded ? 11 : yAxisTickStyle.fontSize },
            stroke: '#22c55e',
            width: embedded ? 40 : yAxisWidth,
            tickMargin: 6,
            label: embedded
              ? undefined
              : { value: 'Pairs', angle: -90, position: 'insideLeft' as const, style: yAxisLabelStyle },
          };

  const tvXAxisProps =
    fitContainer && !embedded
      ? { scale: 'point' as const, padding: { left: 56, right: 56 } }
      : embedded
        ? { scale: 'point' as const, padding: { left: 12, right: 12 } }
        : {};

  const lineStrokeWidth = fitContainer ? 5 : 4;

  const lineChartLegendPayload = [
    { value: 'Increase from previous hour', type: 'line' as const, color: RISE_COLOR },
    { value: 'Same as previous hour', type: 'line' as const, color: FLAT_COLOR },
    { value: 'Drop from previous hour', type: 'line' as const, color: DROP_COLOR },
    ...(lineData?.target
      ? [{ value: `Target: ${lineData.target}`, type: 'line' as const, color: '#f97316' }]
      : []),
    ...(lineData?.average
      ? [{ value: `Avg: ${lineData.average}`, type: 'line' as const, color: '#22c55e' }]
      : []),
  ];

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
      className={`bg-white rounded-lg motion-safe:animate-tv-section-in motion-safe:[animation-delay:40ms] max-sm:motion-safe:animate-none motion-reduce:animate-none ${
        embedded
          ? 'h-full min-h-0 flex flex-col overflow-hidden p-0 shadow-none'
          : fitContainer
            ? 'shadow-lg h-full min-h-0 flex flex-col overflow-hidden p-3 sm:p-4'
            : 'shadow-lg p-6 2xl:rounded-3xl 2xl:shadow-2xl 2xl:p-8'
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
        {!(fitContainer && hideTitle) && !embedded && (
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
        )}
      </div>

      {noData ? (
        <div className={`flex items-center justify-center text-gray-400 ${fitContainer ? 'flex-1 min-h-0 text-sm' : 'h-64 text-lg'}`}>No data available</div>
      ) : (
        <>
          <div
            className={
              embedded || fitContainer
                ? `flex-1 min-h-0 w-full flex items-center justify-center ${tvFewPoints && !embedded ? 'px-4' : ''}`
                : isMobile
                  ? 'h-[280px]'
                  : 'h-[400px] min-h-[300px] 2xl:h-[min(44vh,520px)] 2xl:min-h-[440px]'
            }
          >
          <div className={tvFewPoints ? 'w-full h-full max-w-4xl mx-auto' : 'w-full h-full'}>
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'line' ? (
              <LineChart data={chartDataLine} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="hour"
                  tick={<CustomTick />}
                  stroke="#3b82f6"
                  height={xAxisHeight}
                  interval={xAxisInterval}
                  minTickGap={xAxisMinTickGap}
                  {...tvXAxisProps}
                />
                <YAxis {...yAxisProps} />
                <Tooltip />
                {!fitContainer && !embedded && (
                  <Legend
                    payload={lineChartLegendPayload}
                    wrapperStyle={{ fontSize: '14px', fontWeight: 700, paddingTop: 4 }}
                    iconSize={18}
                  />
                )}
                {!fitContainer && lineData?.target ? (
                  <ReferenceLine y={lineData.target} stroke="#f97316" strokeWidth={3} strokeDasharray="8 6" />
                ) : null}
                {!fitContainer && lineData?.average ? (
                  <ReferenceLine y={lineData.average} stroke="#22c55e" strokeWidth={3} strokeDasharray="8 6" />
                ) : null}
                {lineSegments.map((seg) => (
                  <Line
                    key={seg.dataKey}
                    type="monotone"
                    dataKey={seg.dataKey}
                    stroke={seg.color}
                    strokeWidth={lineStrokeWidth}
                    connectNulls={false}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="production"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={<TvLineDot />}
                  activeDot={false}
                  isAnimationActive={false}
                >
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
                  interval={xAxisInterval}
                  minTickGap={xAxisMinTickGap}
                  {...tvXAxisProps}
                />
                <YAxis
                  {...yAxisProps}
                  domain={fitContainer && !embedded ? computeYDomain(chartDataMachineAll, 0, 0) : undefined}
                />
                <Tooltip />
                {!fitContainer && !embedded && (
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
                  interval={xAxisInterval}
                  minTickGap={xAxisMinTickGap}
                  {...tvXAxisProps}
                />
                <YAxis
                  {...yAxisProps}
                  domain={
                    fitContainer && !embedded
                      ? computeYDomain(chartDataMachineSingle, 0, activeMachine?.average)
                      : undefined
                  }
                />
                <Tooltip />
                {!fitContainer && !embedded && (
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
                {!fitContainer && activeMachine?.average ? (
                  <ReferenceLine y={activeMachine.average} stroke="#22c55e" strokeWidth={3} strokeDasharray="8 6" />
                ) : null}
                {machineSegments.map((seg) => (
                  <Line
                    key={seg.dataKey}
                    type="monotone"
                    dataKey={seg.dataKey}
                    stroke={seg.color}
                    strokeWidth={lineStrokeWidth}
                    connectNulls={false}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="production"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={<TvLineDot />}
                  activeDot={false}
                  isAnimationActive={false}
                >
                  <LabelList dataKey="production" content={TvLineProductionLabel} />
                </Line>
              </LineChart>
            )}
          </ResponsiveContainer>
          </div>
          </div>

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
