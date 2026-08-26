import React from 'react';
import { X, Clock, Zap, BarChart3, TrendingUp } from 'lucide-react';
import { MachineStatus } from '../types';
import { format, subHours } from 'date-fns';

interface MachineDetailModalProps {
  machine: MachineStatus;
  efficiency?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const MachineDetailModal: React.FC<MachineDetailModalProps> = ({
  machine,
  efficiency,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const isRunning = machine.status === 1;
  
  // Mock 24h timeline data (in real app, fetch from API)
  const timelineData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    status: Math.random() > 0.3 ? 1 : 0, // Random status for demo
  }));

  const runHours = timelineData.filter(d => d.status === 1).length;
  const idleHours = timelineData.filter(d => d.status === 0).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto mx-2 sm:mx-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{machine.machine_id}</h2>
            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
              isRunning ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isRunning ? 'RUNNING' : 'IDLE'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Current Status */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="text-xs sm:text-sm font-medium text-blue-800">Last Update</span>
              </div>
              <p className="text-base sm:text-lg font-semibold text-blue-900">
                {format(new Date(machine.event_time), 'HH:mm:ss')}
              </p>
              <p className="text-xs text-blue-600">
                {format(new Date(machine.event_time), 'MMM dd, yyyy')}
              </p>
            </div>

            {efficiency !== undefined && (
              <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <span className="text-xs sm:text-sm font-medium text-green-800">Efficiency</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-green-900">{efficiency}%</p>
                <p className="text-xs text-green-600">Today's performance</p>
              </div>
            )}

            <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                <span className="text-xs sm:text-sm font-medium text-purple-800">Source File</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-purple-900 truncate">
                {machine.source_file}
              </p>
              <p className="text-xs text-purple-600">Latest data source</p>
            </div>
          </div>

          {/* 24h Timeline */}
          <div>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">24-Hour Activity</h3>
            </div>
            
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3 text-xs sm:text-sm">
                <span className="text-gray-600">00:00</span>
                <span className="text-gray-600">12:00</span>
                <span className="text-gray-600">23:59</span>
              </div>
              
              <div className="flex gap-0.5 sm:gap-1 mb-3 sm:mb-4">
                {timelineData.map((item, index) => (
                  <div
                    key={index}
                    className={`flex-1 h-6 sm:h-8 rounded-sm ${
                      item.status === 1 ? 'bg-green-500' : 'bg-red-300'
                    }`}
                    title={`${String(item.hour).padStart(2, '0')}:00 - ${item.status === 1 ? 'Running' : 'Idle'}`}
                  ></div>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded"></div>
                  <span>Running: {runHours}h</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-300 rounded"></div>
                  <span>Idle: {idleHours}h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
            <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base">
              View Full History
            </button>
            <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm sm:text-base">
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};