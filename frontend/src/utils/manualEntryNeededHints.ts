/** When to suggest a first manual entry for logged-in machines with no cycle yet. */

export const MANUAL_ENTRY_HINT_GRACE_MINS = 15;
export const SHIFT_START_HOUR = 9;
export const SHIFT_START_MINUTE = 5;

export type ActiveSessionSnapshot = {
  machine_id: string;
  emp_code: string;
  activated_at: string;
};

export type ManualEntryNeededHint = {
  machine_id: string;
  machine_name: string;
  work_centre_id: number;
  line_name: string;
  emp_code: string;
  emp_name: string;
  activated_at: string;
  mins_waiting: number;
};

const rowDateKey = (value?: string | null): string => {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function getShiftStartToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
  return d;
}

export function isPastManualEntryHintGrace(activatedAt: string, now = new Date()): boolean {
  const graceMs = MANUAL_ENTRY_HINT_GRACE_MINS * 60 * 1000;
  const shiftGraceEnd = getShiftStartToday(now).getTime() + graceMs;
  const loginAt = new Date(activatedAt);
  const loginMs = loginAt.getTime();
  if (!Number.isFinite(loginMs)) return false;
  const loginGraceEnd = loginMs + graceMs;
  return now.getTime() >= Math.max(shiftGraceEnd, loginGraceEnd);
}

export function hasRealCycleSinceLogin(
  cycles: Array<{
    machine_id?: string;
    start_time?: string;
    finish_time?: string;
    stoppage_reason?: string | null;
  }>,
  machineId: string,
  activatedAt: string
): boolean {
  const loginMs = new Date(activatedAt).getTime();
  if (!Number.isFinite(loginMs)) return false;
  return cycles.some((c) => {
    if (String(c.machine_id) !== String(machineId)) return false;
    if (c.stoppage_reason && String(c.stoppage_reason).startsWith('MANUAL:')) return false;
    const startMs = c.start_time ? new Date(c.start_time).getTime() : NaN;
    const finishMs = c.finish_time ? new Date(c.finish_time).getTime() : NaN;
    if (Number.isFinite(startMs) && startMs >= loginMs) return true;
    if (Number.isFinite(finishMs) && finishMs >= loginMs) return true;
    return false;
  });
}

export function machinesWithManualEntryOnDate(
  entries: Array<{ machine_id?: string; prod_date?: string }>,
  dateKey: string
): Set<string> {
  const set = new Set<string>();
  entries.forEach((e) => {
    if (rowDateKey(e.prod_date) === dateKey && e.machine_id) {
      set.add(String(e.machine_id));
    }
  });
  return set;
}

type BuildHintsInput = {
  todayKey: string;
  sessions: ActiveSessionSnapshot[];
  machines: Array<{ machine_id: string; machine_name?: string; name?: string; work_centre_id?: number }>;
  employees: Array<{ code: string; name: string }>;
  workCentres: Array<{ id: number; name: string }>;
  manualEntriesToday: Array<{ machine_id?: string; prod_date?: string }>;
  productionCyclesToday: Array<{
    machine_id?: string;
    start_time?: string;
    finish_time?: string;
    stoppage_reason?: string | null;
  }>;
  lineFilter?: string;
  now?: Date;
};

export function buildManualEntryNeededHints(input: BuildHintsInput): ManualEntryNeededHint[] {
  const now = input.now ?? new Date();
  const manualMachines = machinesWithManualEntryOnDate(input.manualEntriesToday, input.todayKey);
  const wcName = new Map(input.workCentres.map((w) => [String(w.id), w.name]));
  const empName = new Map(input.employees.map((e) => [String(e.code), e.name]));
  const machineMeta = new Map(
    input.machines.map((m) => [
      String(m.machine_id),
      {
        work_centre_id: m.work_centre_id,
        machine_name: m.machine_name || m.name || '',
      },
    ])
  );

  const seenMachines = new Set<string>();
  const hints: ManualEntryNeededHint[] = [];

  input.sessions.forEach((session) => {
    const machineId = String(session.machine_id || '');
    const empCode = String(session.emp_code || '');
    if (!machineId || !empCode || !session.activated_at) return;
    if (seenMachines.has(machineId)) return;

    const meta = machineMeta.get(machineId);
    const wcId = meta?.work_centre_id;
    if (wcId == null) return;
    if (input.lineFilter && String(wcId) !== String(input.lineFilter)) return;

    if (!isPastManualEntryHintGrace(session.activated_at, now)) return;
    if (manualMachines.has(machineId)) return;
    if (hasRealCycleSinceLogin(input.productionCyclesToday, machineId, session.activated_at)) return;

    seenMachines.add(machineId);
    const loginMs = new Date(session.activated_at).getTime();
    const minsWaiting = Number.isFinite(loginMs)
      ? Math.max(0, Math.floor((now.getTime() - loginMs) / 60000))
      : 0;

    hints.push({
      machine_id: machineId,
      machine_name: meta?.machine_name || '',
      work_centre_id: Number(wcId),
      line_name: wcName.get(String(wcId)) || `Line ${wcId}`,
      emp_code: empCode,
      emp_name: empName.get(empCode) || empCode,
      activated_at: session.activated_at,
      mins_waiting: minsWaiting,
    });
  });

  return hints.sort((a, b) => {
    const line = a.line_name.localeCompare(b.line_name);
    if (line !== 0) return line;
    return a.machine_id.localeCompare(b.machine_id, undefined, { numeric: true });
  });
}
