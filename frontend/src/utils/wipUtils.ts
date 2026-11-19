/**
 * wipUtils.ts
 *
 * Client-side utility functions for MES-style WIP display on the TV dashboard.
 *
 * WIP Formula: Current WIP = Opening WIP + Input - Output
 *
 * These are pure display/formatting helpers — the authoritative WIP calculation
 * lives in the backend (wipStateService.js). The frontend only renders what the
 * API returns.
 */

// ── WIP colour coding ─────────────────────────────────────────────────────────

/**
 * Returns a Tailwind text colour class for a WIP value.
 * High WIP (backlog building) = red warning.
 * Low WIP (healthy flow) = green.
 *
 * @param wip  Current WIP quantity
 * @param target  Daily target (used to contextualise the WIP level)
 */
export function wipTextClass(wip: number, target: number): string {
    if (target <= 0) return 'text-gray-400';
    const ratio = wip / target;
    if (ratio > 0.5) return 'text-red-400';      // WIP > 50% of target — backlog risk
    if (ratio > 0.25) return 'text-yellow-300';  // WIP 25–50% — monitor
    return 'text-emerald-300';                   // WIP < 25% — healthy flow
}

/**
 * Returns a Tailwind text colour class for an Input value.
 * Input is always shown in a neutral/positive colour.
 */
export function inputTextClass(): string {
    return 'text-cyan-300';
}

/**
 * Formats a WIP number for display.
 * Returns '—' for null/undefined, '0' for zero, otherwise the integer string.
 */
export function formatWip(wip: number | null | undefined): string {
    if (wip == null) return '—';
    return String(Math.max(0, Math.round(wip)));
}

/**
 * Formats an Input quantity for display.
 * Returns '—' for null/undefined, otherwise the integer string.
 */
export function formatInput(input: number | null | undefined): string {
    if (input == null) return '—';
    return String(Math.max(0, Math.round(input)));
}

/**
 * Computes the client-side WIP for display purposes only.
 * The backend is the source of truth; this is a fallback/sanity check.
 *
 * @param openingWip  Opening WIP for the day
 * @param input       Today's input from the line input machine (e.g. 01)
 * @param output      Today's end-of-line output
 * @returns           Current WIP (floored at 0)
 */
export function computeDisplayWip(openingWip: number, input: number, output: number): number {
    return Math.max(0, Math.round(openingWip + input - output));
}
