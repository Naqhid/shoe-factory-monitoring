import React from 'react';
import { Loader2, AlertCircle, Download, Search, BarChart2, Clock, Users, AlertTriangle, Cpu, UserCheck, TrendingUp, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';

type ReportType = 'hourly-production' | 'line-efficiency' | 'attendance' | 'rework-rejection' | 'machine-output' | 'employee-output' | 'employee-performance';

const REPORT_OPTIONS: { value: ReportType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'hourly-production',    label: 'Hourly Production',         icon: <Clock className="h-5 w-5" />,       color: 'blue' },
  { value: 'line-efficiency',      label: 'Line & Process Efficiency', icon: <BarChart2 className="h-5 w-5" />,   color: 'green' },
  { value: 'attendance',           label: 'Attendance',                icon: <Users className="h-5 w-5" />,       color: 'purple' },
  { value: 'rework-rejection',     label: 'Rework & Rejection',        icon: <AlertTriangle className="h-5 w-5" />, color: 'yellow' },
  { value: 'machine-output',       label: 'Machine-wise Output',       icon: <Cpu className="h-5 w-5" />,         color: 'indigo' },
  { value: 'employee-output',      label: 'Employee-wise Output',      icon: <UserCheck className="h-5 w-5" />,   color: 'teal' },
  { value: 'employee-performance', label: 'Employee Performance',      icon: <TrendingUp className="h-5 w-5" />,  color: 'rose' },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   activeBg: 'bg-blue-600',   activeText: 'text-white' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  activeBg: 'bg-green-600',  activeText: 'text-white' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', activeBg: 'bg-purple-600', activeText: 'text-white' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', activeBg: 'bg-yellow-500', activeText: 'text-white' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', activeBg: 'bg-indigo-600', activeText: 'text-white' },
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   border: 'border-teal-200',   activeBg: 'bg-teal-600',   activeText: 'text-white' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-600',   border: 'border-rose-200',   activeBg: 'bg-rose-600',   activeText: 'text-white' },
};

