import React, { useState, useEffect } from 'react';
import { Smile, Frown, Meh, TrendingUp, Target, Zap, Activity, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL as API_BASE } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';



export const ProductionTracker: React.FC = () => {
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [workCentres, setWorkCentres] = useState<any[]>([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState({ present: 0, target: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkCentres = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/tv-dashboard/work-centres`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setWorkCentres(result.data);
          setSelectedLine(result.data[0].id.toString());
        }
      } catch (error) {
        console.error('Failed to load work centres:', error);
      }
    };
    loadWorkCentres();
  }, []);

  const [error, setError] = useState<string | null>(null);

  const loadAttendanceData = async () => {
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      console.log('Loading attendance for work centre:', workCentreId, 'date:', selectedDate);
      
      // Get attendance directly from mobile sessions
      const attendanceResponse = await fetch(`${API_BASE}/api/mobile-sessions/attendance/${workCentreId}?date=${selectedDate}`);
      if (attendanceResponse.ok) {
        const attendanceResult = await attendanceResponse.json();
        console.log('Direct attendance result:', attendanceResult);
        if (attendanceResult.success) {
          setAttendanceData({
            present: attendanceResult.data.present || 0,
            target_employees: attendanceResult.data.target || 3
          });
          return;
        }
      }
      
      // Fallback to TV dashboard API
      const response = await fetch(`${API_BASE}/api/tv-dashboard/dashboard/${workCentreId}?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        console.log('Attendance API response:', result.data.middleSection);
        setAttendanceData({
          present: result.data.middleSection?.present || 0,
          target_employees: result.data.middleSection?.target_employees || 0
        });
      }
    } catch (error) {
      console.error('Failed to load attendance data:', error);
    }
  };

  const loadDashboardData = async () => {
    if (!dashboardData) setLoading(true);
    setError(null);
    try {
      const workCentreId = selectedLine || workCentres[0]?.id || 1;
      const res = await fetch(`${API_BASE}/api/tv-dashboard/dashboard/${workCentreId}?date=${selectedDate}`);
      const result = await res.json();
      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError(error.message || 'Connection error');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workCentres.length > 0 && selectedLine) {
      loadDashboardData();
      loadAttendanceData();
      const interval = setInterval(() => {
        loadDashboardData();
        loadAttendanceData();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedDate, selectedLine, workCentres]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);



  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-sm w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadDashboardData}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { topSection, middleSection, lowerSection } = dashboardData;
  const currentWorkCentreId = parseInt(selectedLine) || workCentres[0]?.id || 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with filters */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Production Tracker</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Line</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>{wc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Attendance</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold text-purple-600">
                  {attendanceData.present} / {attendanceData.target_employees}
                </span>
                <span className="text-sm text-gray-600">Present / Target</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Section - Overall Performance */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-2xl p-6 mb-4">
          <h2 className="text-white text-2xl font-bold mb-4">Overall Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <Target className="h-10 w-10 text-white mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Target</div>
              <div className="text-white text-3xl font-bold">{topSection.target}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <TrendingUp className="h-10 w-10 text-green-300 mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Output</div>
              <div className="text-white text-3xl font-bold">{topSection.output}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <Activity className="h-10 w-10 text-purple-300 mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Output %</div>
              <div className={`text-3xl font-bold ${topSection.outputPercent >= 90 ? 'text-green-300' : topSection.outputPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                {topSection.outputPercent}%
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 text-center">
              <Zap className="h-10 w-10 text-yellow-300 mx-auto mb-2" />
              <div className="text-white/90 text-sm mb-1">Efficiency %</div>
              <div className={`text-3xl font-bold ${topSection.efficiencyPercent >= 90 ? 'text-green-300' : topSection.efficiencyPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                {topSection.efficiencyPercent}%
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 flex items-center justify-center">
              {topSection.showHappyEmoji ? (
                <Smile className="h-20 w-20 text-green-300 animate-pulse" />
              ) : topSection.showMediumEmoji ? (
                <Meh className="h-20 w-20 text-yellow-300" />
              ) : (
                <Frown className="h-20 w-20 text-red-300" />
              )}
            </div>
          </div>
        </div>

        {/* LINE PERFORMANCE Section */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-4">
          <h3 className="text-2xl font-bold text-blue-600 mb-4">LINE PERFORMANCE</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">LINE</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">TARGET</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT %</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">EFFICIENCY %</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">WIP</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {lowerSection.linePerformance?.map((line: any, index: number) => {
                  const getStatusColor = (eff: number) => {
                    if (eff >= 95) return 'bg-green-500';
                    if (eff >= 85) return 'bg-yellow-500';
                    return 'bg-red-500';
                  };
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-semibold text-gray-800">{line.line_name}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-blue-600">{line.target}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-green-600">{line.output}</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-purple-600">{line.output_percentage}%</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-orange-600">{line.efficiency}%</td>
                      <td className="px-4 py-4 text-center text-lg font-bold text-red-600">{line.wip || 0}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <div className={`w-4 h-4 rounded-full ${getStatusColor(line.efficiency)}`}></div>
                          <div className={`w-4 h-4 rounded-full ${getStatusColor(line.efficiency)}`}></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section - Charts */}
        <div className="space-y-4">
          <HourlyOutputChart 
            workCentreId={currentWorkCentreId} 
            workCentreName={workCentres.find(wc => wc.id == selectedLine)?.name || 'Unknown Line'}
            showProgress={false}
            progress={0}
          />

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-red-600" />
              Top 3 Bottleneck Machines
            </h3>
            {lowerSection.bottlenecks.length > 0 ? (
              <div className="space-y-4">
                {lowerSection.bottlenecks.map((item: any, index: number) => (
                  <div key={index} className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-red-600 font-bold text-lg bg-white px-2 py-1 rounded">#{index + 1}</span>
                        <div className="flex-1">
                          <div className="text-gray-800 font-bold text-lg">{item.machine_centre_name}</div>
                          <div className="text-gray-600 text-sm">{item.work_centre_name}</div>
                          <div className="text-blue-600 text-sm font-medium">WIP: {item.wip || 0}</div>
                        </div>
                      </div>
                      <div className="text-red-600 text-3xl font-bold bg-white px-3 py-1 rounded-lg">{item.efficiency}%</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  <Smile className="h-16 w-16 mx-auto mb-4 text-green-400" />
                  <div className="text-xl">No Bottlenecks - All machines performing well!</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
