import axios from 'axios';
import { MachineStatus, RunIdleData, HourlyData, OverallEfficiency, ApiResponse } from '../types';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://shoe-factory-monitoring-production.up.railway.app/api'
  : 'http://localhost:3001/api';

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

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const healthUrl = process.env.NODE_ENV === 'production' 
      ? 'https://shoe-factory-monitoring-production.up.railway.app/health'
      : 'http://localhost:3001/health';
    const response = await axios.get(healthUrl);
    return response.data;
  },
};