import React from 'react';
import { useQuery } from 'react-query';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE } from '../services/api';

interface ReportData {
  machine_id: string;
  total_run_time: number;
  total_idle_time: number;
  efficiency_percentage: number;
  date: string;
}

interface HourlyData {
  hour: number;
  machine_id: string;
  run_time: number;
  idle_time: number;
  efficiency: number;
}

export const Reports: React.FC = () => {
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = React.useState<'efficiency' | 'run-idle' | 'hourly'>('efficiency');


  const { data, isLoading, error } = useQuery(
    ['reports', reportType, selectedDate],
    async () => {
      const response = await fetch(`${API_BASE}/api/reports/${reportType}?date=${selectedDate}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    { enabled: !!selectedDate }
  );

  const exportToExcel = () => {
    if (!data) return;

    // Simple CSV export for now
    const csvContent = 'data:text/csv;charset=utf-8,' +
      Object.keys(data[0] || {}).join(',') + '\n' +
      data.map((row: any) => Object.values(row).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportType}_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Report</h2>
          <p className="text-red-600">Unable to load report data. Please try again.</p>
        </div>
      </div>
    );
  }

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
                onChange={(e) => setReportType(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="efficiency">Efficiency Report</option>
                <option value="run-idle">Run/Idle Report</option>
                <option value="hourly">Hourly Report</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
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
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {data && data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(data[0]).map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row: any, index: number) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {Object.values(row).map((value: any, i) => (
                          <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {typeof value === 'number' ? value.toFixed(2) : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No data available for the selected date</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};