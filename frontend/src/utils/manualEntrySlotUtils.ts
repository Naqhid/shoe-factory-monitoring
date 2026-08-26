/** Hourly shift slots aligned with factory reports (9–10 … 1–2 … 6–7). */

export const FACTORY_HOURLY_SLOTS = [
  { value: '09:00', label: '9-10', startMinutes: 9 * 60, endMinutes: 10 * 60 },
  { value: '10:00', label: '10-11', startMinutes: 10 * 60, endMinutes: 11 * 60 },
  { value: '11:00', label: '11-12', startMinutes: 11 * 60, endMinutes: 12 * 60 },
  { value: '12:00', label: '12-1', startMinutes: 12 * 60, endMinutes: 13 * 60 },
  { value: '13:00', label: '1-2', startMinutes: 13 * 60, endMinutes: 14 * 60 },
  { value: '14:00', label: '2-3', startMinutes: 14 * 60, endMinutes: 15 * 60 },
  { value: '15:00', label: '3-4', startMinutes: 15 * 60, endMinutes: 16 * 60 },
  { value: '16:00', label: '4-5', startMinutes: 16 * 60, endMinutes: 17 * 60 },
  { value: '17:00', label: '5-6', startMinutes: 17 * 60, endMinutes: 18 * 60 },
] as const;

export type MissingSlotHint = {
  work_centre_id: number;
  line_name: string;
  machine_id: string;
  machine_name: string;
  slot_value: string;
  slot_label: string;
  emp_code?: string;
  emp_name?: string;
};

type ProdRow = {
  machine_id?: string;
  work_centre_id?: number;
  start_time?: string;
  finish_time?: string;
  output_pairs?: number;
  stoppage_reason?: string | null;
  button_status?: number;
  prod_date?: string;
  emp_id?: string;
};

type ManualRow = {
  machine_id?: string;
  work_centre_id?: number;
  start_time?: string;
  finish_time?: string;
  prod_date?: string;
  emp_id?: string;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export const formatMinutesAsTime = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
};

