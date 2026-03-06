import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { API_BASE_URL } from '../services/api';

interface HourlyData {
  hour: string;
  production: number;
}

interface HourlyOutputData {
  hourlyData: HourlyData[];
  average: number;
  target: number;
}

interface Props {
  workCentreId: number;
  workCentreName?: string;
  showProgress?: boolean;
  progress?: number;
}

export const HourlyOutputChart: React.FC<Props> = ({ 
  workCentreId, 
  workCentreName, 
  showProgress = false, 
  progress = 0 
}) => {
  const [data, setData] = useState<HourlyOutputData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [workCentreId]);

  const fetchData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hourly-output/${workCentreId}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching hourly output:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!data || data.hourlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">No data available</div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border-2 border-gray-300 rounded-lg shadow-lg">
          <p className="text-lg font-bold mb-2">{payload[0].payload.hour}</p>
          <p className="text-blue-600 font-semibold">Production: {payload[0].value} pairs</p>
          <p className="text-orange-600 font-semibold">Target: {data.target} pairs</p>
          <p className="text-green-600 font-semibold">Average: {data.average} pairs</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {showProgress && (
        <div className="mb-3 sm:mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <h2 className="text-3xl font-bold mb-6 text-blue-600">
        {workCentreName ? `${workCentreName} - Hourly Output` : 'Hourly Output'}
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data.hourlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 16, fontWeight: 600 }}
            stroke="#666"
          />
          <YAxis 
            tick={{ fontSize: 16, fontWeight: 600 }}
            stroke="#666"
            label={{ value: 'Pairs', angle: -90, position: 'insideLeft', style: { fontSize: 16, fontWeight: 600 } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '18px', fontWeight: 600 }}
            iconSize={20}
          />
          
          {/* Target Line */}
          <ReferenceLine 
            y={data.target} 
            stroke="#f97316" 
            strokeWidth={3}
            label={{ value: `Target: ${data.target}`, position: 'right', fill: '#f97316', fontSize: 16, fontWeight: 600 }}
          />
          
          {/* Average Line */}
          <ReferenceLine 
            y={data.average} 
            stroke="#22c55e" 
            strokeWidth={3}
            strokeDasharray="5 5"
            label={{ value: `Avg: ${data.average}`, position: 'right', fill: '#22c55e', fontSize: 16, fontWeight: 600 }}
          />
          
          {/* Production Line */}
          <Line 
            type="monotone" 
            dataKey="production" 
            stroke="#3b82f6" 
            strokeWidth={4}
            dot={{ fill: '#3b82f6', r: 6 }}
            activeDot={{ r: 8 }}
            name="Hourly Production"
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-lg text-gray-600">Current Hour</p>
          <p className="text-3xl font-bold text-blue-600">
            {data.hourlyData[data.hourlyData.length - 1]?.production || 0}
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <p className="text-lg text-gray-600">Target</p>
          <p className="text-3xl font-bold text-orange-600">{data.target}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-lg text-gray-600">Average</p>
          <p className="text-3xl font-bold text-green-600">{data.average}</p>
        </div>
      </div>
    </div>
  );
};
