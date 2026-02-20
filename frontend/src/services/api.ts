import axios from 'axios';
import { MachineStatus, RunIdleData, HourlyData, OverallEfficiency, ApiResponse } from '../types';

// Use Local Windows Server (192.168.56.103)
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `http://${window.location.hostname}:3001/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const apiService = {
  async getMachineStatus(): Promise<MachineStatus[]> {
    const response = await api.get<ApiResponse<MachineStatus[]>>('/machines/status');
    return response.data.data;
  },

  async getRunIdleReport(date: string): Promise<RunIdleData[]> {
    const response = await api.get<ApiResponse<RunIdleData[]>>(`/reports/run-idle?date=${date}`);
    return response.data.data;
  },

  async getHourlyReport(date: string): Promise<HourlyData[]> {
    const response = await api.get<ApiResponse<HourlyData[]>>(`/reports/hourly?date=${date}`);
    return response.data.data;
  },

  async getEfficiencyReport(date: string): Promise<RunIdleData[]> {
    const response = await api.get<ApiResponse<RunIdleData[]>>(`/reports/efficiency?date=${date}`);
    return response.data.data;
  },

  async getOverallEfficiency(date: string): Promise<OverallEfficiency> {
    const response = await api.get<ApiResponse<OverallEfficiency>>(`/reports/overall-efficiency?date=${date}`);
    return response.data.data;
  },

  async getDailyDashboardData(date: string): Promise<any[]> {
    const response = await api.get<ApiResponse<any[]>>(`/dashboard/daily?date=${date}`);
    return response.data.data;
  },

  async getOverallDailyData(date: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>(`/dashboard/overall-daily?date=${date}`);
    return response.data.data;
  },

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const HEALTH_URL = API_BASE.replace('/api', '/health');
    const response = await axios.get(HEALTH_URL);
    return response.data;
  },
};