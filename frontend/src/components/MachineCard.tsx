import React from 'react';
import { Play, Square, Zap, Info } from 'lucide-react';
import { MachineStatus } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface MachineCardProps {
  machine: MachineStatus;
  efficiency?: number;
  onClick?: () => void;
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, efficiency, onClick }) => {
  const isRunning = machine.status === 1;
  
  const getEfficiencyColor = (eff: number) => {
    if (eff >= 90) return 'text-green-600 bg-green-50';
    if (eff >= 80) return 'text-yellow-600 bg-yellow-50';
    if (eff >= 70) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getEfficiencyIcon = (eff: number) => {
    if (eff >= 90) return '🏆';
    if (eff >= 80) return '🥈';
    if (eff >= 70) return '🥉';
    return '⚠️';
  };

  const statusTooltip = isRunning 
    ? "Machine active & producing shoes" 
    : "No production signal received - machine idle";

  return (
    <div 
      className={`machine-card ${isRunning ? 'machine-running' : 'machine-idle'} ${
        onClick ? 'cursor-pointer hover:scale-105' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{machine.machine_id}</h3>
        <div className="flex items-center gap-2">
          <div className="relative group">
            {isRunning ? (
              <Play className="h-5 w-5 text-running fill-current" />
            ) : (
              <Square className="h-5 w-5 text-idle fill-current" />
            )}
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              {statusTooltip}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
          {onClick && (
            <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 transition-colors" />
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isRunning ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isRunning ? 'RUNNING' : 'IDLE'}
          </span>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(machine.event_time), { addSuffix: true })}
          </span>
        </div>
        
        {efficiency !== undefined && (
          <div className={`flex items-center justify-between p-2 rounded ${getEfficiencyColor(efficiency)}`}>
            <div className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">{efficiency}%</span>
            </div>
            <span className="text-lg">{getEfficiencyIcon(efficiency)}</span>
          </div>
        )}
        
        <div className="text-xs text-gray-500 pt-1 border-t">
          Last update: {new Date(machine.event_time).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};