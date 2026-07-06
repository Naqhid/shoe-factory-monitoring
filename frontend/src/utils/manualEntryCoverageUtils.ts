import {
  FACTORY_HOURLY_SLOTS,
  getEligibleSlotsForNow,
  isManualProductionRow,
  mesOutputInSlot,
  rowDateKey,
  rowOverlapsSlot,
  slotIsCovered,
} from './manualEntrySlotUtils';
import { DEFAULT_PAIRS_PER_BIN } from './shiftPaceUtils';
import type { MissingSlotHint } from './manualEntrySlotUtils';
import type { ManualEntryNeededHint } from './manualEntryNeededHints';

export type SlotCellStatus = 'future' | 'missing' | 'mes' | 'manual' | 'overlap';

export type SlotHeatmapCell = {
  status: SlotCellStatus;
  mesOutput: number;
  manualOutput: number;
};

export type SlotHeatmapRow = {
  machine_id: string;
  machine_name: string;
  work_centre_id: number;
  line_name: string;
  logged_in: boolean;
  cells: Record<string, SlotHeatmapCell>;
};

type ProdRow = {
  machine_id?: string;
  work_centre_id?: number;
  start_time?: string;
  finish_time?: string;
  output_pairs?: number;
  stoppage_reason?: string | null;
  prod_date?: string;
};

type ManualRow = {
  id?: number;
  machine_id?: string;
  work_centre_id?: number;
  start_time?: string;
  finish_time?: string;
  output_pairs?: number;
  prod_date?: string;
  emp_id?: string;
};

const manualOutputInSlot = (
  manualEntries: ManualRow[],
  machineId: string,
  dateKey: string,
  slotStartMinutes: number,
  slotEndMinutes: number
): number =>
  manualEntries
    .filter(
      (m) =>
        String(m.machine_id) === String(machineId) &&
        rowDateKey(m.prod_date || m.start_time) === dateKey &&
        rowOverlapsSlot(m, dateKey, slotStartMinutes, slotEndMinutes)
    )
    .reduce((sum, m) => sum + Number(m.output_pairs || 0), 0);

export const getSlotCellStatus = (
  machineId: string,
  dateKey: string,
  slot: (typeof FACTORY_HOURLY_SLOTS)[number],
  manualEntries: ManualRow[],
  cycles: ProdRow[],
  now = new Date()
): SlotHeatmapCell => {
  const slotStart = new Date(`${dateKey}T${slot.value}:00`);
  if (!Number.isNaN(slotStart.getTime()) && slotStart.getTime() > now.getTime()) {
    return { status: 'future', mesOutput: 0, manualOutput: 0 };
  }

  const mesOut = mesOutputInSlot(cycles, machineId, dateKey, slot.startMinutes, slot.endMinutes);
  const manualOut = manualOutputInSlot(
    manualEntries,
    machineId,
    dateKey,
    slot.startMinutes,
    slot.endMinutes
  );
  const hasMes = cycles.some(
    (c) =>
      String(c.machine_id) === String(machineId) &&
      !isManualProductionRow(c) &&
      rowOverlapsSlot(c, dateKey, slot.startMinutes, slot.endMinutes)
  );
  const hasManual = manualEntries.some(
    (m) =>
      String(m.machine_id) === String(machineId) &&
      rowDateKey(m.prod_date || m.start_time) === dateKey &&
      rowOverlapsSlot(m, dateKey, slot.startMinutes, slot.endMinutes)
  );

  let status: SlotCellStatus = 'missing';
  if (hasMes && hasManual) status = 'overlap';
  else if (hasManual) status = 'manual';
  else if (hasMes) status = 'mes';

  return { status, mesOutput: mesOut, manualOutput: manualOut };
};

export function buildSlotCoverageHeatmap(input: {
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
  activeSessions: Array<{ machine_id: string }>;
  lineFilter?: string;
  now?: Date;
}): SlotHeatmapRow[] {
  const now = input.now ?? new Date();
  const wcName = new Map(input.workCentres.map((w) => [String(w.id), w.name]));
  const loggedIn = new Set(input.activeSessions.map((s) => String(s.machine_id)));

  const rows = input.machines
    .filter((m) => m.work_centre_id)
    .filter((m) => !input.lineFilter || String(m.work_centre_id) === String(input.lineFilter))
    .map((machine) => {
      const machineId = String(machine.machine_id);
      const wcId = Number(machine.work_centre_id);
      const cells: Record<string, SlotHeatmapCell> = {};
      FACTORY_HOURLY_SLOTS.forEach((slot) => {
        cells[slot.value] = getSlotCellStatus(
          machineId,
          input.dateKey,
          slot,
          input.manualEntries,
          input.cycles,
          now
        );
      });
      return {
        machine_id: machineId,
        machine_name: machine.machine_name || machine.name || '',
        work_centre_id: wcId,
        line_name: wcName.get(String(wcId)) || `Line ${wcId}`,
        logged_in: loggedIn.has(machineId),
        cells,
      };
    });

  return rows.sort((a, b) => {
    const line = a.line_name.localeCompare(b.line_name);
    if (line !== 0) return line;
    return a.machine_id.localeCompare(b.machine_id, undefined, { numeric: true });
  });
}

