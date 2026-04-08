import React from 'react';
import { Loader2, AlertCircle, Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

interface HourlyProductionData {
  date: string;
  line: string;
  customer: string;
  article_no: string;
  color: string;
  leather: string;
  group: string;
  total_planned_qty: number;
  total_output: number;
  avg_hourly_output: number;
  '9_10': number;
  '10_11': number;
  '11_12': number;
  '12_1': number;
  '2_3': number;
  '3_4': number;
  '4_5': number;
  '5_6': number;
}

interface LineEfficiencyData {
  date: string;
  line: string;
  process: string;
  customer: string;
  article_no: string;
  color: string;
  leather: string;
  group: string;
  total_planned_qty: number;
  total_output: number;
  output_percent: number;
  total_standard_mins_value: number;
  total_produced_mins_value: number;
  targeted_output_smv: number;
  efficiency_percent: number;
}

export const Reports: React.FC = () => {
  const [fromDate, setFromDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = React.useState<'hourly-production' | 'line-efficiency'>('hourly-production');
  const [data, setData] = React.useState<any[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchReport = async () => {
    if (!fromDate || !toDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/reports/${reportType}?fromDate=${fromDate}&toDate=${toDate}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setData(result.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!data || data.length === 0) return;

    try {
      // Get headers from the first row
      const headers = Object.keys(data[0]);
      
      // Create CSV content with proper escaping
      const csvRows = [];
      
      // Add headers
      csvRows.push(headers.map(header => `"${header}"`).join(','));
      
      // Add data rows
      data.forEach((row: any) => {
        const values = headers.map(header => {
          const value = row[header];
          // Handle null/undefined values and escape quotes
          const stringValue = value === null || value === undefined ? '' : String(value);
          return `"${stringValue.replace(/"/g, '""')}"`; // Escape quotes by doubling them
        });
        csvRows.push(values.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${reportType}_report_${fromDate}_to_${toDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('CSV file downloaded successfully');
      } else {
        toast.error('CSV download not supported in this browser');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV file');
    }
  };



  const r = (val: number) => Math.round(val ?? 0);

  const renderHourlyProductionTable = (data: HourlyProductionData[]) => (
    <div className="overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4 p-4 bg-blue-50">HOURLY PRODUCTION STATUS</h3>
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Date</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Line</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Customer</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Article No</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Color</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Leather</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Group</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Total Planned</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Total Output</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">WIP</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Avg Hourly Output</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">9-10</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">10-11</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">11-12</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">12-1</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">2-3</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">3-4</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">4-5</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">5-6</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => {
            const wip = r(row.total_planned_qty) - r(row.total_output);
            return (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-2 text-sm text-gray-900">{row.date}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{row.line}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{row.customer}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{row.article_no}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{row.color}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{row.leather}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{row.group}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row.total_planned_qty)}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row.total_output)}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{wip}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row.avg_hourly_output)}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['9_10'])}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['10_11'])}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['11_12'])}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['12_1'])}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['2_3'])}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['3_4'])}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['4_5'])}</td>
                <td className="px-2 py-2 text-sm text-gray-900">{r(row['5_6'])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderLineEfficiencyTable = (data: LineEfficiencyData[]) => (
    <div className="overflow-x-auto">
      <h3 className="text-lg font-semibold mb-4 p-4 bg-green-50">LINE AND PROCESS EFFICIENCY</h3>
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Date</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Line</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Process</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Customer</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Article No</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Color</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Leather</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Group</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Total Planned Qty</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Total Output</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Output %</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Total Standard Mins Value</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Total Produced Mins Value</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Targeted Output @ SMV</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Efficiency %</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-2 text-sm text-gray-900">{row.date}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{row.line}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{row.process}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{row.customer}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{row.article_no}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{row.color}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{row.leather}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{row.group}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{r(row.total_planned_qty)}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{r(row.total_output)}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{r(row.output_percent)}%</td>
              <td className="px-2 py-2 text-sm text-gray-900">{r(row.total_standard_mins_value)}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{r(row.total_produced_mins_value)}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{r(row.targeted_output_smv)}</td>
              <td className="px-2 py-2 text-sm text-gray-900">{r(row.efficiency_percent)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2 p-2">Data source: Machine center summary</p>
      <p className="text-xs text-gray-500 p-2">Summary of the date range selected - report should generate datewise</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Reports</h1>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => {
                  setReportType(e.target.value as any);
                  setData(null); // Clear previous data when report type changes
                  setError(null); // Clear any previous errors
                }}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="hourly-production">Hourly Production Status</option>
                <option value="line-efficiency">Line and Process Efficiency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={fetchReport}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Generate Report
              </button>
              <button
                onClick={exportToExcel}
                disabled={!data || data.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading report...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Report</h2>
            <p className="text-red-600">{error}</p>
          </div>
        ) : data === null ? (
          <div className="bg-white rounded-lg shadow-md">
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Select filters and click Generate Report</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {data.length > 0 ? (
              reportType === 'hourly-production' ?
                renderHourlyProductionTable(data) :
                renderLineEfficiencyTable(data)
            ) : (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No data available for the selected date range</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};