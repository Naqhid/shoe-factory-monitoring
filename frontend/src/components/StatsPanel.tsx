import React from 'react';
import { Play, Square, Zap, BarChart3, Target } from 'lucide-react';
import { MachineStatus, OverallDailyData } from '../types';

interface StatsPanelProps {
  machines: MachineStatus[];
  overallDailyData?: OverallDailyData;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ machines, overallDailyData }) => {
  const runningCount = machines.filter(m => m.status === 1).length;
  const idleCount = machines.filter(m => m.status === 0).length;
  const totalMachines = machines.length;
  
  const stats = [
    {
      label: 'Running',
      value: runningCount,
      icon: Play,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      label: 'Idle',
      value: idleCount,
      icon: Square,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    {
      label: 'Today\'s Target',
      value: overallDailyData?.todays_target || 0,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      label: 'Output',
      value: overallDailyData?.output || 0,
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      label: 'Output %',
      value: overallDailyData ? `${overallDailyData.output_percentage.toFixed(1)}%` : 'N/A',
      icon: Zap,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      label: 'Overall Efficiency %',
      value: overallDailyData ? `${overallDailyData.overall_efficiency_percentage.toFixed(1)}%` : 'N/A',
      icon: Zap,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`${stat.bgColor} ${stat.borderColor} border rounded-lg p-2 sm:p-4 transition-all hover:shadow-md`}
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
            <span className={`text-lg sm:text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-gray-700">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};