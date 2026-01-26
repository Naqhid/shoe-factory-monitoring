import { useQuery } from 'react-query';
import { apiService } from '../services/api';
import { format } from 'date-fns';

export const useMachineStatus = () => {
  return useQuery(
    'machineStatus',
    apiService.getMachineStatus,
    {
      refetchInterval: 5000, // Refresh every 5 seconds
      refetchOnWindowFocus: true,
    }
  );
};

export const useRunIdleReport = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return useQuery(
    ['runIdleReport', dateStr],
    () => apiService.getRunIdleReport(dateStr),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );
};

export const useHourlyReport = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return useQuery(
    ['hourlyReport', dateStr],
    () => apiService.getHourlyReport(dateStr),
    {
      refetchInterval: 30000,
    }
  );
};

export const useEfficiencyReport = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return useQuery(
    ['efficiencyReport', dateStr],
    () => apiService.getEfficiencyReport(dateStr),
    {
      refetchInterval: 30000,
    }
  );
};

export const useOverallEfficiency = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return useQuery(
    ['overallEfficiency', dateStr],
    () => apiService.getOverallEfficiency(dateStr),
    {
      refetchInterval: 30000,
    }
  );
};

export const useDailyDashboardData = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return useQuery(
    ['dailyDashboardData', dateStr],
    () => apiService.getDailyDashboardData(dateStr),
    {
      refetchInterval: 30000,
    }
  );
};

export const useOverallDailyData = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return useQuery(
    ['overallDailyData', dateStr],
    () => apiService.getOverallDailyData(dateStr),
    {
      refetchInterval: 30000,
    }
  );
};