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

// ── TV Dashboard MES types ────────────────────────────────────────────────────

/**
 * Overall Performance KPI card data (top section of TV dashboard).
 * WIP uses MES formula: Opening WIP + Input - Output
 */
export interface TVTopSection {
  workCentreName: string;
  target: number;
  /** Live input quantity from Heel Grip Machine (machine_id = '03') */
  input: number;
  output: number;
  outputPercent: number;
  efficiencyPercent: number;
  /** MES WIP: Opening WIP + Input - Output */
  currentWip: number;
  openingWip: number;
  closingWip: number;
  showHappyEmoji: boolean;
  showMediumEmoji: boolean;
}

/**
 * Line performance row in the TV dashboard table.
 * Includes MES WIP and live Input from Heel Grip Machine.
 */
export interface TVLinePerformanceRow {
  work_centre_id: number;
  line_name: string;
  target: number;
  /** Live input from Heel Grip Machine for this line */
  input: number;
  output: number;
  output_percentage: number;
  efficiency: number;
  /** MES WIP: Opening WIP + Input - Output */
  wip: number;
  opening_wip: number;
}

/** WIP state snapshot for a single work centre on a given day */
export interface WipDailyState {
  openingWip: number;
  todayInput: number;
  currentWip: number;
  closingWip: number;
  isClosed: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  date?: string;
  error?: string;
}