import React from 'react';
import { Link } from 'react-router-dom';
import { Factory, Users } from 'lucide-react';

const lines = [
  { id: 'line1', name: 'Line 1', machineId: 'MAC-001', empId: 'EMP-1001', empName: 'John Doe' },
  { id: 'line2', name: 'Line 2', machineId: 'MAC-002', empId: 'EMP-1002', empName: 'Jane Smith' },
];

export const MobileLineSelector: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center mb-6">
          <Factory className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Production Line</h1>
          <p className="text-gray-500">Choose a line to access mobile production dashboard</p>
        </div>

        <div className="space-y-4">
          {lines.map((line) => (
            <Link
              key={line.id}
              to={`/mobile/${line.id}`}
              className="block bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Factory className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">{line.name}</h3>
                    <p className="text-sm text-gray-500">Machine: {line.machineId}</p>
                    <div className="flex items-center mt-1">
                      <Users className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-600">{line.empName}</span>
                    </div>
                  </div>
                </div>
                <div className="text-blue-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};