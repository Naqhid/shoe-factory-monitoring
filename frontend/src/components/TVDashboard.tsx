import React, { useState, useEffect } from 'react';
import { Smile, Frown, Meh, TrendingUp, Target, Clock, Zap, Activity } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { HourlyOutputChart } from './HourlyOutputChart';

export const TVDashboard: React.FC = () => {
    const [workCentres, setWorkCentres] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);

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
        const interval = setInterval(fetchDashboard, 10000);
        return () => clearInterval(interval);
    }, [workCentres, currentIndex]);

    useEffect(() => {
        if (workCentres.length <= 1) return;
        setProgress(0);
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % workCentres.length);
            setProgress(0);
        }, 60000);
        return () => clearInterval(interval);
    }, [workCentres]);

    useEffect(() => {
        if (workCentres.length <= 1) return;
        const interval = setInterval(() => setProgress((prev) => Math.min(prev + 0.167, 100)), 100);
        return () => clearInterval(interval);
    }, [currentIndex, workCentres]);

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
    const currentWorkCentreId = workCentres[currentIndex]?.id;

    const chartData = lowerSection.hourlyData.map((item: any) => ({
        hour: `${item.hour}:00`,
        output: item.output || 0
    }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-3 sm:p-6">
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 mb-4 sm:mb-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">{topSection.workCentreName}</h1>
                        <div className="text-left sm:text-right bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                            <div className="text-white text-lg sm:text-2xl font-semibold">
                                {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-blue-100 text-base sm:text-xl">
                                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <Target className="h-8 w-8 sm:h-12 sm:w-12 text-white mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Target</div>
                            <div className="text-white text-2xl sm:text-4xl font-bold drop-shadow-md">{topSection.target}</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 text-green-300 mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Output</div>
                            <div className="text-white text-2xl sm:text-4xl font-bold drop-shadow-md">{topSection.output}</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <Activity className="h-8 w-8 sm:h-12 sm:w-12 text-purple-300 mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Output %</div>
                            <div className={`text-2xl sm:text-4xl font-bold drop-shadow-md ${topSection.outputPercent >= 90 ? 'text-green-300' : topSection.outputPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {topSection.outputPercent}%
                            </div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center hover:bg-white/30 transition-all duration-300 shadow-lg">
                            <Zap className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-300 mx-auto mb-2 sm:mb-3 drop-shadow-md" />
                            <div className="text-white/90 text-xs sm:text-sm mb-1 sm:mb-2 font-medium">Efficiency %</div>
                            <div className={`text-2xl sm:text-4xl font-bold drop-shadow-md ${topSection.efficiencyPercent >= 90 ? 'text-green-300' : topSection.efficiencyPercent >= 70 ? 'text-yellow-300' : 'text-red-300'}`}>
                                {topSection.efficiencyPercent}%
                            </div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-6 flex items-center justify-center col-span-2 sm:col-span-1 hover:bg-white/30 transition-all duration-300 shadow-lg">
                            {topSection.showHappyEmoji ? (
                                <Smile className="h-16 w-16 sm:h-24 sm:w-24 text-green-300 drop-shadow-lg animate-pulse" />
                            ) : topSection.showMediumEmoji ? (
                                <Meh className="h-16 w-16 sm:h-24 sm:w-24 text-yellow-300 drop-shadow-lg" />
                            ) : (
                                <Frown className="h-16 w-16 sm:h-24 sm:w-24 text-red-300 drop-shadow-lg" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* LINE PERFORMANCE Section */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 mb-4 sm:mb-6 border border-gray-100">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 mb-4 sm:mb-6">LINE PERFORMANCE</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">LINE</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">TARGET / HR</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">OUTPUT / HR</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">EFFICIENCY</th>
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
                                        <td className="px-4 py-4 text-center text-lg font-bold text-blue-600">{line.target_per_hour}</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-green-600">{line.output_per_hour}</td>
                                        <td className="px-4 py-4 text-center text-lg font-bold text-purple-600">{line.efficiency}%</td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center gap-2">
                                                <div className={`w-4 h-4 rounded-full ${getStatusColor(line.efficiency)}`}></div>
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

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 mb-4 sm:mb-6 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/20 to-transparent rounded-full blur-3xl" />
                <div className="relative z-10">
                    {workCentres.length > 1 && (
                        <div className="mb-3 sm:mb-4">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6">
                        <span className="text-blue-600">{middleSection.workCentreName}</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-blue-200 hover:shadow-lg transition-all duration-300">
                            <div className="text-blue-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Target</div>
                            <div className="text-blue-900 text-2xl sm:text-4xl font-bold">{middleSection.target}</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-green-200 hover:shadow-lg transition-all duration-300">
                            <div className="text-green-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Output</div>
                            <div className="text-green-900 text-2xl sm:text-4xl font-bold">{middleSection.output}</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-purple-200 hover:shadow-lg transition-all duration-300">
                            <div className="text-purple-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Output %</div>
                            <div className="text-purple-900 text-2xl sm:text-4xl font-bold">{middleSection.outputPercent}%</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-orange-200 hover:shadow-lg transition-all duration-300">
                            <div className="text-orange-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Hourly Output</div>
                            <div className="text-orange-900 text-2xl sm:text-4xl font-bold">{middleSection.hourlyOutput}</div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center border-2 border-indigo-200 col-span-2 sm:col-span-1 hover:shadow-lg transition-all duration-300">
                            <div className="text-indigo-700 text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Efficiency %</div>
                            <div className="text-indigo-900 text-2xl sm:text-4xl font-bold">{middleSection.efficiencyPercent}%</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
                <HourlyOutputChart workCentreId={currentWorkCentreId} />

                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 border border-gray-100 hover:shadow-3xl transition-shadow duration-300">
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 mb-4 sm:mb-6 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-red-600" />
                        Top 3 Bottleneck Machines
                    </h3>
                    {lowerSection.bottlenecks.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4">
                            {lowerSection.bottlenecks.map((item: any, index: number) => (
                                <div key={index} className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all duration-300 hover:scale-105">
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <span className="text-red-600 font-bold text-lg bg-white px-2 py-1 rounded">#{index + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-gray-800 font-bold text-sm sm:text-lg truncate">{item.machine_centre_name}</div>
                                                <div className="text-gray-600 text-xs sm:text-sm truncate">{item.work_centre_name}</div>
                                            </div>
                                        </div>
                                        <div className="text-red-600 text-2xl sm:text-3xl font-bold flex-shrink-0 bg-white px-3 py-1 rounded-lg shadow-sm">{item.efficiency}%</div>
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
