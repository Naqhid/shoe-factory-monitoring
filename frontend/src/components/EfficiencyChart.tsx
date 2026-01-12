import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { RunIdleData } from '../types';

interface EfficiencyChartProps {
  data: RunIdleData[];
}

export const EfficiencyChart: React.FC<EfficiencyChartProps> = ({ data }) => {
  const chartData = data.map(item => ({
    machine_id: item.machine_id,
    efficiency: item.efficiency_percentage || 0,
    run_minutes: item.run_minutes,
    idle_minutes: item.idle_minutes,
  })).sort((a, b) => b.efficiency - a.efficiency);

  const getBarColor = (efficiency: number) => {
    if (efficiency >= 90) return '#22C55E'; // Green
    if (efficiency >= 80) return '#F59E0B'; // Yellow
    if (efficiency >= 70) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Machine Efficiency Ranking</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>90%+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>80-89%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>70-79%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>&lt;70%</span>
          </div>
        </div>
      </div>
      
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="machine_id" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${value}%`,
                'Efficiency'
              ]}
              labelFormatter={(label: string) => `Machine: ${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Bar dataKey="efficiency" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.efficiency)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Top and Bottom Performers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t">
        <div>
          <h4 className="text-sm font-medium text-green-700 mb-2">🏆 Top Performers</h4>
          {chartData.slice(0, 3).map((item, index) => (
            <div key={item.machine_id} className="flex justify-between text-sm py-1">
              <span>{index + 1}. {item.machine_id}</span>
              <span className="font-medium text-green-600">{item.efficiency}%</span>
            </div>
          ))}
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-red-700 mb-2">⚠️ Needs Attention</h4>
          {chartData.slice(-3).reverse().map((item, index) => (
            <div key={item.machine_id} className="flex justify-between text-sm py-1">
              <span>{item.machine_id}</span>
              <span className="font-medium text-red-600">{item.efficiency}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};