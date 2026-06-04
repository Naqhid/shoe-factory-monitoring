import React from 'react';
import { Target, Clock, TimerOff } from 'lucide-react';

export interface PlanPaceSnapshot {
    daily: number;
    actual: number;
    expected: number;
    projectedEod: number;
    shortBy: number;
    remainingMins: number;
    onTrack: boolean;
    elapsedPct: number;
    lossOfMinutes: number;
    lossInactiveMins: number;
    lossExtraMins: number;
}

interface TvPlanPacePanelProps {
    snapshot: PlanPaceSnapshot;
    lineName?: string;
}

const pct = (part: number, whole: number) =>
    whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;

export const TvPlanPacePanel: React.FC<TvPlanPacePanelProps> = ({ snapshot, lineName }) => {
    const {
        daily,
        actual,
        expected,
        projectedEod,
        shortBy,
        remainingMins,
        onTrack,
        elapsedPct,
        lossOfMinutes,
        lossInactiveMins,
        lossExtraMins,
    } = snapshot;

    const behindPaceNow = Math.max(0, expected - actual);
    const stillToHitPlan = Math.max(0, daily - actual);
    const pacePct = pct(actual, expected);
    const planPct = pct(actual, daily);
    const projectedPlanPct = pct(projectedEod, daily);

    const bottomTile = (label: string, value: React.ReactNode, foot: string, boxClass: string) => (
        <div
            className={`min-w-0 h-full flex flex-col justify-between rounded-lg px-1.5 py-1.5 text-center overflow-hidden ${boxClass}`}
        >
            <p className="text-[9px] font-bold uppercase leading-tight shrink-0">{label}</p>
            <div className="flex-1 flex items-center justify-center min-h-0 py-0.5">{value}</div>
            <p className="text-[8px] font-semibold tabular-nums leading-tight shrink-0 pt-1 border-t border-current/15">
                {foot}
            </p>
        </div>
    );

    return (
        <div className="w-full h-full min-h-0 flex flex-col overflow-hidden p-1.5">
            <div className="h-full min-h-0 flex flex-col rounded-xl overflow-hidden shadow-lg ring-1 ring-slate-200/80 bg-white">
                <div className="flex-shrink-0 flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700 truncate">
                        Actual vs plan speed
                        {lineName ? (
                            <span className="font-semibold text-slate-500 normal-case tracking-normal">
                                {' '}
                                · {lineName}
                            </span>
                        ) : null}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 tabular-nums shrink-0">
                        <Clock className="h-3 w-3" aria-hidden />
                        {elapsedPct}% · {remainingMins}m left
                    </span>
                </div>

                <div className="flex-1 min-h-0 grid grid-rows-[40%_18%_42%] gap-1.5 overflow-hidden px-2 py-1.5">
                    <div className="min-h-0 grid grid-cols-4 gap-1.5">
                        <div className="min-w-0 h-full flex flex-col justify-center rounded-lg bg-gradient-to-b from-blue-50 to-indigo-100 border-2 border-blue-400 shadow-sm px-1 py-1 text-center">
                            <div className="flex items-center justify-center gap-0.5 text-blue-900 shrink-0">
                                <Target className="h-3 w-3 shrink-0" aria-hidden />
                                <span className="text-[8px] font-extrabold uppercase">Plan</span>
                            </div>
                            <p className="text-[clamp(1.1rem,3.5vh,1.75rem)] font-black text-blue-700 tabular-nums leading-none">
                                {daily}
                            </p>
                            <p className="text-[8px] font-bold text-blue-800/90">pairs</p>
                        </div>
                        <div className="min-w-0 h-full flex flex-col justify-center rounded-lg bg-emerald-50 border border-emerald-200 px-1 py-1 text-center">
                            <span className="text-[8px] font-bold uppercase text-emerald-800 shrink-0">Done</span>
                            <p className="text-[clamp(1.1rem,3.5vh,1.75rem)] font-black text-emerald-600 tabular-nums leading-none">
                                {actual}
                            </p>
                            <span className="text-[8px] text-emerald-700 font-semibold shrink-0">{planPct}%</span>
                        </div>
                        <div className="min-w-0 h-full flex flex-col justify-center rounded-lg bg-slate-100 border border-slate-200 px-1 py-1 text-center">
                            <span className="text-[8px] font-bold uppercase text-slate-700 shrink-0">Should be</span>
                            <p className="text-[clamp(1.1rem,3.5vh,1.75rem)] font-black text-slate-800 tabular-nums leading-none">
                                {expected}
                            </p>
                            <span className="text-[8px] text-slate-600 font-semibold shrink-0">now</span>
                        </div>
                        <div className="min-w-0 h-full flex flex-col justify-center rounded-lg bg-orange-50 border-2 border-orange-300 px-1 py-1 text-center">
                            <div className="flex items-center justify-center gap-0.5 text-orange-900 shrink-0">
                                <TimerOff className="h-3 w-3 shrink-0" aria-hidden />
                                <span className="text-[8px] font-extrabold uppercase">Loss mins</span>
                            </div>
                            <p className="text-[clamp(1.1rem,3.5vh,1.75rem)] font-black text-orange-700 tabular-nums leading-none">
                                {lossOfMinutes}
                            </p>
                            <span className="text-[8px] font-bold text-orange-800/90 leading-tight">
                                gap {lossInactiveMins} + slow {lossExtraMins}
                            </span>
                        </div>
                    </div>

                    <div className="min-h-0 flex flex-col justify-center rounded-lg bg-white border border-slate-200 px-2 py-1">
                        <div className="flex justify-between items-center gap-2 text-[9px] font-bold text-slate-600 mb-0.5">
                            <span>Speed now</span>
                            <span className={pacePct >= 100 ? 'text-emerald-600' : 'text-amber-700'} tabular-nums>
                                {pacePct}% expected
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${pacePct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.max(4, pacePct)}%` }}
                            />
                        </div>
                        <p
                            className={`mt-0.5 text-center text-[9px] font-bold leading-tight truncate ${
                                behindPaceNow > 0 ? 'text-amber-800' : 'text-emerald-700'
                            }`}
                        >
                            {behindPaceNow > 0
                                ? `Behind ${behindPaceNow} pairs (${expected}−${actual})`
                                : 'On speed'}
                        </p>
                    </div>

                    <div className="min-h-0 h-full grid grid-cols-3 gap-1.5">
                        {bottomTile(
                            'EOD projection',
                            <span className="text-[clamp(1.1rem,4.5vh,1.75rem)] font-black text-blue-700 tabular-nums leading-none">
                                {projectedEod}
                            </span>,
                            `${projectedPlanPct}% of plan`,
                            'bg-blue-50 border border-blue-200 text-blue-800'
                        )}
                        {bottomTile(
                            onTrack ? 'On track' : 'Short EOD',
                            <span
                                className={`text-[clamp(1.1rem,4.5vh,1.75rem)] font-black tabular-nums leading-none ${
                                    onTrack ? 'text-emerald-600' : 'text-red-600'
                                }`}
                            >
                                {onTrack ? '✓' : shortBy}
                            </span>,
                            onTrack ? 'Meets plan' : `${daily}−${projectedEod}=${shortBy}`,
                            onTrack
                                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                                : 'bg-red-50 border border-red-300 ring-1 ring-inset ring-red-400/40 text-red-800'
                        )}
                        {bottomTile(
                            'Still to make',
                            <span className="text-[clamp(1.1rem,4.5vh,1.75rem)] font-black text-slate-700 tabular-nums leading-none">
                                {stillToHitPlan}
                            </span>,
                            `${daily}−${actual}`,
                            'bg-slate-100 border border-slate-200 text-slate-600'
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
