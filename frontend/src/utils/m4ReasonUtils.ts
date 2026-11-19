export const M4_REASON_OPTIONS: Record<string, string[]> = {
  MAN: ['Waiting for box or pair', 'Skill', 'Handling', 'Spec Awareness', 'Inspection'],
  MACHINE: ['Settings', 'Needle/Foot', 'Skiving/Folding', 'Alignment'],
  MATERIAL: ['Quality/Thickness', 'Thread/Accessories', 'Component Accuracy', 'Defects'],
  METHOD: ['Sequence', 'SOP', 'Marking', 'QC Checks'],
};

export const M4_CATEGORIES = ['MAN', 'MACHINE', 'MATERIAL', 'METHOD'] as const;

export type M4Category = (typeof M4_CATEGORIES)[number];

export const M4_BADGE_CLASS: Record<string, string> = {
  MAN: 'bg-blue-100 text-blue-800 ring-blue-200',
  MACHINE: 'bg-violet-100 text-violet-800 ring-violet-200',
  MATERIAL: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  METHOD: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
};

/** Full reason row highlight (background + ring) on tracker cards. */
export const M4_REASON_ROW_CLASS: Record<string, string> = {
  MAN: 'bg-blue-50 ring-blue-200',
  MACHINE: 'bg-violet-50 ring-violet-200',
  MATERIAL: 'bg-emerald-50 ring-emerald-200',
  METHOD: 'bg-indigo-50 ring-indigo-200',
};

/** Reason detail text colour by M4 category. */
export const M4_REASON_TEXT_CLASS: Record<string, string> = {
  MAN: 'text-blue-900',
  MACHINE: 'text-violet-900',
  MATERIAL: 'text-emerald-900',
  METHOD: 'text-indigo-900',
};

export const buildM4DetailText = (category: string, reason: string, notes = '') => {
  const base = `${category} - ${reason.trim()}`;
  const trimmedNotes = notes.trim();
  return trimmedNotes ? `${base} — ${trimmedNotes}` : base;
};

export const parseM4FromDetail = (detail?: string | null) => {
  const text = (detail || '').trim();
  if (!text) {
    return { reasonCategory: '', reason: '', notes: '' };
  }
  for (const category of Object.keys(M4_REASON_OPTIONS)) {
    const match = text.match(new RegExp(`^${category}\\s*[-–—:]\\s*(.+)$`, 'i'));
    if (!match) continue;
    const rest = match[1].trim();
    const reasons = M4_REASON_OPTIONS[category] || [];
    const matchedReason = reasons.find(
      (r) =>
        rest === r ||
        rest.startsWith(`${r} `) ||
        rest.startsWith(`${r}—`) ||
        rest.startsWith(`${r}-`)
    );
    if (matchedReason) {
      let notes = rest.slice(matchedReason.length).replace(/^[\s—–-]+/, '').trim();
      if (notes.startsWith('(') && notes.endsWith(')')) notes = notes.slice(1, -1).trim();
      return { reasonCategory: category, reason: matchedReason, notes };
    }
    return { reasonCategory: category, reason: rest, notes: '' };
  }
  return { reasonCategory: '', reason: text, notes: '' };
};

/** Display label for saved reasons (handles legacy wording). */
export const formatReasonDisplayLabel = (reason: string) => {
  if (reason === 'Waiting for box/pair') return 'Waiting for box or pair';
  return reason;
};

export const formatM4ReasonShort = (stored?: string | null) => {
  const parsed = parseM4FromDetail(stored);
  if (parsed.reasonCategory && parsed.reason) {
    return `${parsed.reasonCategory} · ${formatReasonDisplayLabel(parsed.reason)}`;
  }
  return (stored || '').trim();
};