export type LineReconciliation = {
  work_centre_id: number;
  line_name: string;
  mesTotal: number;
  manualTotal: number;
  combinedTotal: number;
  eolOutput: number;
  planTarget: number;
  gap: number;
};

export function buildLineReconciliation(input: {
  dateKey: string;
  workCentres: Array<{ id: number; name: string; eol_machine_id?: string | null }>;
  machines: Array<{ machine_id: string; work_centre_id?: number }>;
  manualEntries: ManualRow[];
  cycles: ProdRow[];
  planTargets: Record<number, number>;
  lineFilter?: string;
}): LineReconciliation[] {
  const lines = input.workCentres.filter(
    (wc) => !input.lineFilter || String(wc.id) === String(input.lineFilter)
  );

  return lines.map((wc) => {
    const wcId = wc.id;
    const machineIds = new Set(
      input.machines.filter((m) => Number(m.work_centre_id) === wcId).map((m) => String(m.machine_id))
    );

    let mesTotal = 0;
    let eolOutput = 0;
    const eolMachineId = (wc as any).eol_machine_id || null;

    input.cycles.forEach((c) => {
      // Include cycles by machine assignment OR by work_centre_id in the production record
      const belongsToLine = machineIds.has(String(c.machine_id)) || Number((c as any).work_centre_id) === wcId;
      if (!belongsToLine) return;
      if (rowDateKey(c.start_time) !== input.dateKey) return;
      if (isManualProductionRow(c)) return;
      mesTotal += 1;
      // Count EOL machine output pairs for plan comparison
      if (eolMachineId && String(c.machine_id) === String(eolMachineId)) {
        eolOutput += Number(c.output_pairs || 0);
      }
    });

    // If no explicit EOL machine, fall back to checking machine name containing "output" or "final"
    if (!eolMachineId && eolOutput === 0) {
      input.cycles.forEach((c) => {
        const belongsToLine = machineIds.has(String(c.machine_id)) || Number((c as any).work_centre_id) === wcId;
        if (!belongsToLine) return;
        if (rowDateKey(c.start_time) !== input.dateKey) return;
        if (isManualProductionRow(c)) return;
        const machineName = String((c as any).machine_name || '').toLowerCase();
        if (machineName.includes('final output') || machineName.includes('output')) {
          eolOutput += Number(c.output_pairs || 0);
        }
      });
    }

    const manualTotal = input.manualEntries
      .filter(
        (m) =>
          (Number(m.work_centre_id) === wcId || machineIds.has(String(m.machine_id))) &&
          rowDateKey(m.prod_date || m.start_time) === input.dateKey
      ).length;

    const combinedTotal = mesTotal + manualTotal;
    const planTarget = Number(input.planTargets[wcId] || 0);
    // Gap is based on EOL output vs plan, not cycle count
    const gap = planTarget > 0 ? planTarget - eolOutput : 0;

    return {
      work_centre_id: wcId,
      line_name: wc.name,
      mesTotal,
      manualTotal,
      combinedTotal,
      eolOutput,
      planTarget,
      gap,
    };
  });
}

export function computeExpectedSlotOutput(
  targetMinsPerSixPairs: number,
  slotMinutes: number,
  pairsPerBin = DEFAULT_PAIRS_PER_BIN
): number | null {
  const base = Number(targetMinsPerSixPairs);
  if (!Number.isFinite(base) || base <= 0 || slotMinutes <= 0) return null;
  return Math.max(0, Math.round((slotMinutes / base) * pairsPerBin));
}

export type SlotOverlapConflict = {
  blocked: boolean;
  message: string;
  mesOutput: number;
  manualOutput: number;
};

