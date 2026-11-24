import React from 'react';

export interface LastWorkingDayCompareData {
  sameTime: number;
  fullDay: number;
  asOfTimeLabel: string;
  compareDateLabel: string;
}

interface CompareStyleProps {
  data: LastWorkingDayCompareData;
  variant?: 'light' | 'mobile';
}

interface LastWorkingDayCompareCardProps extends CompareStyleProps {
  todayActual: number;
  /** Hide the full-day summary row at the bottom of this card */
  hideFullDayRow?: boolean;
}

const useCompareStyles = (variant: 'light' | 'mobile', isAhead: boolean) => {
  const isMobile = variant === 'mobile';
  return {
    isMobile,
    sectionLabelClass: isMobile
      ? 'text-[10px] font-bold uppercase tracking-wide text-white/70'
      : 'text-[10px] font-bold uppercase tracking-wide text-slate-500',
    cardClass: isMobile
      ? `rounded-xl border-2 p-3 shadow-sm ${
          isAhead ? 'border-emerald-300/70 bg-emerald-500/15' : 'border-rose-300/70 bg-rose-500/15'
        }`
      : `rounded-xl border-2 p-3 shadow-sm ${
          isAhead ? 'border-emerald-400/90 bg-emerald-50' : 'border-rose-400/90 bg-rose-50'
        }`,
    subLabelClass: isMobile
      ? `text-[10px] font-bold uppercase tracking-wide ${isAhead ? 'text-emerald-100' : 'text-rose-100'}`
      : `text-[10px] font-bold uppercase tracking-wide ${isAhead ? 'text-emerald-800' : 'text-rose-800'}`,
    innerBoxClass: isMobile
      ? 'flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-white/15 px-2 py-2.5 ring-1 ring-white/20'
      : 'flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-white/90 px-2 py-2.5 ring-1 ring-black/5',
    dateLabelClass: isMobile
      ? 'text-[9px] font-bold uppercase text-white/55 truncate max-w-[4.5rem]'
      : 'text-[9px] font-bold uppercase text-slate-400 truncate max-w-[4.5rem]',
    prevValueClass: isMobile
      ? 'text-lg sm:text-xl font-black tabular-nums text-white/75'
      : 'text-lg sm:text-xl font-black tabular-nums text-slate-500',
    todayValueClass: isMobile
      ? `text-lg sm:text-xl font-black tabular-nums ${isAhead ? 'text-emerald-200' : 'text-rose-200'}`
      : `text-lg sm:text-xl font-black tabular-nums ${isAhead ? 'text-emerald-700' : 'text-rose-700'}`,
    arrowClass: isMobile
      ? `text-lg font-black ${isAhead ? 'text-emerald-300' : 'text-rose-300'}`
      : `text-lg font-black ${isAhead ? 'text-emerald-600' : 'text-rose-600'}`,
    deltaBoxClass: isMobile
      ? `flex shrink-0 flex-col items-center justify-center rounded-lg px-2.5 py-2 min-w-[3.25rem] sm:min-w-[3.5rem] ${
          isAhead ? 'bg-emerald-500 text-white shadow-sm' : 'bg-rose-500 text-white shadow-sm'
        }`
      : `flex shrink-0 flex-col items-center justify-center rounded-lg px-2.5 py-2 min-w-[3.25rem] sm:min-w-[3.5rem] ${
          isAhead ? 'bg-emerald-600 text-white shadow-sm' : 'bg-rose-600 text-white shadow-sm'
        }`,
    fullDayRowClass: isMobile
      ? 'flex items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 shadow-sm'
      : 'flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm',
    fullDayLabelClass: isMobile
      ? 'text-xs font-bold text-white/80'
      : 'text-xs font-bold text-slate-600',
    fullDayValueClass: isMobile
      ? 'shrink-0 text-base font-black tabular-nums text-white whitespace-nowrap'
      : 'shrink-0 text-base font-black tabular-nums text-slate-800 whitespace-nowrap',
    fullDayUnitClass: isMobile
      ? 'ml-1 text-xs font-semibold text-white/60'
      : 'ml-1 text-xs font-semibold text-slate-500',
  };
};

export const LastWorkingDayFullDayRow: React.FC<CompareStyleProps> = ({
  data,
  variant = 'light',
}) => {
  const styles = useCompareStyles(variant, true);
  return (
    <div className={styles.fullDayRowClass}>
      <p className={styles.fullDayLabelClass}>{data.compareDateLabel} full day</p>
      <p className={styles.fullDayValueClass}>
        {data.fullDay}
        <span className={styles.fullDayUnitClass}>pairs</span>
      </p>
    </div>
  );
};

export const LastWorkingDayCompareCard: React.FC<LastWorkingDayCompareCardProps> = ({
  data,
  todayActual,
  variant = 'light',
  hideFullDayRow = false,
}) => {
  const vsYesterdaySameTime = todayActual - data.sameTime;
  const isAhead = vsYesterdaySameTime >= 0;
  const styles = useCompareStyles(variant, isAhead);

  return (
    <div className="space-y-2">
      <p className={styles.sectionLabelClass}>vs last working day</p>
      <div className={styles.cardClass}>
        <p className={styles.subLabelClass}>
          Same time · {data.compareDateLabel} · {data.asOfTimeLabel}
        </p>
        <div className="mt-2.5 flex items-stretch gap-2 sm:gap-3">
          <div className={styles.innerBoxClass}>
            <div className="text-center min-w-[2.5rem]">
              <p className={styles.dateLabelClass}>{data.compareDateLabel}</p>
              <p className={styles.prevValueClass}>{data.sameTime}</p>
            </div>
            <span className={styles.arrowClass} aria-hidden>
              →
            </span>
            <div className="text-center min-w-[2.5rem]">
              <p className={styles.dateLabelClass}>Today</p>
              <p className={styles.todayValueClass}>{todayActual}</p>
            </div>
          </div>
          <div className={styles.deltaBoxClass}>
            <p className="text-[9px] font-bold uppercase opacity-90">Δ</p>
            <p className="text-lg sm:text-xl font-black tabular-nums leading-none">
              {isAhead ? '+' : ''}
              {vsYesterdaySameTime}
            </p>
          </div>
        </div>
      </div>
      {!hideFullDayRow && <LastWorkingDayFullDayRow data={data} variant={variant} />}
    </div>
  );
};
