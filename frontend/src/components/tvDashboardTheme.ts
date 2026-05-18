/** Shared airport-style tokens for TV dashboard surfaces. */
export const TV_BG = 'bg-[#003399]';
export const TV_PANEL = 'border border-white/25 bg-[#002266]/70 backdrop-blur-sm';
export const TV_ACCENT = 'text-[#CCFF00]';

export const TV_KPI_CARD =
  'border border-white/30 bg-[#001a4d]/80 rounded-xl sm:rounded-2xl p-3 sm:p-6 2xl:p-8 text-center hover:bg-[#001a4d] transition-all duration-500 shadow-lg';

export const TV_KPI_LABEL = 'text-white/90 text-xs sm:text-sm 2xl:text-base mb-1 sm:mb-2 font-medium';

export const TV_KPI_VALUE = 'text-2xl sm:text-4xl 2xl:text-5xl font-bold tabular-nums';

export function tvPctTextClass(pct: number): string {
  return pct >= 90 ? 'text-green-300' : pct >= 70 ? 'text-yellow-300' : 'text-red-300';
}
