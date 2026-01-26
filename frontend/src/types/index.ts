export interface MachineStatus {
  machine_id: string;
  status: 0 | 1;
  event_time: string;
  source_file: string;
  created_at: string;
}

export interface RunIdleData {
  machine_id: string;
  run_minutes: number;
  idle_minutes: number;
  total_events: number;
  efficiency_percentage?: number;
}

export interface HourlyData {
  machine_id: string;
  hour: number;
  event_count: number;
  run_events: number;
  idle_events: number;
}

export interface OverallEfficiency {
  total_machines: number;
  total_run_minutes: number;
  total_idle_minutes: number;
  total_events: number;
  overall_efficiency: number;
}

export interface DailyDashboardData {
  work_centre_id: number;
  work_centre_name: string;
  target: number;
  output: number;
  output_percentage: number;
  efficiency_percentage: number;
  man_hours: number;
  smv: number;
  employees: number;
}

export interface OverallDailyData {
  todays_target: number;
  output: number;
  output_percentage: number;
  overall_efficiency_percentage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  date?: string;
  error?: string;
}