export interface ParsedMachineQr {
  machineId: string;
  workCentreId?: number;
  lineCode?: string;
}

/** Pull a bare machine / employee id from legacy multi-line sticker text. */
export function extractLegacyId(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.includes('://')) return trimmed;
  const idMatch = trimmed.match(/ID:\s*([\w-]+)/i);
  if (idMatch) return idMatch[1].trim();
  const empMacMatch = trimmed.match(/(EMP-\d+|MAC-\d+)/i);
  if (empMacMatch) return empMacMatch[1].trim();
  const lines = trimmed.split(/\r?\n/);
  if (lines.length > 1) {
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.match(/^(EMP-\d+|MAC-\d+|ID:\s*[\w-]+|[\w-]+)$/i)) {
        return extractLegacyId(cleaned);
      }
    }
  }
  return trimmed;
}

/**
 * Decode machine QR payloads used on the factory floor.
 * Supports: `LineCode|machineId`, JSON `{ workCentreId, machineId }`, URLs, plain ids.
 */
export function parseMachineQr(raw: string): ParsedMachineQr | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes('session=')) {
    try {
      const query = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed;
      const params = new URLSearchParams(query);
      const machine = params.get('machine');
      const wc =
        params.get('work_centre_id') ||
        params.get('workCentreId') ||
        params.get('line');
      if (machine) {
        return {
          machineId: machine,
          workCentreId: wc && !Number.isNaN(Number(wc)) ? Number(wc) : undefined,
          lineCode: wc && Number.isNaN(Number(wc)) ? wc : undefined,
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const machineId = String(
        data.machineId ?? data.machine_id ?? data.machine ?? ''
      ).trim();
      const wcRaw = data.workCentreId ?? data.work_centre_id ?? data.lineId ?? data.line_id;
      const lineCode = data.lineCode ?? data.line_code ?? data.workCentreCode ?? data.work_centre_code;
      if (machineId) {
        return {
          machineId,
          workCentreId: wcRaw != null && wcRaw !== '' ? Number(wcRaw) : undefined,
          lineCode: lineCode ? String(lineCode) : undefined,
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (trimmed.includes('|')) {
    const [linePart, machinePart] = trimmed.split('|').map((s) => s.trim());
    if (linePart && machinePart) {
      return { machineId: machinePart, lineCode: linePart };
    }
  }

  if (trimmed.includes('://')) {
    try {
      const url = new URL(trimmed);
      const machine =
        url.searchParams.get('machine') ||
        url.searchParams.get('machineId') ||
        url.searchParams.get('machine_id');
      const wc =
        url.searchParams.get('work_centre_id') ||
        url.searchParams.get('workCentreId');
      if (machine) {
        return {
          machineId: machine,
          workCentreId: wc ? Number(wc) : undefined,
        };
      }
    } catch {
      /* fall through */
    }
  }

  return { machineId: extractLegacyId(trimmed) };
}

export interface WorkCentreOption {
  id: number;
  code?: string;
  name?: string;
}

export function resolveWorkCentreId(
  parsed: ParsedMachineQr,
  workCentres: WorkCentreOption[]
): number | undefined {
  if (parsed.workCentreId != null && !Number.isNaN(parsed.workCentreId)) {
    return parsed.workCentreId;
  }
  if (!parsed.lineCode || workCentres.length === 0) return undefined;
  const key = parsed.lineCode.trim().toLowerCase();
  const match = workCentres.find((wc) => {
    const code = (wc.code || '').trim().toLowerCase();
    const name = (wc.name || '').trim().toLowerCase();
    return code === key || name === key;
  });
  return match?.id;
}
