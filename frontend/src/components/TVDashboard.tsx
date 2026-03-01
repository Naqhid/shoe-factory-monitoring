import React, { useState, useEffect } from 'react';
import { Smile, Frown, Meh, TrendingUp, Target, Clock, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../services/api';

export const TVDashboard: React.FC = () => {
    const [workCentres, setWorkCentres] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);

    // Fetch work centres on mount
    useEffect(() => {
        const fetchWorkCentres = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/tv-dashboard/work-centres`);
                const result = await res.json();
                if (result.success && result.data.length > 0) {
                    setWorkCentres(result.data);
                }
            } catch (error) {
                console.error('Error fetching work centres:', error);
            }
        };
        fetchWorkCentres();
    }, []);

    // Fetch dashboard data for current work centre
    useEffect(() => {
        if (workCentres.length === 0) return;

        const fetchDashboard = async () => {
            try {
                const workCentreId = workCentres[currentIndex].id;
                const now = new Date();
                const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const res = await fetch(`${API_BASE_URL}/api/tv-dashboard/dashboard/${workCentreId}?date=${localDate}`);
                const result = await res.json();
                if (result.success) {
                    setDashboardData(result.data);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error fetching dashboard:', error);
            }
        };

        fetchDashboard();
        const interval = setInterval(fetchDashboard, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, [workCentres, currentIndex]);

    // Rotate work centres every 1 minute
    useEffect(() => {
        if (workCentres.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % workCentres.length);
        }, 60000); // 1 minute
        return () => clearInterval(interval);
    }, [workCentres]);

    // Update current time every second
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !dashboardData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
                <div className="text-white text-2xl">Loading Dashboard...</div>
            </div>
        );
    }

    const { topSection, middleSection, lowerSection } = dashboardData;

    // Prepare hourly chart data
    const chartData = lowerSection.hourlyData.map((item: any) => ({
        hour: `${item.hour}:00`,
        output: item.output || 0
    }));

    return (
        <div className="min-h-screen p-3 sm:p-6">
            {/* Top Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">{topSection.workCentreName}</h1>
                    <div className="text-left sm:text-right">
                        <div className="text-white text-lg sm:text-2xl font-semibold">
                            {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-blue-200 text-base sm:text-xl">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center">
                        <Target className="h-8 w-8 sm:h-12 sm:w-12 text-white mx-auto mb-2 sm:mb-3" />
                        <div className="text-white/80 text-xs sm:text-sm mb-1 sm:mb-2">Target</div>
                        <div className="text-white text-2xl sm:text-4xl font-bold">{topSection.target}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center">
                        <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 text-green-400 mx-auto mb-2 sm:mb-3" />
                        <div className="text-white/80 text-xs sm:text-sm mb-1 sm:mb-2">Output</div>
                        <div className="text-white text-2xl sm:text-4xl font-bold">{topSection.output}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center">
                        <div className="text-white/80 text-xs sm:text-sm mb-1 sm:mb-2">Output %</div>
                        <div className={`text-2xl sm:text-4xl font-bold ${topSection.outputPercent >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {topSection.outputPercent}%
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center">
                        <Zap className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-400 mx-auto mb-2 sm:mb-3" />
                        <div className="text-white/80 text-xs sm:text-sm mb-1 sm:mb-2">Efficiency %</div>
                        <div className={`text-2xl sm:text-4xl font-bold ${topSection.efficiencyPercent >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {topSection.efficiencyPercent}%
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-6 flex items-center justify-center col-span-2 sm:col-span-1">
                        {topSection.showHappyEmoji ? (
                            <Smile className="h-16 w-16 sm:h-24 sm:w-24 text-green-400" />
                        ) : topSection.showMediumEmoji ? (
                            <Meh className="h-16 w-16 sm:h-24 sm:w-24 text-yellow-400" />
                        ) : (
                            <Frown className="h-16 w-16 sm:h-24 sm:w-24 text-red-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Middle Section */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">Line Wise Output</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-blue-200">
                        <div className="text-blue-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Target</div>
                        <div className="text-blue-900 text-2xl sm:text-4xl font-bold">{middleSection.target}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-green-200">
                        <div className="text-green-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Output</div>
                        <div className="text-green-900 text-2xl sm:text-4xl font-bold">{middleSection.output}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-purple-200">
                        <div className="text-purple-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Output %</div>
                        <div className="text-purple-900 text-2xl sm:text-4xl font-bold">{middleSection.outputPercent}%</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-orange-200">
                        <div className="text-orange-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Hourly Output</div>
                        <div className="text-orange-900 text-2xl sm:text-4xl font-bold">{middleSection.hourlyOutput}</div>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-indigo-200 col-span-2 sm:col-span-1">
                        <div className="text-indigo-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Efficiency %</div>
                        <div className="text-indigo-900 text-2xl sm:text-4xl font-bold">{middleSection.efficiencyPercent}%</div>
                    </div>
                </div>
            </div>

            {/* Lower Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Hourly Output Chart */}
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8">
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Hourly Output</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="output" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Top 3 Bottlenecks */}
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8">
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Top 3 Bottleneck Machines</h3>
                    {lowerSection.bottlenecks.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4">
                            {lowerSection.bottlenecks.map((item: any, index: number) => (
                                <div key={index} className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 sm:p-4">
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-gray-800 font-bold text-sm sm:text-lg truncate">{item.machine_centre_name}</div>
                                            <div className="text-gray-600 text-xs sm:text-sm truncate">{item.work_centre_name}</div>
                                        </div>
                                        <div className="text-red-600 text-2xl sm:text-3xl font-bold flex-shrink-0">{item.efficiency}%</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 sm:h-64 text-gray-400">
                            <div className="text-center px-4">
                                <Smile className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-green-400" />
                                <div className="text-sm sm:text-xl">No Bottlenecks - All machines performing well!</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
