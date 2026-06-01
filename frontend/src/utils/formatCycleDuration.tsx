import React from 'react';

/** Split fractional minutes into whole minutes, optional decimal-minute text, and seconds (floor; no rounding of total). */
export function minutesToDurationParts(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { wholeMinutes: 0, seconds: 0, decimalMinute: null as string | null };
  }
  const totalSec = minutes * 60;
  const wholeMinutes = Math.floor(totalSec / 60);
  if (wholeMinutes > 0) {
    return {
      wholeMinutes,
      seconds: Math.floor(totalSec - wholeMinutes * 60),
      decimalMinute: null,
    };
  }
  const decTenths = Math.floor(minutes * 10) / 10;
  const decimalMinute = decTenths > 0 ? decTenths.toFixed(1).replace(/^0\./, '.') : null;
  const secondsAfterDec = Math.floor((minutes - decTenths) * 60 + 1e-9);
  const seconds = secondsAfterDec > 0 ? secondsAfterDec : Math.floor(totalSec);
  return { wholeMinutes: 0, seconds, decimalMinute };
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
  const { wholeMinutes, seconds, decimalMinute } = minutesToDurationParts(minutes);
  const minSuffix = spaced ? ' m' : 'm';
  const secSuffix = spaced ? ' s' : 's';
  const gapClass = spaced ? 'gap-x-1' : 'gap-x-0.5';

  const parts: React.ReactNode[] = [];

  if (wholeMinutes > 0) {
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
  } else if (decimalMinute) {
    parts.push(
      <span key="dec" className={minClass}>
        {decimalMinute}
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
  } else if (seconds > 0) {
    parts.push(
      <span key="sec" className={secClass}>
        {seconds}
        {secSuffix}
      </span>
    );
  }

  if (parts.length === 0) {
    return (
      <span className={minClass}>
        0
        {minSuffix}
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

export function CycleDurationLostText({
  minutes,
  zeroClassName = 'text-gray-400',
}: {
  minutes: number;
  zeroClassName?: string;
}) {
  if (minutes <= 0.01) {
    return <span className={`text-xs font-bold tabular-nums ${zeroClassName}`}>0 m lost</span>;
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
