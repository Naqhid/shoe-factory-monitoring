import React, { useState } from 'react';

interface LogEntry {
  id: string;
  machine: string;
  loginTime: string;
  logLine: string;
}

const mockLogData: LogEntry[] = [
  { id: '1', machine: 'Machine-A', loginTime: '2023-10-26 10:00:00', logLine: 'User logged in' },
  { id: '2', machine: 'Machine-B', loginTime: '2023-10-26 10:05:00', logLine: 'System started' },
  { id: '3', machine: 'Machine-A', loginTime: '2023-10-26 10:10:00', logLine: 'Data retrieved' },
  { id: '4', machine: 'Machine-C', loginTime: '2023-10-26 10:15:00', logLine: 'User logged in' },
  { id: '5', machine: 'Machine-B', loginTime: '2023-10-26 10:20:00', logLine: 'Error: Connection lost' },
];

const LogPage: React.FC = () => {
  const [selectedLogLine, setSelectedLogLine] = useState<string>('All');

  const logLines = Array.from(new Set(mockLogData.map(log => log.logLine)));
  const filterOptions = ['All', ...logLines];

  const filteredLogs = selectedLogLine === 'All'
    ? mockLogData
    : mockLogData.filter(log => log.logLine === selectedLogLine);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Machine Logs</h1>

      <div className="mb-4">
        <label htmlFor="logLineFilter" className="block text-sm font-medium text-gray-700">Filter by Log Line:</label>
        <select
          id="logLineFilter"
          name="logLineFilter"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={selectedLogLine}
          onChange={(e) => setSelectedLogLine(e.target.value)}
        >
          {filterOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Machine
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Login Time
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Log Line
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {log.machine}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {log.loginTime}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {log.logLine}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogPage;
