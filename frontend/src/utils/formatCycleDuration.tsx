import React from 'react';

/** Split fractional minutes into whole minutes and seconds only (no decimal minutes). */
export function minutesToDurationParts(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { hours: 0, wholeMinutes: 0, seconds: 0 };
  }
  const totalSec = Math.floor(minutes * 60 + 1e-9);
  return {
    hours: Math.floor(totalSec / 3600),
    wholeMinutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

/** Format duration parts into a string like "1h 32m 12s" or "45m 12s" (hours shown only when >= 60 min). */
export function formatDurationString(minutes: number): string {
  const parts = minutesToDurationParts(Math.abs(minutes));
  if (parts.hours > 0) {
    return `${parts.hours}h ${parts.wholeMinutes}m ${parts.seconds}s`;
  }
  return `${parts.wholeMinutes}m ${parts.seconds}s`;
}

type CycleDurationKind = 'late' | 'extra' | 'early' | 'lost';

const KIND_STYLES: Record<
  CycleDurationKind,
  { wrap: string; min: string; sec: string; suffix: string }
> = {
  late: {
    wrap: 'bg-red-50 text-red-800 border border-red-200',
    min: 'text-red-800 font-bold',
    sec: 'text-red-500 font-semibold',
    suffix: 'late',
  },
  extra: {
    wrap: 'bg-red-50 text-red-800 border border-red-200',
    min: 'text-red-800 font-bold',
    sec: 'text-red-500 font-semibold',
    suffix: 'extra',
  },
  early: {
    wrap: 'bg-emerald-100 text-emerald-800',
    min: 'text-emerald-900 font-bold',
    sec: 'text-emerald-600 font-semibold',
    suffix: 'early',
  },
  lost: {
    wrap: '',
    min: 'text-red-800 font-bold',
    sec: 'text-red-500 font-semibold',
    suffix: 'lost',
  },
};

function DurationAmount({
  minutes,
  minClass,
  secClass,
  spaced = false,
}: {
  minutes: number;
  minClass: string;
  secClass: string;
  spaced?: boolean;
}) {
  const { hours, wholeMinutes, seconds } = minutesToDurationParts(minutes);
  const hrSuffix = spaced ? ' h' : 'h';
  const minSuffix = spaced ? ' m' : 'm';
  const secSuffix = spaced ? ' s' : 's';
  const gapClass = spaced ? 'gap-x-1' : 'gap-x-0.5';

  const parts: React.ReactNode[] = [];

  if (hours > 0) {
    parts.push(
      <span key="hr" className={minClass}>
        {hours}
        {hrSuffix}
      </span>
    );
  }

  parts.push(
    <span key="min" className={minClass}>
      {wholeMinutes}
      {minSuffix}
    </span>
  );

  if (seconds > 0) {
    parts.push(
      <span key="sec" className={secClass}>
        {seconds}
        {secSuffix}
      </span>
    );
  }

  return <span className={`inline-flex items-baseline flex-nowrap ${gapClass}`}>{parts}</span>;
}

/** Readable duration for labels and footer, e.g. "20 m 7 s". */
export function CycleDurationInline({
  minutes,
  minClass = 'text-gray-800 font-medium',
  secClass = 'text-gray-500 font-medium',
}: {
  minutes: number;
  minClass?: string;
  secClass?: string;
}) {
  return <DurationAmount minutes={minutes} minClass={minClass} secClass={secClass} spaced />;
}

export function CycleDurationBadge({ minutes, kind }: { minutes: number; kind: CycleDurationKind }) {
  const style = KIND_STYLES[kind];
  const showStarted = kind === 'late' && minutes > 0.01;

  return (
    <span
      className={`inline-flex items-baseline flex-nowrap gap-x-1 max-w-full px-2.5 py-1 rounded-full text-xs font-semibold ${style.wrap}`}
    >
      {showStarted && <span className="shrink-0 text-red-800">Started</span>}
      <DurationAmount minutes={minutes} minClass={style.min} secClass={style.sec} spaced />
      <span className="shrink-0">{style.suffix}</span>
    </span>
  );
}

export function CycleDurationGainText({
  minutes,
  zeroClassName = 'text-amber-700',
}: {
  minutes: number;
  zeroClassName?: string;
}) {
  if (!Number.isFinite(minutes) || minutes * 60 < 1) {
    return (
      <span className={`text-xs font-bold tabular-nums inline-flex items-baseline gap-x-1 ${zeroClassName}`}>
        <span>0 m</span>
        <span className="opacity-80">0 s</span>
        <span>gain</span>
      </span>
    );
  }
  return (
    <span className="text-xs font-bold tabular-nums inline-flex items-baseline flex-nowrap gap-x-1">
      <DurationAmount minutes={minutes} minClass="text-amber-900 font-bold" secClass="text-amber-600 font-semibold" spaced />
      <span className="text-amber-800">gain</span>
    </span>
  );
}

export function CycleDurationLostText({
  minutes,
  zeroClassName = 'text-gray-400',
}: {
  minutes: number;
  zeroClassName?: string;
}) {
  if (!Number.isFinite(minutes) || minutes * 60 < 1) {
    return (
      <span className={`text-xs font-bold tabular-nums inline-flex items-baseline gap-x-1 ${zeroClassName}`}>
        <span>0 m</span>
        <span className="opacity-80">0 s</span>
        <span>lost</span>
      </span>
    );
  }
  return (
    <span className="text-xs font-bold tabular-nums inline-flex items-baseline flex-nowrap gap-x-1">
      <DurationAmount minutes={minutes} minClass="text-red-800 font-bold" secClass="text-red-500 font-semibold" spaced />
      <span className="text-red-800">lost</span>
    </span>
  );
}

export function sumMinutes(values: number[]) {
  return values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}