export const rowDateKey = (value?: string | null): string => {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const isManualProductionRow = (row: ProdRow) =>
  Boolean(row.stoppage_reason && String(row.stoppage_reason).startsWith('MANUAL:'));

const intervalOverlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

const slotBoundsMs = (dateKey: string, startMinutes: number, endMinutes: number) => {
  const start = new Date(`${dateKey}T${formatMinutesAsTime(startMinutes)}:00`).getTime();
  const end = new Date(`${dateKey}T${formatMinutesAsTime(endMinutes)}:00`).getTime();
  return { start, end };
};

export const rowOverlapsSlot = (
  row: { start_time?: string; finish_time?: string },
  dateKey: string,
  slotStartMinutes: number,
  slotEndMinutes: number
): boolean => {
  if (!row.start_time) return false;
  const rowStart = new Date(row.start_time).getTime();
  const rowEnd = row.finish_time ? new Date(row.finish_time).getTime() : rowStart;
  if (!Number.isFinite(rowStart)) return false;
  const { start, end } = slotBoundsMs(dateKey, slotStartMinutes, slotEndMinutes);
  return intervalOverlaps(rowStart, rowEnd || rowStart + 60_000, start, end);
};

export const mesOutputInSlot = (
  cycles: ProdRow[],
  machineId: string,
  dateKey: string,
  slotStartMinutes: number,
  slotEndMinutes: number
): number => {
  return cycles
    .filter((c) => String(c.machine_id) === String(machineId) && !isManualProductionRow(c))
    .filter((c) => rowOverlapsSlot(c, dateKey, slotStartMinutes, slotEndMinutes))
    .reduce((sum, c) => sum + Number(c.output_pairs || 0), 0);
};

export const slotIsCovered = (
  machineId: string,
  dateKey: string,
  slotStartMinutes: number,
  slotEndMinutes: number,
  manualEntries: ManualRow[],
  cycles: ProdRow[]
): boolean => {
  const manualHit = manualEntries.some(
    (m) =>
      String(m.machine_id) === String(machineId) &&
      rowDateKey(m.prod_date || m.start_time) === dateKey &&
      rowOverlapsSlot(m, dateKey, slotStartMinutes, slotEndMinutes)
  );
  if (manualHit) return true;
  return cycles.some(
    (c) =>
      String(c.machine_id) === String(machineId) &&
      !isManualProductionRow(c) &&
      rowOverlapsSlot(c, dateKey, slotStartMinutes, slotEndMinutes)
  );
};

export const getEligibleSlotsForNow = (dateKey: string, now = new Date()) =>
  FACTORY_HOURLY_SLOTS.filter((slot) => {
    const slotStart = new Date(`${dateKey}T${slot.value}:00`);
    return !Number.isNaN(slotStart.getTime()) && slotStart.getTime() <= now.getTime();
  });

export function buildMissingSlotHints(input: {
  dateKey: string;
  machines: Array<{
    machine_id: string;
    machine_name?: string;
    name?: string;
    work_centre_id?: number;
  }>;
  workCentres: Array<{ id: number; name: string }>;
  manualEntries: ManualRow[];
  cycles: ProdRow[];
  activeSessions: Array<{ machine_id: string; emp_code: string }>;
  employees: Array<{ code: string; name: string }>;
  lineFilter?: string;
  now?: Date;
  limit?: number;
}): MissingSlotHint[] {
  const now = input.now ?? new Date();
  const wcName = new Map(input.workCentres.map((w) => [String(w.id), w.name]));
  const empName = new Map(input.employees.map((e) => [String(e.code), e.name]));
  const sessionByMachine = new Map(
    input.activeSessions.map((s) => [String(s.machine_id), String(s.emp_code)])
  );
  const eligibleSlots = getEligibleSlotsForNow(input.dateKey, now);
  const hints: MissingSlotHint[] = [];

  const lineMachines = input.machines.filter((m) => {
    if (!m.work_centre_id) return false;
    if (input.lineFilter && String(m.work_centre_id) !== String(input.lineFilter)) return false;
    // Only machines with an active mobile login today
    if (!sessionByMachine.has(String(m.machine_id))) return false;
    return true;
  });

  lineMachines.forEach((machine) => {
    const machineId = String(machine.machine_id);
    const wcId = Number(machine.work_centre_id);
    const empCode = sessionByMachine.get(machineId);
    if (!empCode) return;
    eligibleSlots.forEach((slot) => {
      if (
        slotIsCovered(
          machineId,
          input.dateKey,
          slot.startMinutes,
          slot.endMinutes,
          input.manualEntries,
          input.cycles
        )
      ) {
        return;
      }
      hints.push({
        work_centre_id: wcId,
        line_name: wcName.get(String(wcId)) || `Line ${wcId}`,
        machine_id: machineId,
        machine_name: machine.machine_name || machine.name || '',
        slot_value: slot.value,
        slot_label: slot.label,
        emp_code: empCode,
        emp_name: empCode ? empName.get(empCode) : undefined,
      });
    });
  });

  hints.sort((a, b) => {
    const line = a.line_name.localeCompare(b.line_name);
    if (line !== 0) return line;
    const machine = a.machine_id.localeCompare(b.machine_id, undefined, { numeric: true });
    if (machine !== 0) return machine;
    return a.slot_value.localeCompare(b.slot_value);
  });

  const cap = input.limit ?? 40;
  return hints.slice(0, cap);
}

export function getNextFactoryHourlySlot(
  currentSlot: string,
  dateKey: string,
  now = new Date()
): string | null {
  const idx = FACTORY_HOURLY_SLOTS.findIndex((s) => s.value === currentSlot);
  if (idx < 0) return null;
  for (let i = idx + 1; i < FACTORY_HOURLY_SLOTS.length; i++) {
    const slot = FACTORY_HOURLY_SLOTS[i];
    const slotStart = new Date(`${dateKey}T${slot.value}:00`);
    if (slotStart.getTime() > now.getTime()) return null;
    return slot.value;
  }
  return null;
}

export function getMesOutputForHourlySlot(
  cycles: ProdRow[],
  machineId: string,
  dateKey: string,
  hourlySlot: string
): number {
  const slot = FACTORY_HOURLY_SLOTS.find((s) => s.value === hourlySlot);
  if (!slot) return 0;
  return mesOutputInSlot(cycles, machineId, dateKey, slot.startMinutes, slot.endMinutes);
}
