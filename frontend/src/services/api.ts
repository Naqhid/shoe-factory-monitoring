import axios from 'axios';
import { MachineStatus, RunIdleData, HourlyData, OverallEfficiency, ApiResponse } from '../types';

export const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:3001`;
const API_BASE = `${API_BASE_URL}/api`;

// Central fetch wrapper — attaches JWT and handles 401 with refresh
export const apiFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('jwt_token');
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  let response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    // Try refresh
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry original request with new token
      const newToken = localStorage.getItem('jwt_token');
      const retryHeaders = new Headers(init.headers || {});
      if (newToken) retryHeaders.set('Authorization', `Bearer ${newToken}`);
      if (!retryHeaders.has('Content-Type') && !(init.body instanceof FormData)) {
        retryHeaders.set('Content-Type', 'application/json');
      }
      response = await fetch(input, { ...init, headers: retryHeaders });
    } else {
      localStorage.clear();
      window.location.href = `${window.location.origin}/`;
    }
  }
  return response;
};

let isRefreshing = false;

const tryRefresh = async (): Promise<boolean> => {
  if (isRefreshing) return false;
  isRefreshing = true;
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('refresh_token', data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    isRefreshing = false;
  }
};

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// On 401, try refresh then retry, only logout if refresh fails
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        error.config.headers['Authorization'] = `Bearer ${localStorage.getItem('jwt_token')}`;
        return api.request(error.config);
      }
      localStorage.clear();
      window.location.href = `${window.location.origin}/`;
    }
    return Promise.reject(error);
  }
);

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

  async login(credentials: any): Promise<any> {
    try {
      const response = await api.post('/login', credentials);
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Login request timed out. Please check if the server is running.');
      }
      throw error;
    }
  },
};