export function detectSlotOverlapConflict(input: {
  machineId: string;
  dateKey: string;
  slotStartMinutes: number;
  slotEndMinutes: number;
  manualEntries: ManualRow[];
  cycles: ProdRow[];
  editingId?: number | null;
}): SlotOverlapConflict {
  const mesOutput = mesOutputInSlot(
    input.cycles,
    input.machineId,
    input.dateKey,
    input.slotStartMinutes,
    input.slotEndMinutes
  );
  const manualOutput = manualOutputInSlot(
    input.manualEntries,
    input.machineId,
    input.dateKey,
    input.slotStartMinutes,
    input.slotEndMinutes
  );

  if (input.editingId) {
    return { blocked: false, message: '', mesOutput, manualOutput };
  }

  const manualOverlap = input.manualEntries.some(
    (m) =>
      String(m.machine_id) === String(input.machineId) &&
      rowDateKey(m.prod_date || m.start_time) === input.dateKey &&
      rowOverlapsSlot(m, input.dateKey, input.slotStartMinutes, input.slotEndMinutes)
  );

  if (manualOverlap) {
    return {
      blocked: true,
      message: 'A manual entry already overlaps this time slot on this machine.',
      mesOutput,
      manualOutput,
    };
  }

  if (mesOutput > 0) {
    return {
      blocked: true,
      message: `Mobile already recorded ${mesOutput} pairs for this slot. Adjust output to match or pick another slot.`,
      mesOutput,
      manualOutput,
    };
  }

  return { blocked: false, message: '', mesOutput, manualOutput };
}

export type ShiftChecklistItem = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  count: number;
  actionLabel?: string;
};

export function buildEndOfShiftChecklist(input: {
  missingSlots: MissingSlotHint[];
  entryNeeded: ManualEntryNeededHint[];
  reconciliations: LineReconciliation[];
  overlapSlotCount: number;
  conflictEntryCount: number;
}): ShiftChecklistItem[] {
  const items: ShiftChecklistItem[] = [];

  if (input.missingSlots.length > 0) {
    items.push({
      id: 'missing-slots',
      severity: 'high',
      title: 'Missing hourly slots',
      detail: 'Logged-in machines with no mobile or manual entry for an elapsed hour.',
      count: input.missingSlots.length,
      actionLabel: 'Review heatmap',
    });
  }

  if (input.entryNeeded.length > 0) {
    items.push({
      id: 'entry-needed',
      severity: 'medium',
      title: 'Manual entry may be needed',
      detail: 'Operators logged in 15+ minutes with no cycle and no manual entry yet.',
      count: input.entryNeeded.length,
      actionLabel: 'Add entry',
    });
  }

  if (input.overlapSlotCount > 0) {
    items.push({
      id: 'overlap-slots',
      severity: 'high',
      title: 'Mobile + manual overlap',
      detail: 'Same hour has both mobile and manual data — review for double counting.',
      count: input.overlapSlotCount,
      actionLabel: 'Review heatmap',
    });
  }

  if (input.conflictEntryCount > 0) {
    items.push({
      id: 'table-conflicts',
      severity: 'high',
      title: 'Manual vs mobile conflicts',
      detail: 'Saved manual entries overlap real mobile cycles on the same machine.',
      count: input.conflictEntryCount,
      actionLabel: 'Check table',
    });
  }

  const behindPlan = input.reconciliations.filter((r) => r.planTarget > 0 && r.gap > 0);
  if (behindPlan.length > 0) {
    const totalGap = behindPlan.reduce((s, r) => s + r.gap, 0);
    items.push({
      id: 'plan-gap',
      severity: 'medium',
      title: 'Behind daily plan',
      detail: `${behindPlan.map((r) => `${r.line_name} — EOL output ${r.eolOutput} vs plan ${r.planTarget}`).join('; ')}.`,
      count: totalGap,
      actionLabel: 'View totals',
    });
  }

  return items;
}

export function countOverlapSlots(heatmap: SlotHeatmapRow[]): number {
  let count = 0;
  heatmap.forEach((row) => {
    Object.values(row.cells).forEach((cell) => {
      if (cell.status === 'overlap') count += 1;
    });
  });
  return count;
}

export function countMissingEligibleSlots(
  heatmap: SlotHeatmapRow[],
  dateKey: string,
  now = new Date()
): number {
  const eligible = new Set(getEligibleSlotsForNow(dateKey, now).map((s) => s.value as string));
  let count = 0;
  heatmap.forEach((row) => {
    if (!row.logged_in) return;
    Object.entries(row.cells).forEach(([slotValue, cell]) => {
      if (eligible.has(slotValue) && cell.status === 'missing') count += 1;
    });
  });
  return count;
}