const fmtDate = (d: string) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmtTime = (d: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
const r = (val: any) => Math.round(val ?? 0);

const HEADER_MAP: Record<string, string> = {
  date: 'Date', line: 'Line', customer: 'Customer', article_no: 'Article No',
  color: 'Color', leather: 'Leather', group: 'Group', total_planned_qty: 'Total Planned',
  total_output: 'Total Output', avg_hourly_output: 'Avg Hourly Output',
  '9_10': '9-10', '10_11': '10-11', '11_12': '11-12', '12_1': '12-1',
  '2_3': '2-3', '3_4': '3-4', '4_5': '4-5', '5_6': '5-6',
  process: 'Process/Machine', output_percent: 'Output %',
  total_standard_mins_value: 'Std Mins', total_produced_mins_value: 'Actual Mins',
  targeted_output_smv: 'Target @ SMV', efficiency_percent: 'Efficiency %',
  emp_id: 'Emp ID', emp_name: 'Employee Name', emp_code: 'Emp Code', status: 'Status', login_time: 'Login Time',
  machine: 'Machine', output: 'Output', bins_completed: 'Bins', rework_qty: 'Rework',
  rejection_qty: 'Rejection', rework_percent: 'Rework %', rejection_percent: 'Rejection %',
  reason_category: 'Category', reason: 'Reason',
  machine_id: 'Machine ID', machine_name: 'Machine Name', target_mins: 'Target Mins',
  actual_mins: 'Actual Mins', idle_mins: 'Idle Mins', total_output_pairs: 'Output Pairs',
  target: 'Target', performance_grade: 'Grade',
};

export const Reports: React.FC = () => {
  const [fromDate, setFromDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = React.useState<ReportType>('hourly-production');
  const [workCentres, setWorkCentres] = React.useState<any[]>([]);
  const [selectedLine, setSelectedLine] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [data, setData] = React.useState<any[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch(`${API_BASE}/api/tv-dashboard/work-centres`)
      .then(r => r.json())
      .then(res => { if (res.success) setWorkCentres(res.data); })
      .catch(() => {});
  }, []);

  const fetchReport = async (overridePage?: number, overrideSearch?: string) => {
    if (!fromDate || !toDate) return;
    setIsLoading(true); setError(null);
    const currentPage = overridePage ?? page;
    const currentSearch = overrideSearch !== undefined ? overrideSearch : search;
    try {
      const params = new URLSearchParams({ fromDate, toDate, page: String(currentPage), limit: String(limit) });
      if (selectedLine) params.set('workCentreId', selectedLine);
      if (currentSearch.trim()) params.set('search', currentSearch.trim());
      const response = await apiFetch(`${API_BASE}/api/reports/${reportType}?${params}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setData(result.data);
      if (result.pagination) setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchReport(newPage, search);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    // pass newLimit directly since state update is async
    const params = new URLSearchParams({ fromDate, toDate, page: '1', limit: String(newLimit) });
    if (selectedLine) params.set('workCentreId', selectedLine);
    if (search.trim()) params.set('search', search.trim());
    setIsLoading(true); setError(null);
    apiFetch(`${API_BASE}/api/reports/${reportType}?${params}`)
      .then(r => r.json())
      .then(result => {
        if (!result.success) throw new Error(result.error);
        setData(result.data);
        if (result.pagination) setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setIsLoading(false));
  };

  const exportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.map(h => `"${HEADER_MAP[h] || h}"`).join(','),
      ...data.map(row => headers.map(h => {
        const v = row[h] === null || row[h] === undefined ? '' : String(row[h]);
        return `"${v.replace(/"/g, '""')}"`;
      }).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${reportType}_${fromDate}_${toDate}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const activeOption = REPORT_OPTIONS.find(o => o.value === reportType)!;
  const activeColor = COLOR_MAP[activeOption.color];

  const Th = ({ children }: { children: React.ReactNode }) => (
    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50 border-b border-gray-200">{children}</th>
  );
  const Td = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
    <td className={`px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap ${center ? 'text-center' : ''}`}>{children}</td>
  );

  const renderTable = () => {
    if (!data || data.length === 0) return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Search className="h-16 w-16 mb-4 text-gray-200" />
        <p className="text-lg font-medium text-gray-400">No data for selected filters</p>
        <p className="text-sm text-gray-300 mt-1">Try adjusting the date range or line filter</p>
      </div>
    );
    switch (reportType) {
      case 'hourly-production':    return renderHourly();
      case 'line-efficiency':      return renderLineEfficiency();
      case 'attendance':           return renderAttendance();
      case 'rework-rejection':     return renderRework();
      case 'machine-output':       return renderMachineOutput();
      case 'employee-output':      return renderEmployeeOutput();
      case 'employee-performance': return renderEmployeePerformance();
    }
  };

  const effBadge = (val: number) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${val >= 90 ? 'bg-green-100 text-green-700' : val >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
      {val}%
    </span>
  );

  const renderHourly = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.total_output), 0);
    const totalPlanned = data!.reduce((s, row) => s + r(row.total_planned_qty), 0);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Customer','Article No','Color','Leather','Group','Planned','Output','WIP','Avg/Hr','9-10','10-11','11-12','12-1','2-3','3-4','4-5','5-6'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => {
              const wip = r(row.total_planned_qty) - r(row.total_output);
              return (
                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                  <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                  <Td><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{row.line}</span></Td>
                  <Td>{row.customer}</Td><Td>{row.article_no}</Td><Td>{row.color}</Td><Td>{row.leather}</Td><Td>{row.group}</Td>
                  <Td center><span className="font-semibold text-gray-700">{r(row.total_planned_qty)}</span></Td>
                  <Td center><span className="font-bold text-green-600">{r(row.total_output)}</span></Td>
                  <Td center><span className={`font-semibold ${wip > 0 ? 'text-red-500' : 'text-gray-400'}`}>{wip}</span></Td>
                  <Td center>{r(row.avg_hourly_output)}</Td>
                  {['9_10','10_11','11_12','12_1','2_3','3_4','4_5','5_6'].map(k => (
                    <Td key={k} center><span className={row[k] > 0 ? 'text-gray-700' : 'text-gray-300'}>{ r(row[k]) || '—'}</span></Td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-blue-600 text-white">
              <td colSpan={7} className="px-3 py-2.5 text-sm font-bold">TOTAL — {data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalPlanned}</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput}</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalPlanned - totalOutput}</td>
              <td colSpan={9}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderLineEfficiency = () => {
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Machine','Customer','Article No','Color','Leather','Group','Planned','Output','Output %','Std Mins','Actual Mins','Target@SMV','Efficiency %'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-green-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-semibold">{row.line}</span></Td>
                <Td><span className="font-medium">{row.process}</span></Td>
                <Td>{row.customer}</Td><Td>{row.article_no}</Td><Td>{row.color}</Td><Td>{row.leather}</Td><Td>{row.group}</Td>
                <Td center>{r(row.total_planned_qty)}</Td>
                <Td center><span className="font-bold text-green-600">{r(row.total_output)}</span></Td>
                <Td center>{r(row.output_percent)}%</Td>
                <Td center>{r(row.total_standard_mins_value)}</Td>
                <Td center>{r(row.total_produced_mins_value)}</Td>
                <Td center>{r(row.targeted_output_smv)}</Td>
                <Td center>{effBadge(r(row.efficiency_percent))}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-600 text-white">
              <td colSpan={14} className="px-3 py-2.5 text-sm font-bold">AVG EFFICIENCY — {data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{avgEff}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderAttendance = () => {
    const present = data!.filter(row => row.status === 'Present').length;
    const absent = data!.filter(row => row.status === 'Absent').length;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Emp Code','Employee Name','Status','Login Time'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className={`hover:bg-purple-50/30 transition-colors ${row.status === 'Absent' ? 'bg-red-50/20' : ''}`}>
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-semibold">{row.line}</span></Td>
                <Td><span className="font-mono text-gray-600">{row.emp_code}</span></Td>
                <Td><span className="font-medium">{row.emp_name}</span></Td>
                <Td center>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Present' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {row.status}
                  </span>
                </Td>
                <Td center><span className="font-mono text-sm">{fmtTime(row.login_time)}</span></Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-purple-600 text-white">
              <td colSpan={4} className="px-3 py-2.5 text-sm font-bold">{data!.length} records</td>
              <td className="px-3 py-2.5 text-sm text-center font-bold">
                ✓ {present} Present &nbsp;|&nbsp; ✗ {absent} Absent
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderRework = () => {
    const totalRework = data!.reduce((s, row) => s + r(row.rework_qty), 0);
    const totalRejection = data!.reduce((s, row) => s + r(row.rejection_qty), 0);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Machine','Output','Bins','Rework','Rejection','Rework %','Rejection %','Category','Reason'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-yellow-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs font-semibold">{row.line}</span></Td>
                <Td>{row.machine}</Td>
                <Td center><span className="font-semibold">{r(row.output)}</span></Td>
                <Td center>{r(row.bins_completed)}</Td>
                <Td center><span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-bold">{r(row.rework_qty)}</span></Td>
                <Td center><span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-bold">{r(row.rejection_qty)}</span></Td>
                <Td center>{row.rework_percent ?? 0}%</Td>
                <Td center>{row.rejection_percent ?? 0}%</Td>
                <Td>{row.reason_category ? <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{row.reason_category}</span> : '—'}</Td>
                <Td>{row.reason || '—'}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-yellow-500 text-white">
              <td colSpan={5} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalRework} rework</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalRejection} rejection</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderMachineOutput = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.output), 0);
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Machine ID','Machine Name','Output','Target Mins','Actual Mins','Idle Mins','Efficiency %'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">{row.line}</span></Td>
                <Td center><span className="font-mono font-bold text-gray-600">{row.machine_id}</span></Td>
                <Td><span className="font-medium">{row.machine_name}</span></Td>
                <Td center><span className="font-bold text-green-600">{r(row.output)}</span></Td>
                <Td center>{r(row.target_mins)}</Td>
                <Td center>{r(row.actual_mins)}</Td>
                <Td center><span className={r(row.idle_mins) > 0 ? 'text-orange-500 font-semibold' : 'text-gray-400'}>{r(row.idle_mins)}</span></Td>
                <Td center>{effBadge(r(row.efficiency_percent))}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-600 text-white">
              <td colSpan={4} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput} total output</td>
              <td colSpan={3}></td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{avgEff}% avg eff.</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderEmployeeOutput = () => {
    const totalOutput = data!.reduce((s, row) => s + r(row.total_output), 0);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Emp Code','Employee Name','Machine ID','Machine Name','Total Output'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-teal-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-semibold">{row.line}</span></Td>
                <Td><span className="font-mono text-gray-600">{row.emp_code}</span></Td>
                <Td><span className="font-medium">{row.emp_name}</span></Td>
                <Td center><span className="font-mono font-bold text-gray-500">{row.machine_id}</span></Td>
                <Td>{row.machine_name}</Td>
                <Td center>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-green-100 text-green-700 font-bold text-sm">{r(row.total_output)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-teal-600 text-white">
              <td colSpan={6} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput} total pairs</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderEmployeePerformance = () => {
    const avgEff = data!.length ? Math.round(data!.reduce((s, row) => s + (parseFloat(row.efficiency_percent) || 0), 0) / data!.length) : 0;
    const totalOutput = data!.reduce((s, row) => s + r(row.output), 0);
    const gradeStyle: Record<string, string> = {
      'Excellent':    'bg-green-100 text-green-700',
      'Good':         'bg-blue-100 text-blue-700',
      'Average':      'bg-yellow-100 text-yellow-700',
      'Below Target': 'bg-red-100 text-red-700',
    };
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="bg-gray-50">
            {['Date','Line','Emp Code','Employee','Machine ID','Machine','Output','Target','Output %','Target Mins','Actual Mins','Idle Mins','Efficiency %','Grade'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data!.map((row, i) => (
              <tr key={i} className="hover:bg-rose-50/30 transition-colors">
                <Td><span className="font-medium text-gray-600">{fmtDate(row.date)}</span></Td>
                <Td><span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-xs font-semibold">{row.line}</span></Td>
                <Td><span className="font-mono text-gray-600">{row.emp_code}</span></Td>
                <Td><span className="font-medium">{row.emp_name}</span></Td>
                <Td center><span className="font-mono font-bold text-gray-500">{row.machine_id}</span></Td>
                <Td>{row.machine_name}</Td>
                <Td center><span className="font-bold text-green-600">{r(row.output)}</span></Td>
                <Td center>{r(row.target)}</Td>
                <Td center>{row.output_percent ?? 0}%</Td>
                <Td center>{r(row.target_mins)}</Td>
                <Td center>{r(row.actual_mins)}</Td>
                <Td center><span className={r(row.idle_mins) > 0 ? 'text-orange-500 font-semibold' : 'text-gray-400'}>{r(row.idle_mins)}</span></Td>
                <Td center>{effBadge(r(row.efficiency_percent))}</Td>
                <Td center>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${gradeStyle[row.performance_grade] || 'bg-gray-100 text-gray-600'}`}>
                    {row.performance_grade}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-rose-600 text-white">
              <td colSpan={6} className="px-3 py-2.5 text-sm font-bold">{data!.length} rows</td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{totalOutput}</td>
              <td colSpan={5}></td>
              <td className="px-3 py-2.5 text-sm font-bold text-center">{avgEff}% avg</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-full mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Generate and export production reports</p>
          </div>
          {data && data.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${activeColor.activeBg}`}></span>
              <span className="text-sm font-semibold text-gray-700">{pagination.total || data.length} records found</span>
            </div>
          )}
        </div>

        {/* Report Type Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {REPORT_OPTIONS.map(opt => {
            const c = COLOR_MAP[opt.color];
            const isActive = reportType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { setReportType(opt.value); setData(null); setError(null); setPage(1); setSearch(''); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                  isActive
                    ? `${c.activeBg} ${c.activeText} border-transparent shadow-md scale-[1.02]`
                    : `bg-white ${c.text} ${c.border} hover:${c.bg} hover:shadow-sm`
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : c.bg}`}>{opt.icon}</div>
                <span className="text-xs font-semibold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Line</label>
              <select value={selectedLine} onChange={e => setSelectedLine(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                <option value="">All Lines</option>
                {workCentres.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From Date</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To Date</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input type="text" value={search} onChange={e => {
                    const val = e.target.value;
                    setSearch(val);
                    if (data !== null) {
                      if (searchTimeout.current) clearTimeout(searchTimeout.current);
                      searchTimeout.current = setTimeout(() => { setPage(1); fetchReport(1, val); }, 500);
                    }
                  }}
                  onKeyDown={e => e.key === 'Enter' && fetchReport(1, search)}
                  placeholder="Name, line, machine..."
                  className="border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 w-48" />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); if (data !== null) fetchReport(1, ''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => { setPage(1); fetchReport(1); }} disabled={isLoading}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 ${activeColor.activeBg} hover:opacity-90 shadow-sm`}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Generate Report
            </button>
            <button onClick={exportCSV} disabled={!data || data.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-40 transition-all shadow-sm">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className={`h-10 w-10 animate-spin mx-auto mb-3 ${activeColor.text}`} />
              <p className="text-gray-500 font-medium">Generating report...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-red-700 mb-1">Failed to load report</h2>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        ) : data === null ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center py-20">
            <div className={`p-4 rounded-2xl ${activeColor.bg} mb-4`}>
              <div className={activeColor.text}>{activeOption.icon}</div>
            </div>
            <p className="text-gray-500 font-medium">Select filters and click Generate Report</p>
            <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
              {activeOption.label} <ChevronRight className="h-3 w-3" /> {fmtDate(fromDate)} to {fmtDate(toDate)}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Table header bar */}
            <div className={`px-4 py-3 flex justify-between items-center ${activeColor.bg} border-b ${activeColor.border}`}>
              <div className="flex items-center gap-2">
                <span className={activeColor.text}>{activeOption.icon}</span>
                <span className={`font-bold text-sm ${activeColor.text}`}>{activeOption.label}</span>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {fmtDate(fromDate)} — {fmtDate(toDate)}
                {selectedLine && workCentres.length > 0 && ` · ${workCentres.find(w => w.id == selectedLine)?.name}`}
              </span>
            </div>
            {renderTable()}
            {data && data.length > 0 && (
              <Pagination
                currentPage={page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={limit}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleLimitChange}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
